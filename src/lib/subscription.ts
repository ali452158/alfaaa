// ===== ALFA PRO + IQ Option — Subscription code system (v4) =====
// Supports TWO separate bots, each with independent subscriptions.
// Bot type is encoded in the code prefix: A = ALFA PRO, I = IQ Option.
// FIXED: Proper expiry validation, one-time use per device, daily/weekly/monthly expiry

export type BotType = "alfa_pro" | "iq_option";
export type PlanType = "trial" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

interface PlanDef {
  type: PlanType;
  code: string;
  days: number;
  label: string;
  labelAr: string;
}

export const PLANS: PlanDef[] = [
  { type: "trial", code: "T", days: 1, label: "Trial", labelAr: "تجربة 24 ساعة" },
  { type: "daily", code: "D", days: 1, label: "Daily", labelAr: "يومي" },
  { type: "weekly", code: "W", days: 7, label: "Weekly", labelAr: "أسبوعي" },
  { type: "monthly", code: "M", days: 30, label: "Monthly", labelAr: "شهري" },
  { type: "quarterly", code: "Q", days: 90, label: "Quarterly", labelAr: "ربع سنوي" },
  { type: "yearly", code: "Y", days: 365, label: "Yearly", labelAr: "سنوي" },
];

const SECRET_SALT = "ALFA2026PRO-SECRET-KEY";

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}

export function generateCode(plan: PlanType, bot: BotType = "alfa_pro", uniqueId?: string): string {
  const def = PLANS.find((p) => p.type === plan);
  if (!def) throw new Error(`Unknown plan: ${plan}`);
  const botPrefix = bot === "iq_option" ? "IQ" : "ALFA";
  const id = (uniqueId || Math.random().toString(36).slice(2, 6)).toUpperCase();
  const checksum = hashString(`${botPrefix}-${def.code}-${def.days}-${id}-${SECRET_SALT}`).slice(0, 4);
  return `${botPrefix}-${def.code}${def.days}-${id}-${checksum}`;
}

export function validateCode(code: string): {
  bot: BotType;
  plan: PlanType;
  days: number;
  uniqueId: string;
} | null {
  const clean = code.trim().toUpperCase();
  // Match: ALFA-X##-####-#### OR IQ-X##-####-####
  const match = clean.match(/^(ALFA|IQ)-([A-Z])(\d+)-([A-Z0-9]{3,8})-([A-F0-9]{4})$/);
  if (!match) return null;
  const [, botPrefix, planCode, daysStr, id, checksum] = match;
  const def = PLANS.find((p) => p.code === planCode);
  if (!def) return null;
  const days = parseInt(daysStr, 10);
  if (days !== def.days) return null;
  const expected = hashString(`${botPrefix}-${def.code}-${def.days}-${id}-${SECRET_SALT}`).slice(0, 4);
  if (checksum !== expected) return null;
  return { bot: botPrefix === "IQ" ? "iq_option" : "alfa_pro", plan: def.type, days: def.days, uniqueId: id };
}

function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const props = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(","),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || 0),
    String(navigator.platform || ""),
  ].join("|");
  return hashString(props).slice(0, 12);
}

const ACTIVATION_PREFIX = "alfa_pro_code_";
const ACTIVE_CODE_KEY = "alfa_pro_active_code";
// IQ Option uses separate keys so subscriptions are independent
const IQ_ACTIVATION_PREFIX = "iq_option_code_";
const IQ_ACTIVE_CODE_KEY = "iq_option_active_code";
const IQ_TRIAL_KEY = "iq_option_trial_start";

interface ActivationRecord {
  plan: PlanType;
  uniqueId: string;
  deviceFingerprint: string;
  activatedAt: number;
  expiresAt: number;
  codeUsedCount: number; // Track how many times this code was used on this device
}

// ===== EXPIRY CALCULATION =====
// For daily: expires at end of today
// For weekly: expires at end of 7 days from today
// For monthly: expires at end of 30 days from today
function computeExpiry(days: number, fromTime: number): number {
  const now = new Date(fromTime);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // End of the target day (23:59:59.999)
  const endOfTargetDay = startOfToday + days * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1);
  return endOfTargetDay;
}

export function getActivation(bot: BotType = "alfa_pro"): ActivationRecord | null {
  if (typeof window === "undefined") return null;
  const prefix = bot === "iq_option" ? IQ_ACTIVATION_PREFIX : ACTIVATION_PREFIX;
  const activeKey = bot === "iq_option" ? IQ_ACTIVE_CODE_KEY : ACTIVE_CODE_KEY;
  try {
    const activeCode = window.localStorage.getItem(activeKey);
    if (!activeCode) return null;
    const raw = window.localStorage.getItem(prefix + activeCode);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ActivationRecord;
    const currentFp = getDeviceFingerprint();
    
    // ✅ CHECK 1: Device fingerprint must match
    if (rec.deviceFingerprint !== currentFp) {
      console.warn("[Subscription] Device fingerprint mismatch — code is for another device");
      return null;
    }
    
    // ✅ CHECK 2: Code must not be expired
    if (!rec.expiresAt || Date.now() > rec.expiresAt) {
      console.warn("[Subscription] Code expired");
      window.localStorage.removeItem(prefix + activeCode);
      window.localStorage.removeItem(activeKey);
      return null;
    }
    
    return rec;
  } catch (e) {
    console.error("[Subscription] Error reading activation:", e);
    return null;
  }
}

