// ===== ALFA PRO + IQ Option — Telegram Bot =====
// One bot handles BOTH subscriptions.
// ALFA codes start with "ALFA-", IQ Option codes start with "IQ-".
// Customer clicks a plan → bot generates the RIGHT code for that bot.

import fs from "fs";
import path from "path";
import http from "http";

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID || "";

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

console.log(`🤖 ALFA PRO + IQ Option Bot starting...`);

// ===== Code generators =====
type PlanType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type BotType = "alfa_pro" | "iq_option";

const PLANS: { type: PlanType; code: string; days: number; labelAr: string }[] = [
  { type: "daily",   code: "D", days: 1,  labelAr: "يومي"   },
  { type: "weekly",  code: "W", days: 7,  labelAr: "أسبوعي" },
  { type: "monthly", code: "M", days: 30, labelAr: "شهري"   },
];

// Owner Telegram username (for customers to contact manually)
const OWNER_USERNAME = process.env.TELEGRAM_OWNER_USERNAME || "TtoOPp8";

const SECRET_SALT = "ALFA2026PRO-SECRET-KEY";

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}

function generateCode(plan: PlanType, bot: BotType): string {
  const def = PLANS.find((p) => p.type === plan)!;
  const botPrefix = bot === "iq_option" ? "IQ" : "ALFA";
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  const checksum = hashString(`${botPrefix}-${def.code}-${def.days}-${id}-${SECRET_SALT}`).slice(0, 4);
  return `${botPrefix}-${def.code}${def.days}-${id}-${checksum}`;
}

// ===== Telegram API =====
async function tg(method: string, params: any = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

async function sendMessage(chatId: string, text: string, keyboard?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (keyboard) body.reply_markup = keyboard;
  const result = await tg("sendMessage", body);
  if (!result.ok) {
    console.error(`❌ sendMessage FAILED to ${chatId}: ${result.description} (code: ${result.error_code})`);
  }
  return result;
}

// Main keyboard — choose bot first
function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🟡 ALFA PRO — إشارات MT5", callback_data: "bot_alfa_pro" },
        { text: "🟣 IQ Option — فوركس/كريبتو", callback_data: "bot_iq_option" },
      ],
    ],
  };
}

// Plan keyboard for a specific bot (plans only — no prices)
function planKeyboard(bot: BotType) {
  const icon = bot === "iq_option" ? "🟣" : "🟡";
  return {
    inline_keyboard: [
      ...PLANS.map((p) => [
        { text: `${icon} ${p.labelAr} — ${p.days} يوم`, callback_data: `order_${bot}_${p.type}` },
      ]),
      [{ text: "🔙 رجوع", callback_data: "back_main" }],
    ],
  };
}

// ===== Process subscription request =====
// Generates a code and sends it to the OWNER ONLY.
// The customer is told to wait for the owner's reply (NO CODE, NO contact info).
async function processOrder(chatId: string, bot: BotType, plan: PlanType, username: string) {
  console.log(`📦 processOrder START | chatId=${chatId} | bot=${bot} | plan=${plan} | user=${username}`);
  const def = PLANS.find((p) => p.type === plan)!;
  const code = generateCode(plan, bot);
  const requestId = Date.now().toString().slice(-6);
  const botName = bot === "iq_option" ? "IQ Option" : "ALFA PRO";
  const botIcon = bot === "iq_option" ? "🟣" : "🟡";
  console.log(`📦 Generated code: ${code} | requestId: #${requestId}`);

  // 1) Tell the customer to wait for the owner's reply (NO CODE)
  console.log(`📤 Sending customer message to chatId=${chatId}...`);
  try {
    const custRes = await sendMessage(
      chatId,
      `${botIcon} <b>تم تسجيل طلبك بنجاح!</b>\n\n` +
      `🤖 البوت: <b>${botName}</b>\n` +
      `📋 الاشتراك: <b>${def.labelAr}</b>\n` +
      `⏱️ المدة: <b>${def.days} يوم</b>\n` +
      `📋 رقم الطلب: <code>#${requestId}</code>\n\n` +
      `⏳ <b>انتظر رد المالك</b>\n` +
      `📩 تم إرسال طلبك للإدارة.\n` +
      `🔔 سيصلك كود التفعيل هنا في البوت قريباً.\n\n` +
      `✅ لا حاجة لفعل أي شيء — فقط انتظر.`,
      {
        inline_keyboard: [
          [{ text: "🔙 القائمة الرئيسية", callback_data: "back_main" }],
        ],
      }
    );
    console.log(`✅ Customer message sent: ok=${custRes?.ok}`);
  } catch (e: any) {
    console.error(`❌ Customer message FAILED: ${e?.message || e}`);
  }

  // 2) Send the generated code to the OWNER (manual delivery required)
  console.log(`📤 Sending owner message to OWNER_CHAT_ID=${OWNER_CHAT_ID}...`);
  if (OWNER_CHAT_ID) {
    try {
      const ownerRes = await sendMessage(
        OWNER_CHAT_ID,
        `🔔 <b>طلب اشتراك جديد</b>\n\n` +
        `👤 العميل: ${username}\n` +
        `🆔 معرّف العميل: <code>${chatId}</code>\n` +
        `🤖 البوت: <b>${botName}</b>\n` +
        `📋 الاشتراك: <b>${def.labelAr}</b>\n` +
        `⏱️ المدة: ${def.days} يوم\n` +
        `📋 رقم الطلب: #${requestId}\n\n` +
        `🔑 <b>الكود المولّد:</b>\n<code>${code}</code>\n\n` +
        `📝 <b>أرسل هذا الكود للعميل يدوياً.</b>\n` +
        `⚠️ هذا الكود يعمل على ${botName} فقط وعلى جهاز واحد.`
      );
      console.log(`✅ Owner message sent: ok=${ownerRes?.ok}`);
    } catch (e: any) {
      console.error(`❌ Owner message FAILED: ${e?.message || e}`);
    }
  } else {
    console.log(`⚠️ OWNER_CHAT_ID is empty - skipping owner message`);
  }
  console.log(`📦 processOrder END`);
}

