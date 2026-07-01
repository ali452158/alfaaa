"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Clock,
  Smartphone,
  Crown,
  LogOut,
  TrendingUp,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANS,
  validateCode,
  getActivation,
  activate,
  clearActivation,
  timeLeftMs,
  formatRemaining,
  isCodeUsedOnOtherDevice,
  markCodeAsUsed,
  trialRemaining,
  type BotType,
} from "@/lib/subscription";

interface Props {
  children: React.ReactNode;
}

const TRIAL_MS = 24 * 60 * 60 * 1000;
const TRIAL_KEY_ALFA = "alfa_pro_trial_start";
const TRIAL_KEY_IQ = "iq_option_trial_start";

function getTrialStart(bot: BotType): number {
  if (typeof window === "undefined") return 0;
  const key = bot === "iq_option" ? TRIAL_KEY_IQ : TRIAL_KEY_ALFA;
  const stored = window.localStorage.getItem(key);
  if (stored) return parseInt(stored, 10) || 0;
  const now = Date.now();
  window.localStorage.setItem(key, String(now));
  return now;
}

type GateState = "loading" | "active" | "locked";

// Which bots are currently active (SUBSCRIPTION ONLY — no free trial)
function getActiveBots(): { alfa: boolean; iq: boolean; alfaLabel: string; iqLabel: string; alfaRemaining: number; iqRemaining: number } {
  // ALFA — only active if there's a valid subscription code
  let alfa = false;
  let alfaLabel = "";
  let alfaRemaining = 0;
  const alfaRec = getActivation("alfa_pro");
  if (alfaRec && timeLeftMs("alfa_pro") > 0) {
    alfa = true;
    const def = PLANS.find((p) => p.type === alfaRec.plan);
    alfaLabel = def?.labelAr ?? alfaRec.plan;
    alfaRemaining = timeLeftMs("alfa_pro");
  }
  // NO free trial — must have a code

  // IQ — only active if there's a valid subscription code
  let iq = false;
  let iqLabel = "";
  let iqRemaining = 0;
  const iqRec = getActivation("iq_option");
  if (iqRec && timeLeftMs("iq_option") > 0) {
    iq = true;
    const def = PLANS.find((p) => p.type === iqRec.plan);
    iqLabel = def?.labelAr ?? iqRec.plan;
    iqRemaining = timeLeftMs("iq_option");
  }
  // NO free trial — must have a code

  return { alfa, iq, alfaLabel, iqLabel, alfaRemaining, iqRemaining };
}

