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

// mini-services/telegram-bot/index.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_http = __toESM(require("http"));
function loadEnv() {
  try {
    const envPath = import_path.default.resolve(__dirname, "../../.env");
    const content = import_fs.default.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
  }
}
loadEnv();
var BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID || "";
if (!BOT_TOKEN) {
  console.error("\u274C TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}
console.log(`\u{1F916} ALFA PRO + IQ Option Bot starting...`);
var PLANS = [
  { type: "daily", code: "D", days: 1, labelAr: "\u064A\u0648\u0645\u064A" },
  { type: "weekly", code: "W", days: 7, labelAr: "\u0623\u0633\u0628\u0648\u0639\u064A" },
  { type: "monthly", code: "M", days: 30, labelAr: "\u0634\u0647\u0631\u064A" }
];
var OWNER_USERNAME = process.env.TELEGRAM_OWNER_USERNAME || "TtoOPp8";
var SECRET_SALT = "ALFA2026PRO-SECRET-KEY";
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) + h ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}
function generateCode(plan, bot) {
  const def = PLANS.find((p) => p.type === plan);
  const botPrefix = bot === "iq_option" ? "IQ" : "ALFA";
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  const checksum = hashString(`${botPrefix}-${def.code}-${def.days}-${id}-${SECRET_SALT}`).slice(0, 4);
  return `${botPrefix}-${def.code}${def.days}-${id}-${checksum}`;
}
async function tg(method, params = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.json();
}
async function sendMessage(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (keyboard) body.reply_markup = keyboard;
  const result = await tg("sendMessage", body);
  if (!result.ok) {
    console.error(`\u274C sendMessage FAILED to ${chatId}: ${result.description} (code: ${result.error_code})`);
  }
  return result;
}
function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "\u{1F7E1} ALFA PRO \u2014 \u0625\u0634\u0627\u0631\u0627\u062A MT5", callback_data: "bot_alfa_pro" },
        { text: "\u{1F7E3} IQ Option \u2014 \u0641\u0648\u0631\u0643\u0633/\u0643\u0631\u064A\u0628\u062A\u0648", callback_data: "bot_iq_option" }
      ]
    ]
  };
}
function planKeyboard(bot) {
  const icon = bot === "iq_option" ? "\u{1F7E3}" : "\u{1F7E1}";
  return {
    inline_keyboard: [
      ...PLANS.map((p) => [
        { text: `${icon} ${p.labelAr} \u2014 ${p.days} \u064A\u0648\u0645`, callback_data: `order_${bot}_${p.type}` }
      ]),
      [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "back_main" }]
    ]
  };
}
async function processOrder(chatId, bot, plan, username) {
  console.log(`\u{1F4E6} processOrder START | chatId=${chatId} | bot=${bot} | plan=${plan} | user=${username}`);
  const def = PLANS.find((p) => p.type === plan);
  const code = generateCode(plan, bot);
  const requestId = Date.now().toString().slice(-6);
  const botName = bot === "iq_option" ? "IQ Option" : "ALFA PRO";
  const botIcon = bot === "iq_option" ? "\u{1F7E3}" : "\u{1F7E1}";
  console.log(`\u{1F4E6} Generated code: ${code} | requestId: #${requestId}`);
  console.log(`\u{1F4E4} Sending customer message to chatId=${chatId}...`);
  try {
    const custRes = await sendMessage(
      chatId,
      `${botIcon} <b>\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D!</b>

\u{1F916} \u0627\u0644\u0628\u0648\u062A: <b>${botName}</b>
\u{1F4CB} \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643: <b>${def.labelAr}</b>
\u23F1\uFE0F \u0627\u0644\u0645\u062F\u0629: <b>${def.days} \u064A\u0648\u0645</b>
\u{1F4CB} \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: <code>#${requestId}</code>

\u23F3 <b>\u0627\u0646\u062A\u0638\u0631 \u0631\u062F \u0627\u0644\u0645\u0627\u0644\u0643</b>
\u{1F4E9} \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628\u0643 \u0644\u0644\u0625\u062F\u0627\u0631\u0629.
\u{1F514} \u0633\u064A\u0635\u0644\u0643 \u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0647\u0646\u0627 \u0641\u064A \u0627\u0644\u0628\u0648\u062A \u0642\u0631\u064A\u0628\u0627\u064B.

\u2705 \u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0641\u0639\u0644 \u0623\u064A \u0634\u064A\u0621 \u2014 \u0641\u0642\u0637 \u0627\u0646\u062A\u0638\u0631.`,
      {
        inline_keyboard: [
          [{ text: "\u{1F519} \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "back_main" }]
        ]
      }
    );
    console.log(`\u2705 Customer message sent: ok=${custRes?.ok}`);
  } catch (e) {
    console.error(`\u274C Customer message FAILED: ${e?.message || e}`);
  }
  console.log(`\u{1F4E4} Sending owner message to OWNER_CHAT_ID=${OWNER_CHAT_ID}...`);
  if (OWNER_CHAT_ID) {
    try {
      const ownerRes = await sendMessage(
        OWNER_CHAT_ID,
        `\u{1F514} <b>\u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u062C\u062F\u064A\u062F</b>

\u{1F464} \u0627\u0644\u0639\u0645\u064A\u0644: ${username}
\u{1F194} \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0639\u0645\u064A\u0644: <code>${chatId}</code>
\u{1F916} \u0627\u0644\u0628\u0648\u062A: <b>${botName}</b>
\u{1F4CB} \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643: <b>${def.labelAr}</b>
\u23F1\uFE0F \u0627\u0644\u0645\u062F\u0629: ${def.days} \u064A\u0648\u0645
\u{1F4CB} \u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628: #${requestId}

\u{1F511} <b>\u0627\u0644\u0643\u0648\u062F \u0627\u0644\u0645\u0648\u0644\u0651\u062F:</b>
<code>${code}</code>

\u{1F4DD} <b>\u0623\u0631\u0633\u0644 \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u0644\u0644\u0639\u0645\u064A\u0644 \u064A\u062F\u0648\u064A\u0627\u064B.</b>
\u26A0\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0643\u0648\u062F \u064A\u0639\u0645\u0644 \u0639\u0644\u0649 ${botName} \u0641\u0642\u0637 \u0648\u0639\u0644\u0649 \u062C\u0647\u0627\u0632 \u0648\u0627\u062D\u062F.`
      );
      console.log(`\u2705 Owner message sent: ok=${ownerRes?.ok}`);
    } catch (e) {
      console.error(`\u274C Owner message FAILED: ${e?.message || e}`);
    }
  } else {
    console.log(`\u26A0\uFE0F OWNER_CHAT_ID is empty - skipping owner message`);
  }
  console.log(`\u{1F4E6} processOrder END`);
}
async function handleUpdate(update) {
  console.log(`\u{1F504} Processing update: ${JSON.stringify(update?.message?.text || update?.callback_query?.data || "unknown").slice(0, 100)}`);
  if (update.message) {
    const chatId = String(update.message.chat.id);
    const text = update.message.text || "";
    const fromUser = update.message.from;
    const username = fromUser?.username ? `@${fromUser.username}` : fromUser?.first_name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
    if (text.startsWith("/start ")) {
      const param = text.replace("/start ", "").trim().toLowerCase();
      const isIq = param.startsWith("iq_");
      const planStr = isIq ? param.replace("iq_", "") : param;
      const validPlans = PLANS.map((p) => p.type);
      if (validPlans.includes(planStr)) {
        const bot = isIq ? "iq_option" : "alfa_pro";
        const botName = bot === "iq_option" ? "IQ Option" : "ALFA PRO";
        const botIcon = bot === "iq_option" ? "\u{1F7E3}" : "\u{1F7E1}";
        const desc = bot === "iq_option" ? "\u{1F4CA} \u064A\u0634\u0645\u0644: EUR/USD \xB7 GBP/USD \xB7 XAU/USD \xB7 BTC/USD \u0648 \u0623\u0643\u062B\u0631\n\u{1F4E1} \u0623\u0633\u0639\u0627\u0631 \u062D\u0642\u064A\u0642\u064A\u0629 \u0645\u0646 IQ Option" : "\u{1F4CA} \u064A\u0634\u0645\u0644: SwitchX \xB7 PainX \xB7 GainX \xB7 BreakX\n\u{1F4E1} \u0623\u0633\u0639\u0627\u0631 \u062D\u0642\u064A\u0642\u064A\u0629 \u0645\u0646 MetaTrader 5";
        await sendMessage(
          chatId,
          `${botIcon} <b>${botName}</b>

${desc}

\u{1F4CB} <b>\u0627\u062E\u062A\u0631 \u062E\u0637\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:</b>`,
          planKeyboard(bot)
        );
        return;
      }
    }
    if (text === "/start") {
      await sendMessage(
        chatId,
        `\u{1F44B} <b>\u0645\u0631\u062D\u0628\u0627\u064B \u0628\u0643 \u0641\u064A ALFA PRO + IQ Option</b>

\u{1F916} \u0628\u0648\u062A \u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0630\u064A \u064A\u062C\u0645\u0639 \u0628\u064A\u0646 ALFA PRO \u0648 IQ Option

\u{1F4CA} <b>\u0645\u0627\u0630\u0627 \u064A\u0642\u062F\u0645 \u0643\u0644 \u0628\u0648\u062A\u061F</b>
\u{1F7E1} <b>ALFA PRO</b> \u2014 \u0625\u0634\u0627\u0631\u0627\u062A MT5 (SwitchX \xB7 PainX \xB7 GainX \xB7 BreakX)
\u{1F7E3} <b>IQ Option</b> \u2014 \u0625\u0634\u0627\u0631\u0627\u062A \u0641\u0648\u0631\u0643\u0633 / \u0645\u0639\u0627\u062F\u0646 / \u0643\u0631\u064A\u0628\u062A\u0648

\u2B07\uFE0F <b>\u0627\u062E\u062A\u0631 \u0627\u0644\u0628\u0648\u062A \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A\u0647:</b>`,
        mainKeyboard()
      );
    } else {
      await sendMessage(chatId, "\u2B07\uFE0F \u0627\u062E\u062A\u0631 \u0627\u0644\u0628\u0648\u062A \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629:", mainKeyboard());
    }
    return;
  }
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || "";
    const fromId = String(cb.from.id);
    await tg("answerCallbackQuery", { callback_query_id: cb.id });
    if (data === "back_main") {
      await sendMessage(fromId, "\u0627\u062E\u062A\u0631 \u0627\u0644\u0628\u0648\u062A \u{1F447}", mainKeyboard());
      return;
    }
    if (data === "bot_alfa_pro") {
      await sendMessage(
        fromId,
        `\u{1F7E1} <b>ALFA PRO \u2014 \u0625\u0634\u0627\u0631\u0627\u062A MT5</b>

\u{1F4CA} \u064A\u0634\u0645\u0644: SwitchX \xB7 PainX \xB7 GainX \xB7 BreakX
\u{1F4E1} \u0623\u0633\u0639\u0627\u0631 \u062D\u0642\u064A\u0642\u064A\u0629 \u0645\u0646 MetaTrader 5

\u{1F4CB} <b>\u0627\u062E\u062A\u0631 \u062E\u0637\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:</b>`,
        planKeyboard("alfa_pro")
      );
      return;
    }
    if (data === "bot_iq_option") {
      await sendMessage(
        fromId,
        `\u{1F7E3} <b>IQ Option \u2014 \u0641\u0648\u0631\u0643\u0633 / \u0645\u0639\u0627\u062F\u0646 / \u0643\u0631\u064A\u0628\u062A\u0648</b>

\u{1F4CA} \u064A\u0634\u0645\u0644: EUR/USD \xB7 GBP/USD \xB7 XAU/USD \xB7 BTC/USD \u0648 \u0623\u0643\u062B\u0631
\u{1F4E1} \u0623\u0633\u0639\u0627\u0631 \u062D\u0642\u064A\u0642\u064A\u0629 \u0645\u0646 IQ Option

\u{1F4CB} <b>\u0627\u062E\u062A\u0631 \u062E\u0637\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:</b>`,
        planKeyboard("iq_option")
      );
      return;
    }
    if (data.startsWith("order_")) {
      console.log(`\u{1F3AF} Order callback received: ${data} from ${fromId}`);
      const parts = data.split("_");
      const plan = parts[parts.length - 1];
      const botStr = data.replace("order_", "").replace(`_${plan}`, "");
      const bot = botStr === "iq_option" ? "iq_option" : "alfa_pro";
      console.log(`\u{1F3AF} bot=${bot} | plan=${plan}`);
      const def = PLANS.find((p) => p.type === plan);
      if (!def) {
        console.error(`\u274C Plan not found: ${plan} | available: ${PLANS.map((p) => p.type).join(", ")}`);
        return;
      }
      const username = cb.from?.username ? `@${cb.from.username}` : cb.from?.first_name || "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
      console.log(`\u{1F3AF} Calling processOrder: fromId=${fromId} | bot=${bot} | plan=${plan} | user=${username}`);
      await processOrder(fromId, bot, plan, username);
      return;
    }
  }
}
var offset = 0;
var isPolling = false;
console.log(`\u{1F4E1} Starting polling...`);
async function pollOnce() {
  if (isPolling) return;
  isPolling = true;
  try {
    const data = await tg("getUpdates", {
      offset,
      timeout: 10,
      // moderate long polling
      allowed_updates: ["message", "callback_query"]
    });
    if (!data.ok) {
      if (data.description?.includes("Conflict")) {
        console.error(`\u26A0\uFE0F Conflict \u2014 retrying in 15s...`);
        isPolling = false;
        setTimeout(pollOnce, 15e3);
        return;
      }
      console.error(`\u274C getUpdates: ${data.description}`);
      isPolling = false;
      setTimeout(pollOnce, 3e3);
      return;
    }
    if (data.result?.length > 0) {
      console.log(`\u{1F4E5} Received ${data.result.length} update(s)`);
      for (const update of data.result) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (e) {
          console.error("\u274C Handle error:", e?.message || e);
        }
      }
    }
  } catch (e) {
    console.error("Polling error:", e?.message || e);
  }
  isPolling = false;
  setTimeout(pollOnce, 1e3);
}
pollOnce();
var HEALTH_PORT = 3001;
var healthServer = import_http.default.createServer((req, res) => {
  const url = new URL(req.url || "", `http://localhost:${HEALTH_PORT}`);
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "ALFA PRO + IQ Option Telegram Bot",
      botConfigured: !!BOT_TOKEN,
      ownerConfigured: !!OWNER_CHAT_ID
    }));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});
healthServer.listen(HEALTH_PORT, () => {
  console.log(`\u2705 Bot running! Owner: ${OWNER_CHAT_ID}`);
  console.log(`   Health: http://localhost:${HEALTH_PORT}/`);
});
