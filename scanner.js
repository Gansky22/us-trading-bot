const axios = require("axios");

const STOCKS = [
  "AAPL", "TSLA", "NVDA", "AMD", "META", "PLTR", "AMZN", "MSFT",
  "NFLX", "GOOGL", "MU", "SMCI", "AVGO", "INTC", "QCOM", "ARM",
  "COIN", "MARA", "RIOT", "UBER", "SNOW", "SHOP", "CRM", "PANW"
];

const API_KEY = process.env.FINNHUB_API_KEY;

function round(num) {
  return Number(Number(num).toFixed(2));
}

function getUnixNow() {
  return Math.floor(Date.now() / 1000);
}

function ema(values, period) {
  if (!values || values.length < period) return null;

  const k = 2 / (period + 1);
  let emaValue = values[0];

  for (let i = 1; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }

  return emaValue;
}

function calcApproxVWAP(candles) {
  let pv = 0;
  let totalVol = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    pv += typicalPrice * c.volume;
    totalVol += c.volume;
  }

  if (!totalVol) return null;
  return pv / totalVol;
}

function calcVolumeRatio(candles) {
  if (!candles || candles.length < 8) return 1;

  const last = candles[candles.length - 1].volume || 0;
  const prev = candles.slice(-7, -1);
  const avgPrev = prev.reduce((sum, c) => sum + (c.volume || 0), 0) / prev.length;

  if (!avgPrev) return 1;
  return last / avgPrev;
}

function getOpeningRange(candles, bars = 6) {
  const firstBars = candles.slice(0, bars);
  if (!firstBars.length) {
    return { openingHigh: null, openingLow: null };
  }

  const openingHigh = Math.max(...firstBars.map(c => c.high));
  const openingLow = Math.min(...firstBars.map(c => c.low));

  return { openingHigh, openingLow };
}

function calcLongLevels(price, openingLow) {
  const stopLoss = round(Math.min(price * 0.992, openingLow * 0.998));
  const risk = round(price - stopLoss);

  if (risk <= 0) return null;

  return {
    entry: round(price),
    stopLoss,
    tp1: round(price + risk * 1.5),
    tp2: round(price + risk * 2.5),
    rr: `1:${round(2.5)}`,
    plan: "优先等回踩买入区，不追高；跌破止损位直接离场",
  };
}

function calcShortLevels(price, openingHigh) {
  const stopLoss = round(Math.max(price * 1.008, openingHigh * 1.002));
  const risk = round(stopLoss - price);

  if (risk <= 0) return null;

  return {
    entry: round(price),
    stopLoss,
    tp1: round(price - risk * 1.5),
    tp2: round(price - risk * 2.5),
    rr: `1:${round(2.5)}`,
    plan: "优先等反弹再空，不追空；站回止损位上方直接离场",
  };
}

