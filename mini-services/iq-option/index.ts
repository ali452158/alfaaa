// ===== ALFA PRO — IQ Option price service =====
// Connects directly to IQ Option via WebSocket and fetches real-time prices.

import http from "http";
import { WebSocket } from "ws";

const EMAIL = "ali01155000@gmail.com";
const PASSWORD = "ali@0164569934";

const priceStore = new Map<string, { bid: number; ask: number; time: number }>();

// Asset IDs from IQ Option
const ASSETS: { name: string; id: number; display: string }[] = [
  { name: "EURUSD", id: 1, display: "EUR/USD" },
  { name: "GBPUSD", id: 2, display: "GBP/USD" },
  { name: "USDJPY", id: 3, display: "USD/JPY" },
  { name: "USDCHF", id: 4, display: "USD/CHF" },
  { name: "EURJPY", id: 5, display: "EUR/JPY" },
  { name: "AUDUSD", id: 6, display: "AUD/USD" },
  { name: "EURGBP", id: 7, display: "EUR/GBP" },
];

const ASSET_NAMES: Record<number, string> = {};
ASSETS.forEach((a) => (ASSET_NAMES[a.id] = a.display));

let requestId = 0;
function newRequestId(): string {
  return `${Math.floor(Date.now() / 1000)}_${requestId++}`;
}

async function login(): Promise<string> {
  const res = await fetch("https://auth.iqoption.com/api/v2/login", {
    method: "POST",
    headers: {
      Origin: "https://login.iqoption.com",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  });
  const data: any = await res.json();
  if (data.code !== "success") throw new Error("IQ Option login failed");
  console.log("✅ IQ Option login OK! user_id:", data.user_id);
  return data.ssid;
}

let wsRef: WebSocket | null = null;

async function connectAndSubscribe(ssid: string) {
  console.log("📡 Connecting to IQ Option WebSocket...");
  const ws = new WebSocket("wss://iqoption.com/echo/websocket");
  wsRef = ws;

  ws.on("open", () => {
    console.log("📡 WebSocket connected! Authenticating...");
    ws.send(JSON.stringify({ name: "ssid", msg: ssid }));

    // Subscribe to each asset after 2s (wait for auth)
    setTimeout(() => {
      ASSETS.forEach((asset) => {
        const subMsg = {
          name: "subscribeMessage",
          request_id: newRequestId(),
          local_time: Math.floor(Date.now() / 1000),
          msg: {
            name: "candle-generated",
            params: {
              routingFilters: {
                active_id: asset.id,
                size: 1,
              },
            },
          },
        };
        ws.send(JSON.stringify(subMsg));
      });
      console.log(`📡 Subscribed to ${ASSETS.length} forex assets`);

      // Also subscribe to "instrument-quote" for live bid/ask
      ASSETS.forEach((asset) => {
        const quoteMsg = {
          name: "subscribeMessage",
          request_id: newRequestId(),
          local_time: Math.floor(Date.now() / 1000),
          msg: {
            name: "instrument-quote",
            params: {
              routingFilters: {
                active_id: asset.id,
              },
            },
          },
        };
        ws.send(JSON.stringify(quoteMsg));
      });
      console.log(`📡 Subscribed to ${ASSETS.length} quote streams`);
    }, 2000);
  });

  ws.on("message", (raw: Buffer | string) => {
    try {
      const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());

      // Handle candle-generated (price updates)
      if (data.name === "candle-generated" && data.msg) {
        const activeId = data.msg.active_id;
        const name = ASSET_NAMES[activeId];
        if (name) {
          const price = data.msg.close || data.msg.value || data.msg.open;
          if (price && price > 0) {
            priceStore.set(name, {
              bid: price,
              ask: price + (price > 100 ? 0.01 : 0.00001),
              time: (data.msg.at || Math.floor(Date.now() / 1000)) * 1000,
            });
          }
        }
      }

      // Handle instrument-quote (live bid/ask)
      if (data.name === "instrument-quote" && data.msg) {
        const activeId = data.msg.active_id;
        const name = ASSET_NAMES[activeId];
        if (name && (data.msg.bid || data.msg.ask)) {
          priceStore.set(name, {
            bid: data.msg.bid,
            ask: data.msg.ask,
            time: Date.now(),
          });
        }
      }
    } catch {}
  });

  ws.on("error", (e) => console.error("❌ WS error:", e));
  ws.on("close", () => {
    console.log("⚠️ WebSocket closed, reconnecting in 5s...");
    wsRef = null;
    setTimeout(() => connectAndSubscribe(ssid).catch(() => {}), 5000);
  });
}

// Fetch metals & crypto via HTTP API (every 30s)
async function fetchExtraPrices(ssid: string) {
  const extras = [
    { name: "XAU/USD", id: 76 },
    { name: "XAG/USD", id: 77 },
    { name: "BTC/USD", id: 380 },
    { name: "ETH/USD", id: 381 },
  ];

  for (const asset of extras) {
    try {
      const res = await fetch(
        `https://api.iqoption.com/v1/candles/active/${asset.id}?duration=60&amount=1`,
        {
          headers: { Cookie: `ssid=${ssid}`, "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (res.ok) {
        const data: any = await res.json();
        const candle = data.candles?.[0];
        if (candle?.close) {
          priceStore.set(asset.name, {
            bid: candle.close,
            ask: candle.close + 0.01,
            time: candle.at * 1000,
          });
        }
      }
    } catch {}
  }
}

// ===== HTTP Server (Node.js native — works with tsx, no Bun needed) =====
const PORT = 3002;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "IQ Option Price Service",
      prices: priceStore.size,
      wsConnected: wsRef?.readyState === 1,
    }));
    return;
  }

  if (url.pathname === "/prices") {
    const prices: any[] = [];
    for (const [symbol, tick] of priceStore.entries()) {
      prices.push({
        symbol,
        bid: tick.bid,
        ask: tick.ask,
        time: tick.time,
        source: "IQ Option",
      });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, prices }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`🤖 IQ Option Price Service running on port ${PORT}`);
});

// Start
(async () => {
  try {
    const ssid = await login();
    await connectAndSubscribe(ssid);
    // Fetch metals/crypto every 30s
    setInterval(() => fetchExtraPrices(ssid), 30000);
    fetchExtraPrices(ssid);
  } catch (e: any) {
    console.error("❌ Failed to start:", e.message);
    // Retry in 30s
    setTimeout(() => process.exit(1), 30000);
  }
})();