export function activate(bot: BotType, plan: PlanType, days: number, uniqueId: string): ActivationRecord | null {
  const prefix = bot === "iq_option" ? IQ_ACTIVATION_PREFIX : ACTIVATION_PREFIX;
  const activeKey = bot === "iq_option" ? IQ_ACTIVE_CODE_KEY : ACTIVE_CODE_KEY;
  
  if (typeof window === "undefined") {
    return { plan, uniqueId, deviceFingerprint: "server", activatedAt: Date.now(), expiresAt: Date.now() + days * 86400000, codeUsedCount: 1 };
  }
  
  const codeKey = `${plan}-${uniqueId}`;
  const currentFp = getDeviceFingerprint();
  
  // ✅ CHECK: Is this code already used on THIS device?
  const existingRaw = window.localStorage.getItem(prefix + codeKey);
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as ActivationRecord;
      
      // Same device — code already used
      if (existing.deviceFingerprint === currentFp) {
        console.warn("[Subscription] Code already used on this device");
        return null; // Code already activated on this device
      }
      
      // Different device — code is locked to another device
      console.warn("[Subscription] Code is locked to another device");
      return null;
    } catch (e) {
      console.error("[Subscription] Error parsing existing activation:", e);
    }
  }
  
  // ✅ NEW CODE: Create activation record
  const now = Date.now();
  const rec: ActivationRecord = {
    plan,
    uniqueId,
    deviceFingerprint: currentFp,
    activatedAt: now,
    expiresAt: computeExpiry(days, now),
    codeUsedCount: 1,
  };
  
  window.localStorage.setItem(prefix + codeKey, JSON.stringify(rec));
  window.localStorage.setItem(activeKey, codeKey);
  
  console.log(`[Subscription] Code activated: ${plan} (${days} days) on device ${currentFp.slice(0, 6)}...`);
  return rec;
}

export function clearActivation(bot: BotType = "alfa_pro") {
  if (typeof window === "undefined") return;
  const activeKey = bot === "iq_option" ? IQ_ACTIVE_CODE_KEY : ACTIVE_CODE_KEY;
  window.localStorage.removeItem(activeKey);
}

export function timeLeftMs(bot: BotType = "alfa_pro"): number {
  const rec = getActivation(bot);
  if (!rec) return 0;
  return Math.max(0, rec.expiresAt - Date.now());
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "منتهي";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}ي ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ===== Trial support for both bots =====
const TRIAL_MS = 24 * 60 * 60 * 1000;

export function getTrialStart(bot: BotType = "alfa_pro"): number {
  if (typeof window === "undefined") return 0;
  const key = bot === "iq_option" ? IQ_TRIAL_KEY : "alfa_pro_trial_start";
  const stored = window.localStorage.getItem(key);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n)) return n;
  }
  const now = Date.now();
  window.localStorage.setItem(key, String(now));
  return now;
}

export function trialRemaining(bot: BotType = "alfa_pro"): number {
  return TRIAL_MS - (Date.now() - getTrialStart(bot));
}

// Check if a bot (either one) is accessible — has active subscription or trial
export function isBotActive(bot: BotType = "alfa_pro"): boolean {
  const rec = getActivation(bot);
  if (rec && timeLeftMs(bot) > 0) return true;
  if (trialRemaining(bot) > 0) return true;
  return false;
}

// ===== IQ Option assets (same as what IQ Option offers) =====
export const IQ_ASSETS = [
  { symbol: "EUR/USD", name: "يورو/دولار", category: "فوركس" },
  { symbol: "GBP/USD", name: "إسترليني/دولار", category: "فوركس" },
  { symbol: "USD/JPY", name: "دولار/ين", category: "فوركس" },
  { symbol: "AUD/USD", name: "أسترالي/دولار", category: "فوركس" },
  { symbol: "USD/CHF", name: "دولار/فرنك", category: "فوركس" },
  { symbol: "XAU/USD", name: "ذهب", category: "معادن" },
  { symbol: "XAG/USD", name: "فضة", category: "معادن" },
  { symbol: "BTC/USD", name: "بيتكوين", category: "كريبتو" },
  { symbol: "ETH/USD", name: "إيثيريوم", category: "كريبتو" },
  { symbol: "XPT/USD", name: "بلاتين", category: "معادن" },
  { symbol: "XPD/USD", name: "بالاديوم", category: "معادن" },
];