function getSignalTier(score) {
  if (score >= 85) {
    return {
      tier: "爆发机会",
      icon: "💎",
    };
  }

  if (score >= 70) {
    return {
      tier: "强势机会",
      icon: "🔥",
    };
  }

  if (score >= 55) {
    return {
      tier: "观察名单",
      icon: "🟢",
    };
  }

  return null;
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

  if (
    [price, vwap, ema9, ema20, openingHigh, openingLow, volumeRatio].some(
      v => v === null || v === undefined || Number.isNaN(v)
    )
  ) {
    return null;
  }

  let longScore = 0;
  let shortScore = 0;
  const longReasons = [];
  const shortReasons = [];

  if (price > vwap) {
    longScore += 18;
    longReasons.push("站上VWAP");
  }
  if (ema9 > ema20) {
    longScore += 18;
    longReasons.push("EMA9高于EMA20");
  }
  if (price > ema9 && price > ema20) {
    longScore += 18;
    longReasons.push("价格强于均线");
  }
  if (price > openingHigh) {
    longScore += 22;
    longReasons.push("突破开盘区间高点");
  }
  if (volumeRatio >= 2.0) {
    longScore += 22;
    longReasons.push(`量比明显放大 ${round(volumeRatio)}x`);
  } else if (volumeRatio >= 1.5) {
    longScore += 14;
    longReasons.push(`量比放大 ${round(volumeRatio)}x`);
  } else if (volumeRatio >= 1.2) {
    longScore += 8;
    longReasons.push(`量比略放大 ${round(volumeRatio)}x`);
  }

  if (price < vwap) {
    shortScore += 18;
    shortReasons.push("跌破VWAP");
  }
  if (ema9 < ema20) {
    shortScore += 18;
    shortReasons.push("EMA9低于EMA20");
  }
  if (price < ema9 && price < ema20) {
    shortScore += 18;
    shortReasons.push("价格弱于均线");
  }
  if (price < openingLow) {
    shortScore += 22;
    shortReasons.push("跌破开盘区间低点");
  }
  if (volumeRatio >= 2.0) {
    shortScore += 22;
    shortReasons.push(`量比明显放大 ${round(volumeRatio)}x`);
  } else if (volumeRatio >= 1.5) {
    shortScore += 14;
    shortReasons.push(`量比放大 ${round(volumeRatio)}x`);
  } else if (volumeRatio >= 1.2) {
    shortScore += 8;
    shortReasons.push(`量比略放大 ${round(volumeRatio)}x`);
  }

  if (longScore >= 55 && longScore > shortScore) {
    const levels = calcLongLevels(price, openingLow);
    if (!levels) return null;

    const signalTier = getSignalTier(longScore);
    if (!signalTier) return null;

    return {
      side: "LONG",
      score: longScore,
      reasons: longReasons,
      ...signalTier,
      ...levels,
    };
  }

  if (shortScore >= 55 && shortScore > longScore) {
    const levels = calcShortLevels(price, openingHigh);
    if (!levels) return null;

    const signalTier = getSignalTier(shortScore);
    if (!signalTier) return null;

    return {
      side: "SHORT",
      score: shortScore,
      reasons: shortReasons,
      ...signalTier,
      ...levels,
    };
  }

  return null;
}

async function fetchQuote(symbol) {
  const url = "https://finnhub.io/api/v1/quote";
  const { data } = await axios.get(url, {
    params: {
      symbol,
      token: API_KEY,
    },
    timeout: 15000,
  });

  return data;
}

async function fetchCandles(symbol) {
  const now = getUnixNow();
  const from = now - 60 * 60 * 8;

  const url = "https://finnhub.io/api/v1/stock/candle";
  const { data } = await axios.get(url, {
    params: {
      symbol,
      resolution: 5,
      from,
      to: now,
      token: API_KEY,
    },
    timeout: 15000,
  });

  if (!data || data.s !== "ok" || !Array.isArray(data.c)) {
    return [];
  }

  return data.c.map((close, i) => ({
    close: Number(close),
    high: Number(data.h[i]),
    low: Number(data.l[i]),
    open: Number(data.o[i]),
    volume: Number(data.v[i]),
    time: Number(data.t[i]),
  }));
}

async function buildSymbolData(symbol) {
  const [quote, candles] = await Promise.all([
    fetchQuote(symbol),
    fetchCandles(symbol),
  ]);

  if (!quote || !quote.c || !candles.length) {
    return null;
  }

  const closes = candles.map(c => c.close);
  const ema9 = ema(closes.slice(-30), 9);
  const ema20 = ema(closes.slice(-40), 20);
  const vwap = calcApproxVWAP(candles);
  const volumeRatio = calcVolumeRatio(candles);
  const { openingHigh, openingLow } = getOpeningRange(candles, 6);

  return {
    symbol,
    price: Number(quote.c),
    open: Number(quote.o),
    high: Number(quote.h),
    low: Number(quote.l),
    prevClose: Number(quote.pc),
    vwap,
    ema9,
    ema20,
    openingHigh,
    openingLow,
    volumeRatio,
  };
}

async function scanMarket() {
  if (!API_KEY) {
    throw new Error("FINNHUB_API_KEY is missing");
  }

  const results = [];

  for (const symbol of STOCKS) {
    try {
      const data = await buildSymbolData(symbol);
      if (!data) continue;

      const signal = evaluateSignal(data);
      if (!signal) continue;

      results.push({
        symbol,
        price: round(data.price),
        open: round(data.open),
        high: round(data.high),
        low: round(data.low),
        prevClose: round(data.prevClose),
        vwap: round(data.vwap),
        ema9: round(data.ema9),
        ema20: round(data.ema20),
        openingHigh: round(data.openingHigh),
        openingLow: round(data.openingLow),
        volumeRatio: round(data.volumeRatio),
        ...signal,
      });
    } catch (err) {
      console.log(`scan ${symbol} failed:`, err.message);
    }
  }

  return results;
}

module.exports = { scanMarket };