const express = require("express");
const { scanMarket } = require("./scanner");
const { sendTelegram } = require("./telegram");

const app = express();

app.get("/api/run-scan", async (req, res) => {
  try {
    const results = await scanMarket();

    if (results.length > 0) {
      for (let r of results) {
        await sendTelegram(
          `🔥 做T机会\n股票: ${r.symbol}\n方向: ${r.side}\n价格: ${r.price}\n原因: ${r.reason}`
        );
      }
    }

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "running" });
});

app.listen(3000, () => console.log("Server running"));