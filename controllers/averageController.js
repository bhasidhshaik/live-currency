// controllers/averageController.js
import { fetchBRLQuotes } from "../services/scrapeRates.js";

export const getAverage = async (req, res) => {
  try {
    const region = (req.query.region || "brl").toLowerCase();
    if (region !== "brl") return res.status(400).json({ error: "Only region=brl implemented" });

    const quotes = await fetchBRLQuotes();

    const valid = quotes.filter(q => typeof q.buy_price === "number" && !Number.isNaN(q.buy_price));
    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: "No valid quotes found" });
    }

    const average_buy_price = valid.reduce((s, q) => s + q.buy_price, 0) / valid.length;
    const average_sell_price = valid.reduce((s, q) => s + q.sell_price, 0) / valid.length;

    return res.json({
      success: true,
      average_buy_price,
      average_sell_price,
      sources: valid.map(q => q.source),
    });
  } catch (err) {
    console.error("getAverage error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
