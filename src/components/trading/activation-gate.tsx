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
  Calendar,
  LogOut,
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
} from "@/lib/subscription";

interface Props {
  children: React.ReactNode;
}

// ===== Trial storage (separate from subscription codes) =====
const TRIAL_KEY = "alfa_pro_trial_start";
const TRIAL_MS = 24 * 60 * 60 * 1000; // 24 hours

type GateState = "loading" | "active" | "locked";

function getTrialStart(): number {
  if (typeof window === "undefined") return 0;
  const stored = window.localStorage.getItem(TRIAL_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n)) return n;
  }
  // first visit: set now
  const now = Date.now();
  window.localStorage.setItem(TRIAL_KEY, String(now));
  return now;
}

function trialRemaining(): number {
  return TRIAL_MS - (Date.now() - getTrialStart());
}

export function ActivationGate({ children }: Props) {
  const [gateState, setGateState] = useState<GateState>("loading");
  const [remaining, setRemaining] = useState(0);
  const [planLabel, setPlanLabel] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const check = () => {
      // 1. Check if there's an active subscription code
      const rec = getActivation();
      if (rec) {
        const left = timeLeftMs();
        if (left > 0) {
          const def = PLANS.find((p) => p.type === rec.plan);
          setPlanLabel(def?.labelAr ?? rec.plan);
          setRemaining(left);
          setGateState("active");
          return;
        }
      }
      // 2. Check if trial is still active
      const trialLeft = trialRemaining();
      if (trialLeft > 0) {
        setPlanLabel("تجربة");
        setRemaining(trialLeft);
        setGateState("active");
        return;
      }
      // 3. Both expired — show subscription screen
      setGateState("locked");
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, []);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 10) {
      setMsg({ ok: false, text: "أدخل كود الاشتراك كاملاً" });
      return;
    }
    setBusy(true);
    setMsg(null);
    setTimeout(() => {
      const result = validateCode(code);
      if (result) {
        const codeKey = `${result.plan}-${result.uniqueId}`;
        if (isCodeUsedOnOtherDevice(codeKey)) {
          setMsg({
            ok: false,
            text: "⚠️ هذا الكود مُستخدم بالفعل على جهاز آخر. كل كود يعمل على جهاز واحد فقط.",
          });
          setBusy(false);
          return;
        }
        const rec = activate(result.plan, result.days, result.uniqueId);
        markCodeAsUsed(codeKey);
        const def = PLANS.find((p) => p.type === result.plan);
        setPlanLabel(def?.labelAr ?? result.plan);
        setRemaining(timeLeftMs());
        setGateState("active");
        const expiryDate = new Date(rec.expiresAt);
        const expiryStr = expiryDate.toLocaleDateString("ar-EG", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        });
        setMsg({
          ok: true,
          text: `تم تفعيل اشتراك ${def?.labelAr ?? result.plan} — ينتهي في ${expiryStr}`,
        });
        setCode("");
      } else {
        setMsg({
          ok: false,
          text: "كود اشتراك غير صحيح أو مزوّر. تأكد من الكود وحاول مرة أخرى.",
        });
      }
      setBusy(false);
    }, 600);
  };

  const handleLogout = () => {
    clearActivation();
    setGateState("locked");
    setRemaining(0);
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
        {/* subscription indicator + logout (bottom-left) */}
        <div className="fixed bottom-3 left-3 z-40 flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-[#0a0d16]/85 px-2 py-1 backdrop-blur"
            title={`الخطة: ${planLabel} — متبقي ${formatRemaining(remaining)}`}
          >
            <Crown className="h-3 w-3 text-amber-400" />
            <span className="text-[9px] font-bold text-amber-300">{planLabel}</span>
            <span className="text-zinc-600">•</span>
            <Clock className="h-3 w-3 text-amber-400" />
            <span className="font-mono text-[10px] font-semibold tnum text-amber-300">
              {formatRemaining(remaining)}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="خروج / إلغاء الاشتراك"
            className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 backdrop-blur transition-colors hover:bg-rose-500/20"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </>
    );
  }

  // locked — subscription required
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0a0d16] p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-[460px] overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-[#0d1119] shadow-2xl"
      >
        <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -left-1 -bottom-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />
        <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-amber-400 bg-[#0a0d16]" />

        {/* header */}
        <div className="flex flex-col items-center gap-3 border-b border-amber-400/20 bg-gradient-to-b from-amber-500/10 to-transparent px-6 py-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Crown className="h-8 w-8 text-zinc-900" />
          </div>
          <div className="text-center">
            <h1 className="font-mono text-xl font-bold tracking-tight">
              ALFA <span className="text-amber-400">PRO</span>
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              انتهت الفترة التجريبية — اشترك للمتابعة
            </p>
          </div>
        </div>

        <div className="custom-scroll max-h-[70vh] overflow-y-auto p-6">
          {/* plans table */}
          <div className="mb-4">
            <h3 className="mb-2 text-[11px] font-bold text-zinc-400">خطط الاشتراك</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PLANS.filter((p) => p.type !== "trial").map((p) => (
                <div
                  key={p.type}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
                >
                  <div>
                    <div className="text-[10px] font-bold text-foreground">{p.labelAr}</div>
                    <div className="text-[9px] text-zinc-500">{p.days} يوم</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* activation form */}
          <form onSubmit={handleActivate} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
                كود الاشتراك
              </label>
              <div className="relative">
                <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ALFA-M30-XXXX-XXXX"
                  dir="ltr"
                  autoFocus
                  className="w-full rounded-xl border border-amber-400/30 bg-[#0a0d16] px-10 py-3 text-center font-mono text-sm font-bold tracking-wider text-amber-300 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {msg && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px]",
                  msg.ok
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-rose-500/10 text-rose-300"
                )}
              >
                {msg.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {busy ? "جارٍ التحقق..." : "تفعيل الاشتراك"}
            </button>
          </form>

          {/* Request subscription — opens Telegram bot with plan parameter */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-center text-[11px] text-zinc-400">
              ليس لديك كود؟ اطلب اشتراكاً عبر تيليجرام
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {PLANS.filter((p) => p.type !== "trial").map((p) => (
                <a
                  key={p.type}
                  href={`https://t.me/Alfalbot?start=${p.type}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/15 px-2 py-2 text-center transition-colors hover:bg-[#229ED9]/25"
                >
                  <svg className="mb-0.5 h-3.5 w-3.5 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                  </svg>
                  <span className="text-[10px] font-bold text-[#229ED9]">{p.labelAr}</span>
                  <span className="text-[9px] text-zinc-500">{p.days} يوم</span>
                </a>
              ))}
            </div>
            <p className="mt-2 text-center text-[9px] text-zinc-500">
              سيتم تحويلك لبوت تيليجرام لطلب الكود
            </p>
          </div>

          {/* info */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500">
              <Calendar className="h-3 w-3" />
              <span>كل كود صالح للمدة المحددة فقط</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500">
              <Smartphone className="h-3 w-3" />
              <span>الكود مرتبط بهذا الجهاز فقط</span>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
