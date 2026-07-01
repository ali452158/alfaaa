#!/bin/bash
# ===== ALFA PRO — Startup script for Railway =====
# Starts ALL services: web app + telegram bot + IQ Option service
# Uses compiled JS (no tsx needed in production)

echo "🚀 Starting ALFA PRO + IQ Option..."

# 1. Start main web app (Next.js)
echo "📡 Starting web app on port ${PORT:-3000}..."
npm run start &
WEB_PID=$!

# 2. Start Telegram bot (polling, port 3001)
echo "🤖 Starting Telegram bot..."
node mini-services/telegram-bot/index.js &
BOT_PID=$!

# 3. Start IQ Option price service (port 3002)
echo "📈 Starting IQ Option service..."
node mini-services/iq-option/index.js &
IQ_PID=$!

echo "✅ All services started!"
echo "   Web:    http://localhost:${PORT:-3000}"
echo "   Bot:    http://localhost:3001"
echo "   IQ:     http://localhost:3002"

# Keep alive — wait for any process to exit
wait $WEB_PID $BOT_PID $IQ_PID
