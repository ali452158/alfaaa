import { NextResponse } from "next/server";
import { fetchRealPrices, getStatus } from "@/lib/mt5";

export async function GET() {
  const st = getStatus();
  if (st.status !== "connected") {
    return NextResponse.json({
      ok: false,
      connected: false,
      status: st.status,
      error: st.error,
      prices: [],
      symbols: [],
    });
  }
  const prices = await fetchRealPrices();
  return NextResponse.json({
    ok: true,
    connected: true,
    status: st.status,
    prices,
    symbols: st.symbols,
  });
}
