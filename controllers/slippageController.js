// controllers/slippageController.js
import { fetchBRLQuotes } from "../services/scrapeRates.js";

export const getSlippage = async (req, res) => {
  try {
    const region = (req.query.region || "brl").toLowerCase();
    if (region !== "brl") return res.status(400).json({ error: "Only region=brl implemented" });

    const quotes = await fetchBRLQuotes();
    const valid = quotes.filter(q => typeof q.buy_price === "number" && !Number.isNaN(q.buy_price));
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: "No valid quotes found" });
    }

    const avgBuy = valid.reduce((s, q) => s + q.buy_price, 0) / valid.length;
    const avgSell = valid.reduce((s, q) => s + q.sell_price, 0) / valid.length;

    const slippage = valid.map(q => ({
      source: q.source,
      buy_price_slippage: (q.buy_price - avgBuy) / avgBuy,
      sell_price_slippage: (q.sell_price - avgSell) / avgSell,
      buy_price: q.buy_price,
      sell_price: q.sell_price,
    }));

    return res.json({ success: true, average: { buy: avgBuy, sell: avgSell }, slippage });
  } catch (err) {
    console.error("getSlippage error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
