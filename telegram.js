const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.log("Telegram env not set yet.");
}

const bot = TOKEN ? new TelegramBot(TOKEN) : null;

async function sendTelegram(message) {
  if (!bot || !CHAT_ID) {
    console.log("Skip Telegram:", message);
    return;
  }

  await bot.sendMessage(CHAT_ID, message);
}

module.exports = { sendTelegram };