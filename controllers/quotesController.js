import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";


const toNumber = (str) => {
  if (!str) return null;
  // Remove all non-numeric characters except comma and dot
  const cleaned = String(str).replace(/[^\d,.,]/g, "").trim();
  
  // Handle Brazilian format "5,49" -> 5.49
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
      const { data } = await axios.get(wiseUrl, {
        timeout: 20000,
        // Add a user-agent to mimic a browser
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      const $ = cheerio.load(data);

      // NEW LOGIC: Based on your snippet "<span dir="ltr">R$1 BRL = 0,1860 USD</span>"
      // Instead of a data-test attribute, we'll find the span that contains the key text.
      // We look for the text "BRL = ... USD"
      let wiseText = null;
      $('span').each((i, el) => {
        const text = $(el).text();
        if (text.includes('BRL') && text.includes('USD') && text.includes('=')) {
          wiseText = text;
          return false; // Stop iterating once we find it
        }
      });
      
      if (wiseText) {
        // Original text was "1 BRL = 0,1860 USD" or "R$1 BRL = 0,1860 USD"
        // We just need the number after the "="
        const match = wiseText.match(/=\s*([\d.,]+)/);
        if (match && match[1]) {
          const rateUsd = toNumber(match[1]); // e.g., 0.1860
          const usdToBrl = rateUsd ? 1 / rateUsd : null; // Invert to get USD -> BRL
          if (usdToBrl) {
            console.log(`✅ Wise rate found: ${usdToBrl}`);
            quotes.push({
              buy_price: usdToBrl,
              sell_price: usdToBrl,
              source: wiseUrl,
            });
          }
        }
      } else {
         console.warn("⚠️ Wise selector couldn't find rate text.");
      }
    } catch (err) {
      console.warn("⚠️ Wise scraping failed:", err.message);
    }

    // --- 🟣 Launch Puppeteer once for JS-heavy sites ---
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    // --- 🟠 2️⃣ NUBANK (JS-rendered) ---
    try {
      const nubankUrl = "https://nubank.com.br/taxas-conversao/";
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
      await page.goto(nubankUrl, { waitUntil: "networkidle2", timeout: 60000 });

      // NOTE: The HTML snippet you provided for Nubank did not contain an exchange rate.
      // This site is very difficult to scrape. We must fall back to the original
      // method of searching all body text, which is fragile.
      const text = await page.evaluate(() => document.body.innerText);
      
      // Usually like "US$ 1 = R$ 5,48"
      const match = text.match(/US\$ ?1\s*=\s*R\$ ?([\d.,]+)/i);
      if (match && match[1]) {
        const rate = toNumber(match[1]);
        console.log(`✅ Nubank rate found: ${rate}`);
        quotes.push({
          buy_price: rate,
          sell_price: rate,
          source: nubankUrl,
        });
      } else {
        console.warn("⚠️ Nubank regex couldn't find rate on page.");
      }
      await page.close();
    } catch (err) {
      console.warn("⚠️ Nubank scraping failed:", err.message);
    }

    // --- 🔵 3️⃣ NOMAD (also JS-rendered) ---
    try {
      const nomadUrl = "https://www.nomadglobal.com";
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
      await page.goto(nomadUrl, { waitUntil: "networkidle2", timeout: 60000 });

      const text = await page.evaluate(() => document.body.innerText);
      
      // NEW REGEX: Based on your finding: "Valor total: US$ 1 = R$ 5,49"
      const match = text.match(/Valor total: US\$ ?1\s*=\s*R\$ ?([\d.,]+)/i);
      if (match && match[1]) {
        const rate = toNumber(match[1]);
        console.log(`✅ Nomad rate found: ${rate}`);
        quotes.push({
          buy_price: rate,
          sell_price: rate,
          source: nomadUrl,
        });
      } else {
        console.warn("⚠️ Nomad regex couldn't find rate on page.");
      }
      await page.close();
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

    console.log("✔️ Successfully fetched quotes:", validQuotes.length);
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
