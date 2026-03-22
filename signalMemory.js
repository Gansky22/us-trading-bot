const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "signal-memory.json");
const EXPIRE_MINUTES = 30;

function loadMemory() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.log("loadMemory error:", err.message);
    return {};
  }
}

function saveMemory(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.log("saveMemory error:", err.message);
  }
}

function makeKey(symbol, side) {
  return `${symbol}_${side}`;
}

function shouldSend(symbol, side) {
  const memory = loadMemory();
  const key = makeKey(symbol, side);
  const now = Date.now();

  if (!memory[key]) {
    memory[key] = now;
    saveMemory(memory);
    return true;
  }

  const diffMinutes = (now - memory[key]) / 1000 / 60;

  if (diffMinutes >= EXPIRE_MINUTES) {
    memory[key] = now;
    saveMemory(memory);
    return true;
  }

  return false;
}

function cleanOldMemory() {
  const memory = loadMemory();
  const now = Date.now();
  const cleaned = {};

  for (const key of Object.keys(memory)) {
    const diffMinutes = (now - memory[key]) / 1000 / 60;
    if (diffMinutes < EXPIRE_MINUTES * 3) {
      cleaned[key] = memory[key];
    }
  }

  saveMemory(cleaned);
}

module.exports = {
  shouldSend,
  cleanOldMemory,
};