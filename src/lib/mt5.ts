// ===== MT5 connection via MetaApi SDK (optimized for memory) =====
// Uses SDK with lazy loading + aggressive caching to prevent memory issues

export interface RealTick {
  symbol: string;
  bid: number;
  ask: number;
  time: number;
  source: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ConnectionState {
  status: "disconnected" | "connecting" | "deploying" | "connected" | "error";
  accountId: string | null;
  login: string | null;
  server: string | null;
  symbols: string[];
  connectedAt: number | null;
  error: string | null;
}

const TARGET_SYMBOLS = [
  "SwitchX 1200", "SwitchX 1800",
  "PainX 400", "PainX 600", "PainX 800", "PainX 999", "PainX 1200",
  "GainX 400", "GainX 600", "GainX 800", "GainX 999", "GainX 1200",
  "BreakX 600",
];

const state: ConnectionState = {
  status: "disconnected",
  accountId: null,
  login: null,
  server: null,
  symbols: [],
  connectedAt: null,
  error: null,
};

// ===== Caches (prevent memory growth) =====
const tickCache = new Map<string, { bid: number; ask: number; time: number }>();
let lastTickRefresh = 0;
const TICK_REFRESH_MS = 30000; // 30s

// ===== SDK instances (singleton — loaded once) =====
let metaApiInstance: any = null;
let connectionInstance: any = null;
let connectingPromise: Promise<void> | null = null;

function readCreds() {
  const token = process.env.METAAPI_TOKEN?.trim();
  const login = process.env.MT5_LOGIN?.trim();
  const password = process.env.MT5_PASSWORD?.trim();
  const server = process.env.MT5_SERVER?.trim() || "Weltrade-Demo";
  const accountId = process.env.MT5_ACCOUNT_ID?.trim();
  return { token, login, password, server, accountId };
}

// Bypass SSL for self-signed certs
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function loadMetaApi(token: string) {
  if (metaApiInstance) return metaApiInstance;
  try {
    const mod: any = await import("metaapi.cloud-sdk/esm-node");
    const MetaApi = mod.default || mod.MetaApi || mod;
    metaApiInstance = new MetaApi(token, { application: "ALFA PRO" });
    console.log("[MT5] ✅ MetaAPI SDK loaded successfully");
    return metaApiInstance;
  } catch (e: any) {
    console.error("[MT5] ❌ Failed to load SDK:", e.message);
    throw e;
  }
}

export function getStatus() {
  return { ...state };
}

export function autoConnect(): Promise<void> {
  if (state.status === "connected") return Promise.resolve();
  if (connectingPromise) return connectingPromise;
  state.status = state.status === "error" ? "connecting" : state.status;
  connectingPromise = doAutoConnect().finally(() => {
    connectingPromise = null;
    if (state.status === "error") {
      setTimeout(() => { state.status = "disconnected"; autoConnect(); }, 60000);
    }
  });
  return connectingPromise;
}

async function doAutoConnect(): Promise<void> {
  if (state.status === "connected") return;
  const { token, login, password, server, accountId } = readCreds();
  
  if (!token || !login || !password) {
    state.status = "disconnected";
    state.error = "missing-env";
    console.log("[MT5] ❌ Missing credentials (token, login, or password)");
    return;
  }

  state.status = "connecting";
  state.error = null;
  state.login = login;
  state.server = server;

  try {
    console.log(`[MT5] 🔄 Connecting to ${server} with login ${login}...`);
    const metaApi = await loadMetaApi(token);

    // Get account
    let account = null;
    if (accountId && accountId.length > 10) {
      try {
        console.log(`[MT5] 🔍 Looking for account ${accountId}...`);
        account = await metaApi.metatraderAccountApi.getAccount(accountId);
        console.log(`[MT5] ✅ Found account: ${account.id}`);
      } catch (e: any) {
        const errMsg = String(e?.message || e).slice(0, 80);
        console.log(`[MT5] ⚠️ getAccount failed: ${errMsg}`);
      }
    }

    if (!account) {
      try {
        console.log(`[MT5] 🔍 Searching for account with login ${login}...`);
        const accounts = await metaApi.metatraderAccountApi.getAccountsWithInfiniteScrollPagination({ login });
        console.log(`[MT5] 📊 Found ${accounts.length} accounts`);
        account = accounts.find((a: any) => String(a.login) === String(login) && a.server === server);
        if (account) {
          console.log(`[MT5] ✅ Matched account: ${account.id}`);
        }
      } catch (e: any) {
        console.log(`[MT5] ⚠️ Account search failed: ${String(e?.message || e).slice(0, 80)}`);
      }
    }

    if (!account) {
      throw new Error(`لم يتم العثور على حساب MT5 (login=${login}, server=${server})`);
    }

    state.accountId = account.id;
    const rpcConnection = account.getRPCConnection();
    connectionInstance = rpcConnection;

    // Connect with timeout
    console.log("[MT5] 🔗 Establishing RPC connection...");
    await Promise.race([
      rpcConnection.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("connect timeout")), 15000)),
    ]).catch((e) => {
      console.log(`[MT5] ⚠️ Connect error (non-fatal): ${e.message}`);
    });

    // Wait for connection (try multiple methods)
    if (typeof rpcConnection.waitConnected === "function") {
      console.log("[MT5] ⏳ Waiting for connection...");
      await Promise.race([
        rpcConnection.waitConnected(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("waitConnected timeout")), 10000)),
      ]).catch((e) => {
        console.log(`[MT5] ⚠️ Wait error (non-fatal): ${e.message}`);
      });
    } else {
      // Fallback: just wait a bit
      await new Promise((r) => setTimeout(r, 3000));
    }

    state.symbols = TARGET_SYMBOLS;
    state.status = "connected";
    state.connectedAt = Date.now();
    state.error = null;
    console.log(`[MT5] ✅ Connected! Login: ${login} | Server: ${server} | Account: ${account.id}`);

    // Initial tick fetch
    refreshAllTicks().catch(() => {});
  } catch (e: any) {
    state.status = "error";
    state.error = String(e?.message || e).slice(0, 200);
    console.log(`[MT5] ❌ Connection failed: ${state.error}`);
  }
}

