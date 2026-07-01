import { NextResponse } from "next/server";
import { generateCode, PLANS, validateCode, type PlanType, type BotType } from "@/lib/subscription";

const ADMIN_KEY = process.env.ADMIN_KEY || "ALFA-ADMIN-2026";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, count, adminKey, bot, prefix } = body;

    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { ok: false, error: "مفتاح الإدارة غير صحيح" },
        { status: 403 }
      );
    }

    const validPlans = PLANS.map((p) => p.type);
    if (!plan || !validPlans.includes(plan as PlanType)) {
      return NextResponse.json(
        { ok: false, error: `خطة غير صحيحة` },
        { status: 400 }
      );
    }

    const botType: BotType = bot === "iq_option" ? "iq_option" : "alfa_pro";
    const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);

    const codes: { code: string; valid: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const uniqueId = prefix
        ? `${prefix}${String(i + 1).padStart(3, "0")}`.toUpperCase().slice(0, 6)
        : undefined;
      const code = generateCode(plan as PlanType, botType, uniqueId);
      codes.push({ code, valid: !!validateCode(code) });
    }

    return NextResponse.json({ ok: true, plan, bot: botType, count: n, codes });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e).slice(0, 120) },
      { status: 500 }
    );
  }
}
