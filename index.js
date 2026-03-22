const express = require("express");
const { scanMarket } = require("./scanner");
const { sendTelegram } = require("./telegram");

const app = express();

app.get("/api/run-scan", async (req, res) => {
  try {
    const results = await scanMarket();

    if (results.length > 0) {
      for (const r of results) {
        const msg = [
          `🔥 美股日内做T信号`,
          `股票: ${r.symbol}`,
          `方向: ${r.side}`,
          `现价: ${r.price}`,
          `买入价: ${r.entry}`,
          `止损价: ${r.stopLoss}`,
          `TP1: ${r.tp1}`,
          `TP2: ${r.tp2}`,
          `RR: ${r.rr}`,
          `评分: ${r.score}`,
          `原因: ${r.reasons.join(" / ")}`,
          `执行提醒: ${r.plan}`,
        ].join("\n");

        await sendTelegram(msg);
      }
    }

    res.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});