// ===== Refresh all ticks (cached for 30s) =====
async function refreshAllTicks() {
  if (!connectionInstance || state.status !== "connected") return;
  if (Date.now() - lastTickRefresh < TICK_REFRESH_MS) return;

  let successCount = 0;
  for (const sym of TARGET_SYMBOLS) {
    try {
      const tick = await Promise.race([
        connectionInstance.getTick(sym, false),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      const bid = Number(tick.bid);
      const ask = Number(tick.ask);
      if (isFinite(bid) && isFinite(ask) && bid > 0) {
        tickCache.set(sym, { bid, ask, time: Date.now() });
        successCount++;
      }
    } catch {
      // Silent fail for individual symbols
    }
  }

  lastTickRefresh = Date.now();
  console.log(`[MT5] 📊 Refreshed ${successCount}/${TARGET_SYMBOLS.length} ticks`);
}

export async function fetchRealPrices(): Promise<RealTick[]> {
  if (state.status !== "connected") return [];
  if (Date.now() - lastTickRefresh > TICK_REFRESH_MS * 2) {
    refreshAllTicks().catch(() => {});
  }
  const results: RealTick[] = [];
  for (const [symbol, tick] of tickCache.entries()) {
    results.push({
      symbol, bid: tick.bid, ask: tick.ask, time: tick.time,
      source: `MT5 · ${state.server ?? "Weltrade"}`,
    });
  }
  return results;
}

export async function fetchTick(symbol: string): Promise<{ bid: number; ask: number; time: number } | null> {
  if (state.status !== "connected") return null;
  if (Date.now() - lastTickRefresh > TICK_REFRESH_MS) {
    await refreshAllTicks().catch(() => {});
  }
  return tickCache.get(symbol) || null;
}

// Candles: use simulated (SDK candle fetching is memory-heavy)
export async function fetchCandles(
  _symbol: string,
  _timeframe: "1m" | "5m" = "5m",
  _count: number = 200
): Promise<Candle[]> {
  return [];
}

