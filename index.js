const express = require("express");
const { scanMarket } = require("./scanner");
const { sendTelegram } = require("./telegram");
const { shouldSend, cleanOldMemory } = require("./signalMemory");

const app = express();

const ACCOUNT_SIZE = Number(process.env.ACCOUNT_SIZE || 10000);
const RISK_PERCENT = Number(process.env.RISK_PERCENT || 1);

function calcPosition(entry, stopLoss, accountSize, riskPercent) {
  const riskAmount = +(accountSize * (riskPercent / 100)).toFixed(2);
  const perShareRisk = +(Math.abs(entry - stopLoss)).toFixed(2);

  if (perShareRisk <= 0) {
    return {
      shares: 0,
      riskAmount,
      perShareRisk,
    };
  }

  const shares = Math.floor(riskAmount / perShareRisk);

  return {
    shares,
    riskAmount,
    perShareRisk,
  };
}

app.get("/api/run-scan", async (req, res) => {
  try {
    cleanOldMemory();

    const results = await scanMarket();
    const sentSignals = [];
    const skippedSignals = [];

    for (const r of results) {
      if (r.score < 80) {
        skippedSignals.push({
          symbol: r.symbol,
          reason: "score too low",
        });
        continue;
      }

      if (!shouldSend(r.symbol, r.side)) {
        skippedSignals.push({
          symbol: r.symbol,
          reason: "duplicate signal within 50 mins",
        });
        continue;
      }

      const position = calcPosition(
        Number(r.entry),
        Number(r.stopLoss),
        ACCOUNT_SIZE,
        RISK_PERCENT
      );

      const msg = [
        `🔥 美股日内做T信号`,
        `股票: ${r.symbol}`,
        `方向: ${r.side}`,
        `现价: ${r.price}`,
        ``,
        `买入价: ${r.entry}`,
        `止损价: ${r.stopLoss}`,
        `TP1: ${r.tp1}`,
        `TP2: ${r.tp2}`,
        `RR: ${r.rr}`,
        ``,
        `评分: ${r.score}`,
        `量比: ${r.volumeRatio}x`,
        `原因: ${r.reasons.join(" / ")}`,
        ``,
        `建议仓位: ${position.shares} 股`,
        `单笔风险金额: $${position.riskAmount}`,
        `每股风险: $${position.perShareRisk}`,
        ``,
        `执行提醒: ${r.plan}`,
      ].join("\n");

      await sendTelegram(msg);

      sentSignals.push({
        ...r,
        position,
      });
    }

    res.json({
      ok: true,
      total: results.length,
      sent: sentSignals.length,
      skipped: skippedSignals.length,
      sentSignals,
      skippedSignals,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/api/test-telegram", async (req, res) => {
  try {
    await sendTelegram("测试成功 ✅ Telegram 已连通");
    res.json({ ok: true, message: "Telegram sent" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});