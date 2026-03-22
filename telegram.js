const TelegramBot = require("node-telegram-bot-api");

const TOKEN = "8618402648:AAHYKbqBKr5QxhOLV_989acZkrB8FUwNw5I";
const CHAT_ID = "1152191884";

const bot = new TelegramBot(TOKEN);

async function sendTelegram(message) {
  await bot.sendMessage(CHAT_ID, message);
}

module.exports = { sendTelegram };