export type SignalKey = string;
export type AccentColor = "amber" | "rose" | "emerald" | "violet";
export type Direction = "SELL" | "BUY";

export interface SignalCardData {
  id: string;
  signalKey: SignalKey;
  signalName: string;
  category?: string;
  direction: Direction;
  accent: AccentColor;
  // ===== Strategy fields =====
  entry: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2?: number;
  riskRewardRatio?: number;
  confidence: number;
  trend?: "up" | "down" | "range";
  trendStrength?: "strong" | "medium" | "weak";
  volumeSignal?: "high" | "normal" | "low";
  supplyDemandZone?: {
    type: "demand" | "supply";
    top: number;
    bottom: number;
    strength: "fresh" | "tested" | "weak";
  };
  timeframe?: "M1" | "M5";
  reason?: string;
  // ===== Legacy fields (kept for compatibility) =====
  level?: number;
  stopMinutes?: number;
  percentage?: number;
  quality: "strong" | "medium" | "weak";
  tradeStatus?: "active" | "expired" | "taken";
  verificationText?: string;
  subscribed?: boolean;
  bid: number | null;
  ask: number | null;
  realPrice: number;
  distance?: number;
  distancePct?: number;
  status?: "above" | "below" | "near";
  armed?: boolean;
  active?: boolean;
  triggered?: boolean;
  isReal: boolean;
  indexInSignal?: number;
  symbol?: string;
  digits?: number;
  serverTime?: number;
}

export const qualityStyle: Record<
  "strong" | "medium" | "weak",
  { label: string; bg: string; text: string; icon: string }
> = {
  strong: {
    label: "قوية",
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    icon: "strong",
  },
  medium: {
    label: "متوسطة",
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    icon: "medium",
  },
  weak: {
    label: "ضعيفة",
    bg: "bg-rose-500/20",
    text: "text-rose-300",
    icon: "weak",
  },
};

export interface MT5Status {
  status: "disconnected" | "connecting" | "deploying" | "connected" | "error";
  accountId: string | null;
  login: string | null;
  server: string | null;
  symbols: string[];
  connectedAt: number | null;
  error: string | null;
}

export interface BotData {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  serverTime: number;
  sessionStart: number;
  mt5: MT5Status;
  realSymbol: string | null;
  realSource: string | null;
  cards: SignalCardData[];
}

// Direction styling — matching the reference screenshot exactly
// SELL: dark red bg (#9B2C2C) + bright red text
// BUY: dark green bg + bright green text
// SWITCH: gold bg + dark text
// BREAK: dark violet bg + violet text
export const directionStyle: Record<
  Direction,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    text: string;
    ring: string;
  }
> = {
  SELL: {
    label: "SELL",
    badgeBg: "bg-[#9B2C2C]",
    badgeText: "text-rose-400",
    border: "border-rose-500/50",
    text: "text-rose-400",
    ring: "ring-rose-500/30",
  },
  BUY: {
    label: "BUY",
    badgeBg: "bg-[#2A4E52]",
    badgeText: "text-emerald-400",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  SWITCH: {
    label: "SWITCH",
    badgeBg: "bg-[#8B4513]",
    badgeText: "text-amber-400",
    border: "border-amber-500/50",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
  },
  BREAK: {
    label: "BREAK",
    badgeBg: "bg-[#4A1D4A]",
    badgeText: "text-violet-400",
    border: "border-violet-500/50",
    text: "text-violet-400",
    ring: "ring-violet-500/30",
  },
};

export const accentColor: Record<AccentColor, string> = {
  amber: "#f59e0b",
  rose: "#f43f5e",
  emerald: "#10b981",
  violet: "#a855f7",
};