// ===== Handle updates =====
async function handleUpdate(update: any) {
  console.log(`🔄 Processing update: ${JSON.stringify(update?.message?.text || update?.callback_query?.data || "unknown").slice(0, 100)}`);
  // Message
  if (update.message) {
    const chatId = String(update.message.chat.id);
    const text = update.message.text || "";
    const fromUser = update.message.from;
    const username = fromUser?.username ? `@${fromUser.username}` : fromUser?.first_name || "غير معروف";

    // /start with parameter (from website link) — show plans for the selected bot
    // e.g. /start monthly    → show ALFA PRO plans
    //      /start iq_monthly → show IQ Option plans
    if (text.startsWith("/start ")) {
      const param = text.replace("/start ", "").trim().toLowerCase();
      const isIq = param.startsWith("iq_");
      const planStr = isIq ? param.replace("iq_", "") : param;
      const validPlans = PLANS.map((p) => p.type);
      if (validPlans.includes(planStr as PlanType)) {
        const bot: BotType = isIq ? "iq_option" : "alfa_pro";
        const botName = bot === "iq_option" ? "IQ Option" : "ALFA PRO";
        const botIcon = bot === "iq_option" ? "🟣" : "🟡";
        const desc = bot === "iq_option"
          ? "📊 يشمل: EUR/USD · GBP/USD · XAU/USD · BTC/USD و أكثر\n📡 أسعار حقيقية من IQ Option"
          : "📊 يشمل: SwitchX · PainX · GainX · BreakX\n📡 أسعار حقيقية من MetaTrader 5";
        await sendMessage(
          chatId,
          `${botIcon} <b>${botName}</b>\n\n${desc}\n\n📋 <b>اختر خطة الاشتراك:</b>`,
          planKeyboard(bot)
        );
        return;
      }
    }

    // Plain /start
    if (text === "/start") {
      await sendMessage(
        chatId,
        `👋 <b>مرحباً بك في ALFA PRO + IQ Option</b>\n\n` +
        `🤖 بوت الإشارات الأول الذي يجمع بين ALFA PRO و IQ Option\n\n` +
        `📊 <b>ماذا يقدم كل بوت؟</b>\n` +
        `🟡 <b>ALFA PRO</b> — إشارات MT5 (SwitchX · PainX · GainX · BreakX)\n` +
        `🟣 <b>IQ Option</b> — إشارات فوركس / معادن / كريبتو\n\n` +
        `⬇️ <b>اختر البوت الذي تريد الاشتراك فيه:</b>`,
        mainKeyboard()
      );
    } else {
      await sendMessage(chatId, "⬇️ اختر البوت من القائمة:", mainKeyboard());
    }
    return;
  }

  // Callback
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || "";
    const fromId = String(cb.from.id);
    await tg("answerCallbackQuery", { callback_query_id: cb.id });

    // Back to main
    if (data === "back_main") {
      await sendMessage(fromId, "اختر البوت 👇", mainKeyboard());
      return;
    }

    // Bot selection — show plans with prices
    if (data === "bot_alfa_pro") {
      await sendMessage(
        fromId,
        `🟡 <b>ALFA PRO — إشارات MT5</b>\n\n` +
        `📊 يشمل: SwitchX · PainX · GainX · BreakX\n` +
        `📡 أسعار حقيقية من MetaTrader 5\n\n` +
        `📋 <b>اختر خطة الاشتراك:</b>`,
        planKeyboard("alfa_pro")
      );
      return;
    }
    if (data === "bot_iq_option") {
      await sendMessage(
        fromId,
        `🟣 <b>IQ Option — فوركس / معادن / كريبتو</b>\n\n` +
        `📊 يشمل: EUR/USD · GBP/USD · XAU/USD · BTC/USD و أكثر\n` +
        `📡 أسعار حقيقية من IQ Option\n\n` +
        `📋 <b>اختر خطة الاشتراك:</b>`,
        planKeyboard("iq_option")
      );
      return;
    }

    // Order: order_<bot>_<plan> — generate code, send to OWNER ONLY (manual delivery)
    // Format: order_alfa_pro_daily | order_alfa_pro_weekly | order_alfa_pro_monthly
    //         order_iq_option_daily | order_iq_option_weekly | order_iq_option_monthly
    if (data.startsWith("order_")) {
      console.log(`🎯 Order callback received: ${data} from ${fromId}`);
      // Extract plan (last part after last _)
      const parts = data.split("_");
      const plan = parts[parts.length - 1] as PlanType;  // last part = plan
      // bot = everything between "order_" and the plan
      const botStr = data.replace("order_", "").replace(`_${plan}`, "");
      const bot: BotType = botStr === "iq_option" ? "iq_option" : "alfa_pro";
      console.log(`🎯 bot=${bot} | plan=${plan}`);
      const def = PLANS.find((p) => p.type === plan);
      if (!def) {
        console.error(`❌ Plan not found: ${plan} | available: ${PLANS.map(p => p.type).join(", ")}`);
        return;
      }
      const username = cb.from?.username ? `@${cb.from.username}` : cb.from?.first_name || "غير معروف";
      console.log(`🎯 Calling processOrder: fromId=${fromId} | bot=${bot} | plan=${plan} | user=${username}`);

      // Generate code and send to OWNER ONLY — customer gets "request received"
      await processOrder(fromId, bot, plan, username);
      return;
    }
  }
}

