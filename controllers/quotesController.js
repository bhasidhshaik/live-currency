import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

// Helper to clean numbers like "R$ 5,49" or "5.49"
const toNumber = (str) => {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d,.,]/g, "").trim();
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    return parseFloat(cleaned.replace(",", "."));
  }
  return parseFloat(cleaned.replace(/,/g, ""));
};

export const getQuotes = async (req, res) => {
  const { region = "brl" } = req.query;
  const quotes = [];
  console.log("⚡ Fetching quotes for region:", region);

  try {
    // --- 🟢 1️⃣ WISE (static content, Axios + Cheerio) ---
    try {
      const wiseUrl = "https://wise.com/es/currency-converter/brl-to-usd-rate";
      const { data } = await axios.get(wiseUrl, { timeout: 20000 });
      const $ = cheerio.load(data);

      // Example text: "1 BRL = 0,1860 USD" → we invert it to get USD→BRL
      const text = $('span[data-test="exchange-rate"]').first().text().trim();
      const match = text.match(/=\s*([\d.,]+)/);
      if (match) {
        const rateUsd = toNumber(match[1]);
        const usdToBrl = rateUsd ? 1 / rateUsd : null;
        if (usdToBrl) {
          quotes.push({
            buy_price: usdToBrl,
            sell_price: usdToBrl,
            source: wiseUrl,
          });
        }
      }
    } catch (err) {
      console.warn("⚠️ Wise scraping failed:", err.message);
    }

    // --- 🟣 Launch Puppeteer once for JS-heavy sites ---
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // --- 🟠 2️⃣ NUBANK (JS-rendered) ---
    try {
      const nubankUrl = "https://nubank.com.br/taxas-conversao/";
      const page = await browser.newPage();
      await page.goto(nubankUrl, { waitUntil: "networkidle2", timeout: 60000 });

      const text = await page.evaluate(() => document.body.innerText);
      // Usually like "US$ 1 = R$ 5,48"
      const match = text.match(/US\$ ?1\s*=\s*R\$ ?([\d.,]+)/i);
      if (match) {
        const rate = toNumber(match[1]);
        quotes.push({
          buy_price: rate,
          sell_price: rate,
          source: nubankUrl,
        });
      }
    } catch (err) {
      console.warn("⚠️ Nubank scraping failed:", err.message);
    }

    // --- 🔵 3️⃣ NOMAD (also JS-rendered) ---
    try {
      const nomadUrl = "https://www.nomadglobal.com";
      const page = await browser.newPage();
      await page.goto(nomadUrl, { waitUntil: "networkidle2", timeout: 60000 });

      const text = await page.evaluate(() => document.body.innerText);
      // Example: "US$ 1 = R$ 5,49"
      const match = text.match(/US\$ ?1\s*=\s*R\$ ?([\d.,]+)/i);
      if (match) {
        const rate = toNumber(match[1]);
        quotes.push({
          buy_price: rate,
          sell_price: rate,
          source: nomadUrl,
        });
      }
    } catch (err) {
      console.warn("⚠️ Nomad scraping failed:", err.message);
    }

    await browser.close();

    // --- ✅ Validate and Respond ---
    const validQuotes = quotes.filter(q => q.buy_price && q.sell_price);
    if (validQuotes.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No valid quotes scraped from sources",
      });
    }

    res.json({
      success: true,
      region,
      quotes: validQuotes,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ getQuotes error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