export function DualGate({ children }: Props) {
  const [gateState, setGateState] = useState<GateState>("loading");
  const [activeBots, setActiveBots] = useState(getActiveBots());
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const check = () => {
      const bots = getActiveBots();
      setActiveBots(bots);
      if (bots.alfa || bots.iq) {
        setGateState("active");
      } else {
        setGateState("locked");
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 8) {
      setMsg({ ok: false, text: "أدخل كود الاشتراك كاملاً" });
      return;
    }
    setBusy(true);
    setMsg(null);
    setTimeout(() => {
      const result = validateCode(code);
      if (!result) {
        setMsg({ ok: false, text: "كود غير صحيح أو مزوّر." });
        setBusy(false);
        return;
      }

      const codeKey = `${result.bot}-${result.plan}-${result.uniqueId}`;
      if (isCodeUsedOnOtherDevice(codeKey)) {
        setMsg({ ok: false, text: "⚠️ هذا الكود مُستخدم على جهاز آخر. كل كود يعمل على جهاز واحد فقط." });
        setBusy(false);
        return;
      }

      // Activate for the correct bot
      const botName = result.bot === "iq_option" ? "IQ Option" : "ALFA PRO";
      activate(result.bot, result.plan, result.days, result.uniqueId);
      markCodeAsUsed(codeKey);
      const def = PLANS.find((p) => p.type === result.plan);

      setMsg({
        ok: true,
        text: `تم تفعيل ${botName} — اشتراك ${def?.labelAr} لمدة ${result.days} يوم`,
      });
      setCode("");
      setBusy(false);
      // Re-check active bots
      setTimeout(() => {
        const bots = getActiveBots();
        setActiveBots(bots);
        if (bots.alfa || bots.iq) setGateState("active");
      }, 500);
    }, 600);
  };

  const handleLogoutAll = () => {
    // Clear subscriptions — no trial to worry about anymore
    clearActivation("alfa_pro");
    clearActivation("iq_option");
    // Force locked state immediately
    setGateState("locked");
    setActiveBots({ alfa: false, iq: false, alfaLabel: "", iqLabel: "", alfaRemaining: 0, iqRemaining: 0 });
  };

  if (gateState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d16]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (gateState === "active") {
    return (
      <>
        {children}
        {/* Single logout button + dual indicators (bottom-left) */}
        <div className="fixed bottom-3 left-3 z-40 flex items-center gap-1.5">
          {/* ALFA indicator */}
          {activeBots.alfa && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-[#0a0d16]/85 px-2 py-1 backdrop-blur">
              <Crown className="h-3 w-3 text-amber-400" />
              <span className="text-[9px] font-bold text-amber-300">{activeBots.alfaLabel}</span>
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="font-mono text-[9px] font-semibold tnum text-amber-300">
                {formatRemaining(activeBots.alfaRemaining)}
              </span>
            </div>
          )}
          {/* IQ indicator */}
          {activeBots.iq && (
            <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-[#0a0d16]/85 px-2 py-1 backdrop-blur">
              <TrendingUp className="h-3 w-3 text-violet-400" />
              <span className="text-[9px] font-bold text-violet-300">{activeBots.iqLabel}</span>
              <Clock className="h-3 w-3 text-violet-400" />
              <span className="font-mono text-[9px] font-semibold tnum text-violet-300">
                {formatRemaining(activeBots.iqRemaining)}
              </span>
            </div>
          )}
          {/* Single logout button */}
          <button
            onClick={handleLogoutAll}
            title="خروج من الكل"
            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 backdrop-blur transition-colors hover:bg-rose-500/20"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </>
    );
  }

  // ===== Locked — SINGLE login screen =====
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0a0d16] p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-[#0d1119] shadow-2xl"
      >
        <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -left-1 -bottom-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />

        {/* header */}
        <div className="flex flex-col items-center gap-3 border-b border-amber-400/20 bg-gradient-to-b from-amber-500/10 to-transparent px-6 py-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Lock className="h-8 w-8 text-zinc-900" />
          </div>
          <div className="text-center">
            <h1 className="font-mono text-xl font-bold tracking-tight">
              ALFA <span className="text-amber-400">PRO</span> + <span className="text-violet-400">IQ Option</span>
            </h1>
            <p className="mt-1 text-xs text-zinc-400">انتهت الفترة التجريبية — أدخل كود الاشتراك</p>
          </div>
        </div>

        <div className="p-6">
          {/* Bot type hints */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300">ALFA PRO</span>
              <span className="text-[9px] text-zinc-500 mr-auto">كود ALFA-</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/5 px-2.5 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300">IQ Option</span>
              <span className="text-[9px] text-zinc-500 mr-auto">كود IQ-</span>
            </div>
          </div>

          {/* Single code input */}
          <form onSubmit={handleActivate} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
                كود الاشتراك (ALFA أو IQ)
              </label>
              <div className="relative">
                <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ALFA-M30-XXXX-XXXX  أو  IQ-M30-XXXX-XXXX"
                  dir="ltr"
                  autoFocus
                  className="w-full rounded-xl border border-amber-400/30 bg-[#0a0d16] px-3 py-3 text-center font-mono text-xs font-bold tracking-wider text-amber-300 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {msg && (
              <div
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-3 py-2 text-[11px]",
                  msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                )}
              >
                {msg.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? "جارٍ التحقق..." : "تفعيل"}
            </button>
          </form>

          {/* Request via Telegram */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-center text-[11px] text-zinc-400">ليس لديك كود؟ اطلب عبر تيليجرام</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://t.me/AlffaproBot?start=monthly"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-2 text-center transition-colors hover:bg-amber-400/20"
              >
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-300">ALFA PRO</span>
              </a>
              <a
                href="https://t.me/AlffaproBot?start=iq_monthly"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-400/10 px-2 py-2 text-center transition-colors hover:bg-violet-400/20"
              >
                <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[10px] font-bold text-violet-300">IQ Option</span>
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-zinc-500">
            <Smartphone className="h-3 w-3" />
            <span>الكود مرتبط بهذا الجهاز — كل بوت له أكواد خاصة</span>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
