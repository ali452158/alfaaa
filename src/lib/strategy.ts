// ===== ALFA PRO — Trading Strategy Engine =====
// يعتمد على: مناطق العرض والطلب + الترند + الفوليوم + فريم M1/M5
// الأزواج: مؤشرات صناعية على ويلتريد

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategySignal {
  symbol: string;
  direction: "BUY" | "SELL";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2: number;       // هدف ثاني
  riskRewardRatio: number;
  confidence: number;        // 0-100
  trend: "up" | "down" | "range";
  trendStrength: "strong" | "medium" | "weak";
  volumeSignal: "high" | "normal" | "low";
  supplyDemandZone: {
    type: "demand" | "supply";
    top: number;
    bottom: number;
    strength: "fresh" | "tested" | "weak";
  };
  timeframe: "M1" | "M5";
  reason: string;
  quality: "strong" | "medium" | "weak";
}

// ===== الأزواج المدعومة على ويلتريد (مؤشرات صناعية) =====
export const TRADING_SYMBOLS = [
  { symbol: "SwitchX 1200", display: "SwitchX 1200", category: "SwitchX", digits: 2 },
  { symbol: "SwitchX 1800", display: "SwitchX 1800", category: "SwitchX", digits: 2 },
  { symbol: "PainX 400",    display: "PainX 400",    category: "PainX",    digits: 2 },
  { symbol: "PainX 600",    display: "PainX 600",    category: "PainX",    digits: 2 },
  { symbol: "PainX 800",    display: "PainX 800",    category: "PainX",    digits: 2 },
  { symbol: "PainX 999",    display: "PainX 999",    category: "PainX",    digits: 2 },
  { symbol: "PainX 1200",   display: "PainX 1200",   category: "PainX",    digits: 2 },
  { symbol: "GainX 400",    display: "GainX 400",    category: "GainX",    digits: 2 },
  { symbol: "GainX 600",    display: "GainX 600",    category: "GainX",    digits: 2 },
  { symbol: "GainX 800",    display: "GainX 800",    category: "GainX",    digits: 2 },
  { symbol: "GainX 999",    display: "GainX 999",    category: "GainX",    digits: 2 },
  { symbol: "GainX 1200",   display: "GainX 1200",   category: "GainX",    digits: 2 },
  { symbol: "BreakX 600",   display: "BreakX 600",   category: "BreakX",   digits: 2 },
];

