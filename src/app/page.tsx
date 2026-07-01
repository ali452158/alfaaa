"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SignalCard } from "@/components/trading/signal-card";
import { DualGate } from "@/components/trading/dual-gate";
import { IqSignalCard } from "@/components/trading/iq-signal-card";
import { BotData, SignalKey } from "@/components/trading/types";
import {
  Bot,
  Clock,
  TrendingUp,
  TrendingDown,
  Lock,
  Loader2,
  Volume2,
  VolumeX,
  KeyRound,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getActivation,
  timeLeftMs,
  trialRemaining,
  formatRemaining,
  PLANS,
  type BotType,
} from "@/lib/subscription";
import {
  playTriggerSound,
  playArmSound,
  unlockAudio,
} from "@/lib/sound";

type FilterKey = "ALL" | "SwitchX" | "PainX" | "GainX" | "BreakX";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "الكل" },
  { key: "SwitchX", label: "SwitchX" },
  { key: "PainX", label: "PainX" },
  { key: "GainX", label: "GainX" },
  { key: "BreakX", label: "BreakX" },
];

// === Per-bot lock checker (SUBSCRIPTION ONLY — no free trial) ===
function isBotUnlocked(bot: BotType): boolean {
  const rec = getActivation(bot);
  if (rec && timeLeftMs(bot) > 0) return true;
  // NO free trial — must have a valid code
  return false;
}

