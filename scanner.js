const STOCKS = ["AAPL", "TSLA", "NVDA", "AMD", "META", "PLTR", "AMZN", "MSFT"];

function randomBetween(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

// 模拟价格
async function getMockData(symbol) {
  const baseMap = {
    AAPL: 215,
    TSLA: 180,
    NVDA: 920,
    AMD: 170,
    META: 500,
    PLTR: 30,
    AMZN: 185,
    MSFT: 425,
  };

  const base = baseMap[symbol] || 100;

  const price = randomBetween(base * 0.985, base * 1.02);
  const vwap = randomBetween(base * 0.99, base * 1.005);
  const ema9 = randomBetween(base * 0.992, base * 1.01);
  const ema20 = randomBetween(base * 0.988, base * 1.008);
  const openingHigh = randomBetween(base * 1.002, base * 1.012);
  const openingLow = randomBetween(base * 0.988, base * 0.998);
  const volumeRatio = randomBetween(0.8, 2.8);

  return {
    symbol,
    price,
    vwap,
    ema9,
    ema20,
    openingHigh,
    openingLow,
    volumeRatio,
  };
}

function round(num) {
  return +num.toFixed(2);
}

function calcLongLevels(price, openingLow) {
  const stopLoss = round(Math.min(price * 0.992, openingLow * 0.998));
  const risk = round(price - stopLoss);

  if (risk <= 0) return null;

  const tp1 = round(price + risk * 1.5);
  const tp2 = round(price + risk * 2.5);
  const rr = `1:${round((tp2 - price) / risk)}`;

  return {
    entry: round(price),
    stopLoss,
    tp1,
    tp2,
    rr,
    plan: "等回踩买入区不追高，跌破止损位直接离场",
  };
}

function calcShortLevels(price, openingHigh) {
  const stopLoss = round(Math.max(price * 1.008, openingHigh * 1.002));
  const risk = round(stopLoss - price);

  if (risk <= 0) return null;

  const tp1 = round(price - risk * 1.5);
  const tp2 = round(price - risk * 2.5);
  const rr = `1:${round((price - tp2) / risk)}`;

  return {
    entry: round(price),
    stopLoss,
    tp1,
    tp2,
    rr,
    plan: "等反弹不追空，站回止损位上方直接离场",
  };
}

function evaluateSignal(data) {
  const {
    price,
    vwap,
    ema9,
    ema20,
    openingHigh,
    openingLow,
    volumeRatio,
  } = data;

  let longScore = 0;
  let shortScore = 0;
  const longReasons = [];
  const shortReasons = [];

  // LONG 逻辑
  if (price > vwap) {
    longScore += 20;
    longReasons.push("站上VWAP");
  }

  if (ema9 > ema20) {
    longScore += 20;
    longReasons.push("EMA9高于EMA20");
  }

  if (price > ema9 && price > ema20) {
    longScore += 20;
    longReasons.push("价格强于均线");
  }

  if (price > openingHigh) {
    longScore += 25;
    longReasons.push("突破开盘区间高点");
  }

  if (volumeRatio >= 1.8) {
    longScore += 20;
    longReasons.push(`量比放大 ${volumeRatio}x`);
  } else if (volumeRatio >= 1.4) {
    longScore += 10;
    longReasons.push(`量比略放大 ${volumeRatio}x`);
  }

  // SHORT 逻辑
  if (price < vwap) {
    shortScore += 20;
    shortReasons.push("跌破VWAP");
  }

  if (ema9 < ema20) {
    shortScore += 20;
    shortReasons.push("EMA9低于EMA20");
  }

  if (price < ema9 && price < ema20) {
    shortScore += 20;
    shortReasons.push("价格弱于均线");
  }

  if (price < openingLow) {
    shortScore += 25;
    shortReasons.push("跌破开盘区间低点");
  }

  if (volumeRatio >= 1.8) {
    shortScore += 20;
    shortReasons.push(`量比放大 ${volumeRatio}x`);
  } else if (volumeRatio >= 1.4) {
    shortScore += 10;
    shortReasons.push(`量比略放大 ${volumeRatio}x`);
  }

  // 过滤低质量信号
  if (longScore >= 80 && longScore > shortScore) {
    const levels = calcLongLevels(price, openingLow);
    if (!levels) return null;

    return {
      side: "LONG",
      score: longScore,
      reasons: longReasons,
      ...levels,
    };
  }

  if (shortScore >= 80 && shortScore > longScore) {
    const levels = calcShortLevels(price, openingHigh);
    if (!levels) return null;

    return {
      side: "SHORT",
      score: shortScore,
      reasons: shortReasons,
      ...levels,
    };
  }

  return null;
}

async function scanMarket() {
  const results = [];

  for (const symbol of STOCKS) {
    const data = await getMockData(symbol);
    const signal = evaluateSignal(data);

    if (signal) {
      results.push({
        symbol,
        price: round(data.price),
        vwap: round(data.vwap),
        ema9: round(data.ema9),
        ema20: round(data.ema20),
        openingHigh: round(data.openingHigh),
        openingLow: round(data.openingLow),
        volumeRatio: data.volumeRatio.toFixed(2),
        ...signal,
      });
    }
  }

  return results;
}

module.exports = { scanMarket };