// ===== Polling (with anti-conflict protection) =====
let offset = 0;
let isPolling = false;

console.log(`📡 Starting polling...`);

async function pollOnce() {
  // Prevent overlapping polls (main cause of Conflict)
  if (isPolling) return;
  isPolling = true;

  try {
    const data = await tg("getUpdates", {
      offset,
      timeout: 10,  // moderate long polling
      allowed_updates: ["message", "callback_query"],
    });

    if (!data.ok) {
      if (data.description?.includes("Conflict")) {
        // Conflict — wait longer before retry
        console.error(`⚠️ Conflict — retrying in 15s...`);
        isPolling = false;
        setTimeout(pollOnce, 15000);
        return;
      }
      console.error(`❌ getUpdates: ${data.description}`);
      isPolling = false;
      setTimeout(pollOnce, 3000);
      return;
    }

    if (data.result?.length > 0) {
      console.log(`📥 Received ${data.result.length} update(s)`);
      for (const update of data.result) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (e: any) {
          console.error("❌ Handle error:", e?.message || e);
        }
      }
    }
  } catch (e: any) {
    console.error("Polling error:", e?.message || e);
  }
  isPolling = false;
  // Quick re-poll (no overlap possible due to isPolling flag)
  setTimeout(pollOnce, 1000);
}

pollOnce();

// HTTP health check (Node.js native — works with tsx, no Bun needed)
const HEALTH_PORT = 3001;
const healthServer = http.createServer((req, res) => {
  const url = new URL(req.url || "", `http://localhost:${HEALTH_PORT}`);
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "ALFA PRO + IQ Option Telegram Bot",
      botConfigured: !!BOT_TOKEN,
      ownerConfigured: !!OWNER_CHAT_ID,
    }));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`✅ Bot running! Owner: ${OWNER_CHAT_ID}`);
  console.log(`   Health: http://localhost:${HEALTH_PORT}/`);
});
