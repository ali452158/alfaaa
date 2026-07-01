"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Ban,
  Clock,
  Flame,
  Gauge,
  Leaf,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  card: any;
  index: number;
}

const qualityStyle: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  strong: { label: "قوية", bg: "bg-emerald-500/20", text: "text-emerald-300", icon: Flame },
  medium: { label: "متوسطة", bg: "bg-amber-500/20", text: "text-amber-300", icon: Gauge },
  weak: { label: "ضعيفة", bg: "bg-rose-500/20", text: "text-rose-300", icon: Leaf },
};

export function IqSignalCard({ card, index }: Props) {
  const [countdown, setCountdown] = useState(card.countdown || "00:00");

  useEffect(() => {
    if (!card.expiresAt) return;
    const update = () => {
      const remaining = Math.max(0, card.expiresAt - Date.now());
      const sec = Math.floor(remaining / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      setCountdown(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [card.expiresAt]);

  const isBuy = card.direction === "BUY";
  const isExpired = card.tradeStatus === "expired";
  const q = qualityStyle[card.quality] || qualityStyle.medium;
  const QIcon = q.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "relative overflow-hidden rounded-xl border-2",
        isExpired
          ? "border-rose-500/30 opacity-40"
          : isBuy
            ? "border-emerald-500/25"
            : "border-rose-500/25"
      )}
    >
      {/* ===== Top bar: direction (large) + symbol + live ===== */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2.5",
        isBuy ? "bg-emerald-950/40" : "bg-rose-950/40"
      )}>
        {/* Left: "صفقة شراء" or "صفقة بيع" (large, bold) */}
        <span className={cn(
          "text-base font-black sm:text-lg",
          isBuy ? "text-emerald-400" : "text-rose-400"
        )}>
          {isBuy ? "صفقة شراء" : "صفقة بيع"}
        </span>
        {/* Right: symbol icon + symbol name + مباشر badge */}
        <div className="flex items-center gap-1.5">
          {isBuy ? (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-rose-400" />
          )}
          <span className="font-mono text-xs font-bold text-white sm:text-sm">
            {card.symbol}
          </span>
          {card.isReal && (
            <span className="rounded bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">
              مباشر
            </span>
          )}
        </div>
      </div>

      {/* ===== Grid: 4 quadrants ===== */}
      <div className="grid grid-cols-2 gap-px bg-white/5">
        {/* Q1: المدة + العداد التنازلي */}
        <div className="bg-[#1a2030] p-2.5 text-center">
          <div className="mb-0.5 flex items-center justify-center gap-1 text-[9px] text-zinc-400">
            <Clock className="h-2.5 w-2.5" />
            المدة
          </div>
          <div className="font-mono text-sm font-black text-amber-400 tnum">
            {card.stopMinutes}د
          </div>
          <div className="mt-1">
            <div className="text-[8px] text-zinc-500">متبقي</div>
            <div className={cn(
              "font-mono text-xl font-black tnum leading-tight",
              countdown === "00:00" ? "text-rose-400" : "text-emerald-400 blink"
            )}>
              {countdown}
            </div>
          </div>
        </div>

        {/* Q2: الاتجاه */}
        <div className="bg-[#1a2030] p-2.5 text-center">
          <div className="mb-0.5 text-[9px] text-zinc-400">الاتجاه</div>
          <div className={cn(
            "flex flex-col items-center gap-0.5",
            isBuy ? "text-emerald-400" : "text-rose-400"
          )}>
            {isBuy ? (
              <TrendingUp className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )}
            <span className="text-xs font-black">
              {isBuy ? "صاعد ▲" : "هابط ▼"}
            </span>
          </div>
          {card.trendConfirmed ? (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[7px] font-bold text-emerald-300">
              <CheckCircle2 className="h-2 w-2" /> مؤكدة
            </span>
          ) : (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-rose-500/20 px-1 py-0.5 text-[7px] font-bold text-rose-300">
              <AlertTriangle className="h-2 w-2" /> عكس
            </span>
          )}
        </div>

        {/* Q3: الجودة */}
        <div className="bg-[#1a2030] p-2.5 text-center">
          <div className="mb-0.5 text-[9px] text-zinc-400">الجودة</div>
          <div className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg py-0.5",
            q.bg
          )}>
            <QIcon className={cn("h-5 w-5", q.text)} />
            <span className={cn("text-xs font-black", q.text)}>
              {q.label}
            </span>
          </div>
          <div className="mt-0.5 text-[8px] text-zinc-500">
            {card.percentage}%
          </div>
        </div>

        {/* Q4: السعر */}
        <div className="bg-[#1a2030] p-2.5 text-center">
          <div className="mb-0.5 text-[9px] text-zinc-400">السعر</div>
          <div className="font-mono text-xs font-bold text-white tnum">
            {card.bid?.toFixed(card.bid > 100 ? 2 : 5)}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-0.5 text-[7px]">
            <div>
              <div className="text-amber-400">دخول</div>
              <div className="font-mono text-zinc-300 tnum">{card.entry?.toFixed(card.entry > 100 ? 2 : 4)}</div>
            </div>
            <div>
              <div className="text-emerald-400">هدف</div>
              <div className="font-mono text-zinc-300 tnum">{card.target?.toFixed(card.target > 100 ? 2 : 4)}</div>
            </div>
            <div>
              <div className="text-rose-400">خروج</div>
              <div className="font-mono text-zinc-300 tnum">{card.exit?.toFixed(card.exit > 100 ? 2 : 4)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Status bar ===== */}
      <div className={cn(
        "flex items-center justify-center py-1 text-[9px] font-bold",
        isExpired
          ? "bg-rose-950/50 text-rose-300"
          : "bg-emerald-950/50 text-emerald-300"
      )}>
        {isExpired ? (
          <><Ban className="h-2.5 w-2.5" /> انتهت</>
        ) : (
          <><CheckCircle2 className="h-2.5 w-2.5 blink" /> متاحة</>
        )}
      </div>
    </motion.div>
  );
}