// === Per-bot lock screen ===
function BotLockScreen({ bot }: { bot: BotType }) {
  const isIq = bot === "iq_option";
  const botName = isIq ? "IQ Option" : "ALFA PRO";
  const color = isIq ? "#a855f7" : "#f59e0b";
  const prefix = isIq ? "IQ-" : "ALFA-";
  const Icon = isIq ? TrendingUp : Crown;

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border-2 p-6" style={{ borderColor: color + "30" }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: color + "20" }}>
        <Lock className="h-6 w-6" style={{ color }} />
      </div>
      <h3 className="text-sm font-bold" style={{ color }}>
        {botName}
      </h3>
      <p className="text-center text-[11px] text-zinc-400">
        هذا البوت مقفل.<br />أدخل كود {botName} لفتحه.
      </p>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: color + "30" }}>
        <KeyRound className="h-3.5 w-3.5" style={{ color }} />
        <span className="font-mono text-[10px] text-zinc-400">كود {prefix}XXXX-XXXX</span>
      </div>
      <p className="text-[9px] text-zinc-500">سجّل الخروج وأدخل الكود المناسب</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<BotData | null>(null);
  const [iqData, setIqData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [soundOn, setSoundOn] = useState(true);
  const [activeSide, setActiveSide] = useState<"alfa" | "iq">("alfa");
  const [iqFilter, setIqFilter] = useState<string>("ALL");
  // Re-render trigger — increments when a code is activated (from DualGate)
  const [unlockTick, setUnlockTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [alfaRes, iqRes] = await Promise.all([
        fetch("/api/signals", { cache: "no-store" }),
        fetch("/api/iq-signals", { cache: "no-store" }),
      ]);
      if (alfaRes.ok) {
        const json: BotData = await alfaRes.json();
        setData(json);
      }
      if (iqRes.ok) {
        setIqData(await iqRes.json());
      }
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const doFetch = () => { if (active) fetchData(); };
    doFetch();
    const id = setInterval(doFetch, 10000);
    return () => { active = false; clearInterval(id); };
  }, [soundOn]);

  // Re-check unlock status every 2 seconds (so IQ Option shows after code entry)
  useEffect(() => {
    const id = setInterval(() => setUnlockTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = data ? new Date(data.serverTime) : new Date();
      setClock(now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.serverTime]);

  const visibleCards = useMemo(() => {
    if (!data) return [];
    if (filter === "ALL") return data.cards;
    return data.cards.filter((c) => c.category === filter);
  }, [data, filter]);

  const isUp = (data?.change ?? 0) >= 0;
  const armedCount = data?.cards.filter((c) => c.triggered || c.confidence >= 75).length ?? 0;
  const connected = data?.mt5?.status === "connected";

  const toggleSound = () => {
    unlockAudio();
    setSoundOn((v) => !v);
  };

  // ===== Play sound when signals trigger or arm =====
  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const prevArmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data || !soundOn) return;

    const currentTriggered = new Set(data.cards.filter(c => c.triggered).map(c => c.id));
    const currentArmed = new Set(data.cards.filter(c => c.armed && !c.triggered).map(c => c.id));

    // New triggered signals → urgent sound
    const newTriggered = [...currentTriggered].filter(id => !prevTriggeredRef.current.has(id));
    if (newTriggered.length > 0) {
      playTriggerSound();
    }

    // New armed signals (not previously armed) → soft chime
    const newArmed = [...currentArmed].filter(id => !prevArmedRef.current.has(id) && !prevTriggeredRef.current.has(id));
    if (newArmed.length > 0) {
      playArmSound();
    }

    prevTriggeredRef.current = currentTriggered;
    prevArmedRef.current = currentArmed;
  }, [data, soundOn]);

  return (
    <DualGate>
      <main className="flex min-h-screen flex-col bg-[#0a0d16] text-foreground">
        <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />

        <div className="relative z-10 flex flex-1 flex-col">
          {/* ===== Top bar ===== */}
          <header className="sticky top-0 z-30 border-b border-amber-400/15 bg-[#0a0d16]/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg shadow-lg shadow-amber-500/20">
                  <img src="/alfa-pro-logo.png" alt="ALFA PRO" className="h-full w-full object-cover" />
                </div>
                <div>
                  <h1 className="font-mono text-sm font-bold leading-tight">
                    ALFA <span className="text-amber-400">PRO</span> + <span className="text-violet-400">IQ Option</span>
                  </h1>
                  <p className="text-[10px] leading-tight text-zinc-400">بوتي الإشارات</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={toggleSound} className={cn("flex items-center justify-center rounded-lg border p-1.5", soundOn ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-zinc-500")} title={soundOn ? "التنبيهات مفعّلة" : "التنبيهات مكتومة"}>
                  {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>
                <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1", connected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300")} title={connected ? "السيرفر يعمل" : "انقطع السيرفر"}>
                  {connected ? (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  <span className="text-[10px] font-bold">{connected ? "السيرفر متصل" : "انقطع"}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span className="font-mono text-[11px] font-semibold tnum">{clock}</span>
                </div>
              </div>
            </div>
            {/* Side switcher (mobile) */}
            <div className="mx-auto max-w-[1200px] px-4 pb-2 lg:hidden">
              <div className="flex gap-1 rounded-lg border border-white/10 bg-[#0d1119] p-1">
                <button onClick={() => setActiveSide("alfa")} className={cn("flex-1 rounded-md py-1.5 text-xs font-bold transition-all", activeSide === "alfa" ? "bg-amber-400/15 text-amber-300" : "text-zinc-400")}>
                  ALFA PRO
                </button>
                <button onClick={() => setActiveSide("iq")} className={cn("flex-1 rounded-md py-1.5 text-xs font-bold transition-all", activeSide === "iq" ? "bg-violet-400/15 text-violet-300" : "text-zinc-400")}>
                  IQ Option
                </button>
              </div>
            </div>
          </header>

          {/* ===== Split content ===== */}
          <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-3">
            {!data ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* ===== ALFA PRO side — only shows if unlocked ===== */}
                <div className={cn("space-y-3", activeSide !== "alfa" && "hidden lg:block")}>
                  {/* unlockTick forces re-check of isBotUnlocked every 2s */}
                  {unlockTick >= 0 && isBotUnlocked("alfa_pro") ? (
                    <>
                      <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 to-transparent px-3 py-2">
                        <Bot className="h-5 w-5 text-amber-400" />
                        <span className="text-sm font-bold text-amber-300">ALFA PRO</span>
                        <span className="text-[10px] text-zinc-400">— عرض/طلب + ترند + فوليوم (M1/M5)</span>
                        <span className="mr-auto text-[10px] text-zinc-500">{armedCount} إشارة قوية</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-1">
                        {FILTERS.map((f) => {
                          const count = f.key === "ALL" ? data.cards.length : data.cards.filter((c) => c.category === f.key).length;
                          return (
                            <button key={f.key} onClick={() => setFilter(f.key)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold", filter === f.key ? "border-amber-400/60 bg-amber-400/15 text-amber-300" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10")}>
                              {f.label}<span className="mr-1 text-[9px] opacity-70">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-3">
                        {visibleCards.map((card, i) => (
                          <SignalCard key={card.id} card={card} index={i} currentPrice={data.price} realSymbol={data.realSymbol} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <BotLockScreen bot="alfa_pro" />
                  )}
                </div>

                {/* ===== IQ Option side — only shows if unlocked ===== */}
                <div className={cn("space-y-3", activeSide !== "iq" && "hidden lg:block")}>
                  {unlockTick >= 0 && isBotUnlocked("iq_option") ? (
                    <>
                      <div className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-500/10 to-transparent px-3 py-2">
                        <TrendingUp className="h-5 w-5 text-violet-400" />
                        <span className="text-sm font-bold text-violet-300">IQ Option</span>
                        <span className="text-[10px] text-zinc-400">— أسعار حقيقية</span>
                      </div>
                      {/* Asset filter */}
                      <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1">
                        <button onClick={() => setIqFilter("ALL")} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all", iqFilter === "ALL" ? "border-violet-400/60 bg-violet-400/15 text-violet-300" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10")}>
                          الكل
                        </button>
                        {iqData?.cards?.map((c: any) => c.symbol).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).map((sym: string) => (
                          <button key={sym} onClick={() => setIqFilter(sym)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all", iqFilter === sym ? "border-violet-400/60 bg-violet-400/15 text-violet-300" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10")}>
                            {sym}
                          </button>
                        ))}
                      </div>
                      {/* Filtered cards */}
                      <div className="space-y-2.5">
                        {iqData?.cards?.filter((c: any) => iqFilter === "ALL" || c.symbol === iqFilter).map((card: any, i: number) => (
                          <IqSignalCard key={card.id} card={card} index={i} />
                        )) || (
                          <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <BotLockScreen bot="iq_option" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== Footer ===== */}
          <footer className="mt-auto border-t border-amber-400/15 bg-[#0a0d16]/80 py-3 backdrop-blur-sm">
            <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-1.5 px-4 text-center sm:flex-row sm:text-right">
              <span className="font-mono text-[11px] font-semibold">
                ALFA <span className="text-amber-400">PRO</span> + <span className="text-violet-400">IQ Option</span>
              </span>
              <div className="flex items-center gap-2.5 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
                  {connected ? "أسعار حقيقية" : "البث مباشر"}
                </span>
                <span>•</span>
                <span>{soundOn ? "تنبيهات مفعّلة" : "صامت"}</span>
                <span>•</span>
                <span className="font-mono tnum">{clock}</span>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </DualGate>
  );
}
