const axios = require("axios");

const STOCKS = ["AAPL", "TSLA", "NVDA", "AMD", "META"];

async function getPrice(symbol) {
  // 简化版（你后面可以换真实API）
  return 100 + Math.random() * 10;
}

function getSignal(price) {
  if (price > 105) {
    return { side: "LONG", reason: "强势突破" };
  } else if (price < 98) {
    return { side: "SHORT", reason: "跌破支撑" };
  }
  return null;
}

async function scanMarket() {
  let results = [];

  for (let symbol of STOCKS) {
    let price = await getPrice(symbol);
    let signal = getSignal(price);

    if (signal) {
      results.push({
        symbol,
        price: price.toFixed(2),
        ...signal,
      });
    }
  }

  return results;
}

module.exports = { scanMarket };