// ===== 1. حساب المتوسطات المتحركة (EMA) =====
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  // SMA seed
  let sma = 0;
  for (let i = 0; i < period; i++) sma += values[i];
  sma /= period;
  ema[period - 1] = sma;
  for (let i = period; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

// ===== 2. تحديد الترند =====
export function analyzeTrend(candles: Candle[]): {
  trend: "up" | "down" | "range";
  strength: "strong" | "medium" | "weak";
  ema20?: number;
  ema50?: number;
  ema200?: number;
} {
  if (candles.length < 50) return { trend: "range", strength: "weak" };

  const closes = candles.map((c) => c.close);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema200Arr = closes.length >= 200 ? calculateEMA(closes, 200) : [];

  const ema20 = ema20Arr[ema20Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : undefined;

  const price = closes[closes.length - 1];

  // ترند صاعد قوي: price > EMA20 > EMA50 > EMA200
  if (ema200 && price > ema20 && ema20 > ema50 && ema50 > ema200) {
    return { trend: "up", strength: "strong", ema20, ema50, ema200 };
  }
  // ترند هابط قوي: price < EMA20 < EMA50 < EMA200
  if (ema200 && price < ema20 && ema20 < ema50 && ema50 < ema200) {
    return { trend: "down", strength: "strong", ema20, ema50, ema200 };
  }
  // ترند صاعد متوسط: price > EMA20 > EMA50
  if (price > ema20 && ema20 > ema50) {
    return { trend: "up", strength: "medium", ema20, ema50, ema200 };
  }
  // ترند هابط متوسط
  if (price < ema20 && ema20 < ema50) {
    return { trend: "down", strength: "medium", ema20, ema50, ema200 };
  }
  // ترند ضعيف/عرضي
  return { trend: "range", strength: "weak", ema20, ema50, ema200 };
}

// ===== 3. تحديد مناطق العرض والطلب =====
export function findSupplyDemandZones(candles: Candle[]): {
  type: "demand" | "supply";
  top: number;
  bottom: number;
  strength: "fresh" | "tested" | "weak";
  index: number;
}[] {
  const zones: {
    type: "demand" | "supply";
    top: number;
    bottom: number;
    strength: "fresh" | "tested" | "weak";
    index: number;
  }[] = [];

  if (candles.length < 20) return zones;

  // ابحث عن swing points (قمم وقيعان)
  const lookback = 5;
  for (let i = lookback; i < candles.length - lookback; i++) {
    const candle = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= candle.high || candles[i + j].high >= candle.high) {
        isSwingHigh = false;
      }
      if (candles[i - j].low <= candle.low || candles[i + j].low <= candle.low) {
        isSwingLow = false;
      }
    }

    // منطقة عرض (Supply) - من swing high بحركة هبوطية قوية بعدها
    if (isSwingHigh) {
      const nextCandles = candles.slice(i + 1, i + 6);
      const dropMove = nextCandles.some((c) => (candle.high - c.low) > Math.abs(candle.high - candle.low) * 2);
      if (dropMove) {
        // تحقق إذا تم اختبار المنطقة
        const laterCandles = candles.slice(i + 6);
        const tested = laterCandles.some((c) => c.high >= candle.low && c.high <= candle.high);
        zones.push({
          type: "supply",
          top: candle.high,
          bottom: candle.low,
          strength: tested ? "tested" : "fresh",
          index: i,
        });
      }
    }

    // منطقة طلب (Demand) - من swing low بحركة صعودية قوية بعدها
    if (isSwingLow) {
      const nextCandles = candles.slice(i + 1, i + 6);
      const rallyMove = nextCandles.some((c) => (c.high - candle.low) > Math.abs(candle.high - candle.low) * 2);
      if (rallyMove) {
        const laterCandles = candles.slice(i + 6);
        const tested = laterCandles.some((c) => c.low >= candle.low && c.low <= candle.high);
        zones.push({
          type: "demand",
          top: candle.high,
          bottom: candle.low,
          strength: tested ? "tested" : "fresh",
          index: i,
        });
      }
    }
  }

  // خذ آخر 5 مناطق فقط
  return zones.slice(-5);
}

// ===== 4. تحليل الفوليوم =====
export function analyzeVolume(candles: Candle[]): {
  signal: "high" | "normal" | "low";
  average: number;
  current: number;
  ratio: number;
} {
  if (candles.length < 20) return { signal: "normal", average: 0, current: 0, ratio: 1 };

  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const average = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const current = candles[candles.length - 1].volume;
  const ratio = average > 0 ? current / average : 1;

  if (ratio > 1.5) return { signal: "high", average, current, ratio };
  if (ratio < 0.7) return { signal: "low", average, current, ratio };
  return { signal: "normal", average, current, ratio };
}

// ===== 5. حساب ATR لتحديد المخاطرة =====
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  const lastN = trueRanges.slice(-period);
  return lastN.reduce((a, b) => a + b, 0) / period;
}

