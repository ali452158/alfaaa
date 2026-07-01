import { NextResponse } from "next/server";
import { getStatus } from "@/lib/mt5";

export async function GET() {
  return NextResponse.json(getStatus());
}
