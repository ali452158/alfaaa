"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// mini-services/iq-option/index.ts
var import_http = __toESM(require("http"), 1);
var import_ws = require("ws");
var EMAIL = "ali01155000@gmail.com";
var PASSWORD = "ali@0164569934";
var priceStore = /* @__PURE__ */ new Map();
var ASSETS = [
  { name: "EURUSD", id: 1, display: "EUR/USD" },
  { name: "GBPUSD", id: 2, display: "GBP/USD" },
  { name: "USDJPY", id: 3, display: "USD/JPY" },
  { name: "USDCHF", id: 4, display: "USD/CHF" },
  { name: "EURJPY", id: 5, display: "EUR/JPY" },
  { name: "AUDUSD", id: 6, display: "AUD/USD" },
  { name: "EURGBP", id: 7, display: "EUR/GBP" }
];
var ASSET_NAMES = {};
ASSETS.forEach((a) => ASSET_NAMES[a.id] = a.display);
var requestId = 0;
function newRequestId() {
  return `${Math.floor(Date.now() / 1e3)}_${requestId++}`;
}
async function login() {
  const res = await fetch("https://auth.iqoption.com/api/v2/login", {
    method: "POST",
    headers: {
      Origin: "https://login.iqoption.com",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD })
  });
  const data = await res.json();
  if (data.code !== "success") throw new Error("IQ Option login failed");
  console.log("\u2705 IQ Option login OK! user_id:", data.user_id);
  return data.ssid;
}
var wsRef = null;
async function connectAndSubscribe(ssid) {
  console.log("\u{1F4E1} Connecting to IQ Option WebSocket...");
  const ws = new import_ws.WebSocket("wss://iqoption.com/echo/websocket");
  wsRef = ws;
  ws.on("open", () => {
    console.log("\u{1F4E1} WebSocket connected! Authenticating...");
    ws.send(JSON.stringify({ name: "ssid", msg: ssid }));
    setTimeout(() => {
      ASSETS.forEach((asset) => {
        const subMsg = {
          name: "subscribeMessage",
          request_id: newRequestId(),
          local_time: Math.floor(Date.now() / 1e3),
          msg: {
            name: "candle-generated",
            params: {
              routingFilters: {
                active_id: asset.id,
                size: 1
              }
            }
          }
        };
        ws.send(JSON.stringify(subMsg));
      });
      console.log(`\u{1F4E1} Subscribed to ${ASSETS.length} forex assets`);
      ASSETS.forEach((asset) => {
        const quoteMsg = {
          name: "subscribeMessage",
          request_id: newRequestId(),
          local_time: Math.floor(Date.now() / 1e3),
          msg: {
            name: "instrument-quote",
            params: {
              routingFilters: {
                active_id: asset.id
              }
            }
          }
        };
        ws.send(JSON.stringify(quoteMsg));
      });
      console.log(`\u{1F4E1} Subscribed to ${ASSETS.length} quote streams`);
    }, 2e3);
  });
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      if (data.name === "candle-generated" && data.msg) {
        const activeId = data.msg.active_id;
        const name = ASSET_NAMES[activeId];
        if (name) {
          const price = data.msg.close || data.msg.value || data.msg.open;
          if (price && price > 0) {
            priceStore.set(name, {
              bid: price,
              ask: price + (price > 100 ? 0.01 : 1e-5),
              time: (data.msg.at || Math.floor(Date.now() / 1e3)) * 1e3
            });
          }
        }
      }
      if (data.name === "instrument-quote" && data.msg) {
        const activeId = data.msg.active_id;
        const name = ASSET_NAMES[activeId];
        if (name && (data.msg.bid || data.msg.ask)) {
          priceStore.set(name, {
            bid: data.msg.bid,
            ask: data.msg.ask,
            time: Date.now()
          });
        }
      }
    } catch {
    }
  });
  ws.on("error", (e) => console.error("\u274C WS error:", e));
  ws.on("close", () => {
    console.log("\u26A0\uFE0F WebSocket closed, reconnecting in 5s...");
    wsRef = null;
    setTimeout(() => connectAndSubscribe(ssid).catch(() => {
    }), 5e3);
  });
}
async function fetchExtraPrices(ssid) {
  const extras = [
    { name: "XAU/USD", id: 76 },
    { name: "XAG/USD", id: 77 },
    { name: "BTC/USD", id: 380 },
    { name: "ETH/USD", id: 381 }
  ];
  for (const asset of extras) {
    try {
      const res = await fetch(
        `https://api.iqoption.com/v1/candles/active/${asset.id}?duration=60&amount=1`,
        {
          headers: { Cookie: `ssid=${ssid}`, "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(3e3)
        }
      );
      if (res.ok) {
        const data = await res.json();
        const candle = data.candles?.[0];
        if (candle?.close) {
          priceStore.set(asset.name, {
            bid: candle.close,
            ask: candle.close + 0.01,
            time: candle.at * 1e3
          });
        }
      }
    } catch {
    }
  }
}
var PORT = 3002;
var server = import_http.default.createServer((req, res) => {
  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "IQ Option Price Service",
      prices: priceStore.size,
      wsConnected: wsRef?.readyState === 1
    }));
    return;
  }
  if (url.pathname === "/prices") {
    const prices = [];
    for (const [symbol, tick] of priceStore.entries()) {
      prices.push({
        symbol,
        bid: tick.bid,
        ask: tick.ask,
        time: tick.time,
        source: "IQ Option"
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
  console.log(`\u{1F916} IQ Option Price Service running on port ${PORT}`);
});
(async () => {
  try {
    const ssid = await login();
    await connectAndSubscribe(ssid);
    setInterval(() => fetchExtraPrices(ssid), 3e4);
    fetchExtraPrices(ssid);
  } catch (e) {
    console.error("\u274C Failed to start:", e.message);
    setTimeout(() => process.exit(1), 3e4);
  }
})();