// ===== 6. توليد الإشارة الرئيسية =====
export function generateSignal(
  symbol: string,
  display: string,
  digits: number,
  candlesM1: Candle[],
  candlesM5: Candle[],
  currentPrice: number
): StrategySignal | null {
  if (candlesM1.length < 50 || candlesM5.length < 50) return null;

  // تحليل الترند على M5 (الترند الرئيسي)
  const trendM5 = analyzeTrend(candlesM5);
  // تحليل الترند على M1 (الترند اللحظي)
  const trendM1 = analyzeTrend(candlesM1);

  // مناطق العرض والطلب على M5
  const zonesM5 = findSupplyDemandZones(candlesM5);
  // مناطق العرض والطلب على M1
  const zonesM1 = findSupplyDemandZones(candlesM1);

  // تحليل الفوليوم
  const volumeM1 = analyzeVolume(candlesM1);
  const volumeM5 = analyzeVolume(candlesM5);

  // ATR لتحديد وقف الخسارة
  const atrM5 = calculateATR(candlesM5, 14);
  const atrM1 = calculateATR(candlesM1, 14);
  const atr = Math.max(atrM5, atrM1);

  if (atr === 0) return null;

  // البحث عن أقرب منطقة طلب (للشراء) أو عرض (للبيع)
  const demandZones = [...zonesM5, ...zonesM1].filter((z) => z.type === "demand");
  const supplyZones = [...zonesM5, ...zonesM1].filter((z) => z.type === "supply");

  // ===== استراتيجية الشراء =====
  // شرط: ترند صاعد + السعر يقترب من منطقة طلب + فوليوم عالي
  let bestBuyZone = null;
  let minBuyDist = Infinity;
  for (const zone of demandZones) {
    const dist = Math.abs(currentPrice - zone.bottom);
    // السعر قريب من منطقة الطلب (ضمن 2 ATR)
    if (dist < atr * 2 && dist < minBuyDist) {
      minBuyDist = dist;
      bestBuyZone = zone;
    }
  }

  if (
    (trendM5.trend === "up" || trendM1.trend === "up") &&
    bestBuyZone &&
    (volumeM1.signal === "high" || volumeM5.signal === "high")
  ) {
    const entry = currentPrice;
    const stopLoss = bestBuyZone.bottom - atr * 0.5;
    const risk = entry - stopLoss;
    const takeProfit = entry + risk * 1.5;
    const takeProfit2 = entry + risk * 2.5;

    const confidence = calculateConfidence({
      trendM5: trendM5.trend,
      trendM1: trendM1.trend,
      trendStrength: trendM5.strength,
      volumeSignal: volumeM1.signal,
      zoneStrength: bestBuyZone.strength,
    });

    return {
      symbol: display,
      direction: "BUY",
      entry,
      stopLoss,
      takeProfit,
      takeProfit2,
      riskRewardRatio: 1.5,
      confidence,
      trend: trendM5.trend,
      trendStrength: trendM5.strength,
      volumeSignal: volumeM1.signal,
      supplyDemandZone: {
        type: "demand",
        top: bestBuyZone.top,
        bottom: bestBuyZone.bottom,
        strength: bestBuyZone.strength,
      },
      timeframe: "M5",
      reason: `منطقة طلب ${bestBuyZone.strength === "fresh" ? "جديدة" : "مختبرة"} + ترند ${trendM5.trend === "up" ? "صاعد" : "عرضي"} + فوليوم ${volumeM1.signal === "high" ? "عالي" : "عادي"}`,
      quality: confidence >= 75 ? "strong" : confidence >= 55 ? "medium" : "weak",
    };
  }

  // ===== استراتيجية البيع =====
  let bestSellZone = null;
  let minSellDist = Infinity;
  for (const zone of supplyZones) {
    const dist = Math.abs(currentPrice - zone.top);
    if (dist < atr * 2 && dist < minSellDist) {
      minSellDist = dist;
      bestSellZone = zone;
    }
  }

  if (
    (trendM5.trend === "down" || trendM1.trend === "down") &&
    bestSellZone &&
    (volumeM1.signal === "high" || volumeM5.signal === "high")
  ) {
    const entry = currentPrice;
    const stopLoss = bestSellZone.top + atr * 0.5;
    const risk = stopLoss - entry;
    const takeProfit = entry - risk * 1.5;
    const takeProfit2 = entry - risk * 2.5;

    const confidence = calculateConfidence({
      trendM5: trendM5.trend,
      trendM1: trendM1.trend,
      trendStrength: trendM5.strength,
      volumeSignal: volumeM1.signal,
      zoneStrength: bestSellZone.strength,
    });

    return {
      symbol: display,
      direction: "SELL",
      entry,
      stopLoss,
      takeProfit,
      takeProfit2,
      riskRewardRatio: 1.5,
      confidence,
      trend: trendM5.trend,
      trendStrength: trendM5.strength,
      volumeSignal: volumeM1.signal,
      supplyDemandZone: {
        type: "supply",
        top: bestSellZone.top,
        bottom: bestSellZone.bottom,
        strength: bestSellZone.strength,
      },
      timeframe: "M5",
      reason: `منطقة عرض ${bestSellZone.strength === "fresh" ? "جديدة" : "مختبرة"} + ترند ${trendM5.trend === "down" ? "هابط" : "عرضي"} + فوليوم ${volumeM1.signal === "high" ? "عالي" : "عادي"}`,
      quality: confidence >= 75 ? "strong" : confidence >= 55 ? "medium" : "weak",
    };
  }

  // ===== إذا لم تتوفر شروط مثالية، أنشئ إشارة بناءً على الترند فقط =====
  if (trendM5.strength === "strong" || trendM1.strength === "strong") {
    const isBuy = trendM5.trend === "up" || trendM1.trend === "up";
    const direction = isBuy ? "BUY" : "SELL";
    const entry = currentPrice;
    const stopLoss = isBuy ? entry - atr * 1.5 : entry + atr * 1.5;
    const risk = Math.abs(entry - stopLoss);
    const takeProfit = isBuy ? entry + risk * 1.5 : entry - risk * 1.5;
    const takeProfit2 = isBuy ? entry + risk * 2.5 : entry - risk * 2.5;

    const confidence = 55;
    return {
      symbol: display,
      direction,
      entry,
      stopLoss,
      takeProfit,
      takeProfit2,
      riskRewardRatio: 1.5,
      confidence,
      trend: trendM5.trend,
      trendStrength: trendM5.strength,
      volumeSignal: volumeM1.signal,
      supplyDemandZone: {
        type: isBuy ? "demand" : "supply",
        top: isBuy ? entry - atr : entry + atr,
        bottom: isBuy ? entry - atr * 2 : entry,
        strength: "weak",
      },
      timeframe: "M5",
      reason: `ترند ${trendM5.trend === "up" ? "صاعد" : trendM5.trend === "down" ? "هابط" : "عرضي"} قوي على M5`,
      quality: "medium",
    };
  }

  return null;
}

