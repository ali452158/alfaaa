"use client";

import { useEffect, useState } from "react";
import {
  Crown,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  X,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, validateCode, type PlanType, type BotType } from "@/lib/subscription";

interface GeneratedCode {
  code: string;
  valid: boolean;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [bot, setBot] = useState<BotType>("alfa_pro");
  const [plan, setPlan] = useState<PlanType>("monthly");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<GeneratedCode[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("alfa_admin_key");
    if (saved) {
      setAdminKey(saved);
      setAuthed(true);
    }
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim().length < 5) {
      setMsg({ ok: false, text: "أدخل مفتاح الإدارة" });
      return;
    }
    sessionStorage.setItem("alfa_admin_key", adminKey.trim());
    setAuthed(true);
    setMsg(null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("alfa_admin_key");
    setAuthed(false);
    setAdminKey("");
    setCodes([]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, count, adminKey: adminKey.trim(), bot }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCodes(data.codes || []);
        setMsg({ ok: true, text: `تم توليد ${data.codes.length} كود بنجاح` });
      } else {
        setMsg({ ok: false, text: data?.error || "فشل توليد الأكواد" });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || e).slice(0, 80) });
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const downloadCodes = () => {
    const botName = bot === "iq_option" ? "IQ Option" : "ALFA PRO";
    const def = PLANS.find((p) => p.type === plan);
    const content = `${botName} — أكواد ${def?.labelAr}\n${new Date().toLocaleString("ar-EG")}\n${"=".repeat(30)}\n${codes.map((c) => c.code).join("\n")}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bot}-codes-${plan}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0d16] p-4 text-foreground">
        <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />
        <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-[#0d1119] p-6 shadow-2xl">
          <div className="mb-4 flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <Crown className="h-7 w-7 text-zinc-900" />
            </div>
            <h1 className="font-mono text-lg font-bold">
              ALFA PRO — لوحة الإدارة
            </h1>
            <p className="text-[11px] text-zinc-400">أدخل مفتاح الإدارة للمتابعة</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
              <input
                type={showKey ? "text" : "password"}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="مفتاح الإدارة"
                dir="ltr"
                autoFocus
                className="w-full rounded-xl border border-amber-400/30 bg-[#0a0d16] px-10 py-3 text-center font-mono text-sm font-bold text-amber-300 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-amber-400"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {msg && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                <AlertCircle className="h-3.5 w-3.5" />
                {msg.text}
              </div>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-900 hover:bg-amber-400"
            >
              <KeyRound className="h-4 w-4" />
              دخول
            </button>
          </form>
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-amber-200/80">
            💡 مفتاح الإدارة الافتراضي: <code className="font-mono font-bold">ALFA-ADMIN-2026</code>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0d16] p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />
      <div className="relative z-10 mx-auto max-w-[640px]">
        {/* header */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-400/30 bg-[#0d1119] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <Crown className="h-5 w-5 text-zinc-900" />
            </div>
            <div>
              <h1 className="font-mono text-base font-bold">
                مولّد الأكواد
              </h1>
              <p className="text-[10px] text-zinc-400">لوحة إدارة الاشتراكات</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20"
          >
            <X className="h-3.5 w-3.5" />
            خروج
          </button>
        </div>

        {/* generator form */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#0d1119] p-4">
          <h2 className="mb-3 text-sm font-bold text-amber-400">توليد أكواد جديدة</h2>
          <form onSubmit={handleGenerate} className="space-y-3">
            {/* Bot selector */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">اختر البوت:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBot("alfa_pro")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center transition-all",
                    bot === "alfa_pro"
                      ? "border-amber-400 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  )}
                >
                  <span className="text-xs font-bold">ALFA PRO</span>
                  <div className="text-[9px] text-zinc-500">SwitchX · PainX · GainX</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBot("iq_option")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center transition-all",
                    bot === "iq_option"
                      ? "border-amber-400 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  )}
                >
                  <span className="text-xs font-bold">IQ Option</span>
                  <div className="text-[9px] text-zinc-500">فوركس · معادن · كريبتو</div>
                </button>
              </div>
            </div>

            {/* plan selector */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">اختر الخطة:</label>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {PLANS.filter((p) => p.type !== "trial").map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => setPlan(p.type)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center transition-all",
                      plan === p.type
                        ? "border-amber-400 bg-amber-400/15 text-amber-300"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    )}
                  >
                    <div className="text-[10px] font-bold">{p.labelAr}</div>
                    <div className="text-[9px] text-zinc-500">{p.days} يوم</div>
                  </button>
                ))}
              </div>
            </div>

            {/* count */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">عدد الأكواد:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-white/10 bg-[#0a0d16] px-3 py-2 text-sm text-foreground focus:border-amber-400/50 focus:outline-none"
              />
            </div>

            {msg && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px]",
                  msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                )}
              >
                {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {busy ? "جارٍ التوليد..." : `توليد ${count} كود (${bot === "iq_option" ? "IQ Option" : "ALFA PRO"} — ${PLANS.find((p) => p.type === plan)?.labelAr})`}
            </button>
          </form>
        </div>

        {/* generated codes */}
        {codes.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0d1119] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-400">الأكواد المولّدة ({codes.length})</h2>
              <button
                onClick={downloadCodes}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:bg-white/10"
              >
                <Download className="h-3 w-3" /> تنزيل
              </button>
            </div>
            <div className="space-y-1.5">
              {codes.map((c, i) => {
                const validation = validateCode(c.code);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500 tnum">{String(i + 1).padStart(2, "0")}.</span>
                      <span className="font-mono text-xs font-bold text-amber-300 sm:text-sm">{c.code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {validation && (
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold",
                          validation.bot === "iq_option"
                            ? "bg-violet-500/15 text-violet-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        )}>
                          {validation.bot === "iq_option" ? "IQ" : "ALFA"} · {PLANS.find((p) => p.type === validation.plan)?.labelAr}
                        </span>
                      )}
                      <button onClick={() => copyCode(c.code)} className="rounded p-1 text-zinc-400 hover:text-amber-400">
                        {copied === c.code ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
