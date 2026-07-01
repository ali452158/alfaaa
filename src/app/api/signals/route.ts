import { NextResponse } from "next/server";
import { getStatus, autoConnect, fetchTick, fetchCandles } from "@/lib/mt5";
import {
  TRADING_SYMBOLS,
  generateSignal,
  generateSimulatedCandles,
  type Candle,
} from "@/lib/strategy";

// ===== ALFA PRO — Trading Strategy API =====
// يعتمد على: مناطق العرض والطلب + الترند + الفوليوم + فريم M1/M5
// الأزواج: مؤشارات صناعية على ويلتريد
// البيانات: حقيقية من MT5 مع fallback للمحاكاة

// ===== Simulated fallback prices =====
const PRICE_FLOOR = 100.0;
const PRICE_CEIL = 3000.0;

const simPrices: Record<string, number> = {
  "SwitchX 1200": 1200.0,
  "SwitchX 1800": 1800.0,
  "PainX 400":    400.0,
  "PainX 600":    600.0,
  "PainX 800":    800.0,
  "PainX 999":    999.0,
  "PainX 1200":   1200.0,
  "GainX 400":    400.0,
  "GainX 600":    600.0,
  "GainX 800":    800.0,
  "GainX 999":    999.0,
  "GainX 1200":   1200.0,
  "BreakX 600":   600.0,
};

let lastUpdate = Date.now();
const sessionStart = Date.now();

function advanceSim() {
  const now = Date.now();
  const elapsed = now - lastUpdate;
  if (elapsed > 1500) {
    for (const sym of Object.keys(simPrices)) {
      const volatility = 0.003;
      const drift = (Math.random() - 0.5) * volatility * simPrices[sym];
      simPrices[sym] = Math.max(PRICE_FLOOR, Math.min(PRICE_CEIL, simPrices[sym] + drift));
    }
    lastUpdate = now;
  }
}

export async function GET() {
  advanceSim();
  const now = Date.now();

  // Trigger auto-connect (non-blocking, lazy)
  autoConnect();
  const mt5Status = getStatus();

  // Generate signals for all trading symbols
  const cards: any[] = [];

  for (const sym of TRADING_SYMBOLS) {
    let currentPrice: number;
    let candlesM1: Candle[] = [];
    let candlesM5: Candle[] = [];
    let isReal = false;

    // Try to fetch real data from MT5
    if (mt5Status.status === "connected") {
      const tick = await fetchTick(sym.symbol);
      if (tick && tick.bid > 0) {
        currentPrice = tick.bid;
        isReal = true;
        // Try to fetch candles (cached)
        candlesM5 = await fetchCandles(sym.symbol, "5m", 200);
        candlesM1 = await fetchCandles(sym.symbol, "1m", 200);
      } else {
        currentPrice = simPrices[sym.symbol];
      }
    } else {
      currentPrice = simPrices[sym.symbol];
    }

    // Fallback to simulated candles if real ones not available
    if (candlesM5.length < 50) {
      candlesM5 = generateSimulatedCandles(currentPrice, 200, "M5");
    }
    if (candlesM1.length < 50) {
      candlesM1 = generateSimulatedCandles(currentPrice, 200, "M1");
    }

    // Generate signal using strategy
    const signal = generateSignal(
      sym.symbol,
      sym.display,
      sym.digits,
      candlesM1,
      candlesM5,
      currentPrice
    );

    if (signal) {
      cards.push({
        id: `alfa-${sym.symbol}`,
        signalKey: sym.symbol,
        signalName: sym.display,
        category: sym.category,
        direction: signal.direction,
        accent: signal.direction === "BUY" ? "emerald" : "rose",
        entry: round(signal.entry, sym.digits),
        stopLoss: round(signal.stopLoss, sym.digits),
        takeProfit: round(signal.takeProfit, sym.digits),
        takeProfit2: round(signal.takeProfit2, sym.digits),
        riskRewardRatio: signal.riskRewardRatio,
        confidence: signal.confidence,
        trend: signal.trend,
        trendStrength: signal.trendStrength,
        volumeSignal: signal.volumeSignal,
        supplyDemandZone: {
          type: signal.supplyDemandZone.type,
          top: round(signal.supplyDemandZone.top, sym.digits),
          bottom: round(signal.supplyDemandZone.bottom, sym.digits),
          strength: signal.supplyDemandZone.strength,
        },
        timeframe: signal.timeframe,
        reason: signal.reason,
        quality: signal.quality,
        bid: round(currentPrice, sym.digits),
        ask: round(currentPrice + (sym.digits === 3 ? 0.01 : 0.01), sym.digits),
        realPrice: currentPrice,
        isReal,
        symbol: sym.display,
        digits: sym.digits,
        serverTime: now,
      });
    }
  }

  // Headline price
  const headlinePrice = cards.length > 0 ? cards[0].bid : simPrices["SwitchX 1200"];
  const realCount = cards.filter((c) => c.isReal).length;

  return NextResponse.json({
    symbol: "ALFA PRO",
    price: headlinePrice,
    change: 0,
    changePct: 0,
    serverTime: now,
    sessionStart,
    mt5: mt5Status,
    realSymbol: cards.find((c) => c.isReal)?.symbol || null,
    realSource: mt5Status.status === "connected" ? `MT5 · ${mt5Status.server}` : "محاكاة",
    realTickCount: realCount,
    cards,
    strategy: {
      name: "Supply & Demand + Trend + Volume",
      timeframes: ["M1", "M5"],
      symbols: TRADING_SYMBOLS.length,
    },
  });
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