// ===== حساب درجة الثقة =====
function calculateConfidence(params: {
  trendM5: "up" | "down" | "range";
  trendM1: "up" | "down" | "range";
  trendStrength: "strong" | "medium" | "weak";
  volumeSignal: "high" | "normal" | "low";
  zoneStrength: "fresh" | "tested" | "weak";
}): number {
  let score = 50;
  // ترند M5
  if (params.trendM5 !== "range") score += 10;
  // ترند M1 مطابق لـ M5
  if (params.trendM1 === params.trendM5 && params.trendM5 !== "range") score += 15;
  // قوة الترند
  if (params.trendStrength === "strong") score += 15;
  else if (params.trendStrength === "medium") score += 8;
  // الفوليوم
  if (params.volumeSignal === "high") score += 12;
  else if (params.volumeSignal === "normal") score += 4;
  // قوة المنطقة
  if (params.zoneStrength === "fresh") score += 10;
  else if (params.zoneStrength === "tested") score += 5;
  return Math.min(95, Math.max(30, score));
}

// ===== توليد بيانات شموع وهمية للتحليل (عند عدم توفر بيانات حقيقية) =====
export function generateSimulatedCandles(
  basePrice: number,
  count: number,
  timeframe: "M1" | "M5"
): Candle[] {
  const candles: Candle[] = [];
  const volatility = timeframe === "M1" ? 0.0008 : 0.002;
  const intervalMs = timeframe === "M1" ? 60_000 : 300_000;
  let price = basePrice;
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    const open = price;
    const change = (Math.random() - 0.5) * volatility * basePrice;
    const close = Math.max(0.0001, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * basePrice * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * basePrice * 0.5;
    const volume = Math.floor(Math.random() * 1000) + 100;

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}
