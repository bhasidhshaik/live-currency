// services/scrapeRates.js
import axios from "axios";
// import  cheerio from "cheerio";
import * as cheerio from "cheerio";


function toNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[^\d,.\-]/g, "").trim();
  // If contains comma and dot, assume dot is thousands and comma decimal (unlikely here),
  // otherwise replace comma with dot.
  if (cleaned.split(",").length > 1 && cleaned.split(".").length === 1) {
    return parseFloat(cleaned.replace(",", "."));
  }
  // fallback: remove commas used as thousands separators
  return parseFloat(cleaned.replace(/,/g, ""));
}


function findRateByRegex(html) {
  const text = html.replace(/\s+/g, " ");

  // Pattern: "R$1 BRL = 0,1858 USD"  (BRL -> USD)
  let m = text.match(/R\$?\s*1\s*BRL\s*=\s*([\d.,]+)/i);
  if (m) return { direction: "BRL->USD", rate: toNumber(m[1]) };

  // Pattern: "1 BRL = 0.1858 USD"
  m = text.match(/1\s*BRL\s*=\s*([\d.,]+)\s*USD/i);
  if (m) return { direction: "BRL->USD", rate: toNumber(m[1]) };

  // Pattern: "US$ 1 = R$ 5,49" OR "US$1 = R$5.49" (USD -> BRL)
  m = text.match(/US\$?\s*1\s*=?\s*=?\s*R\$?\s*([\d.,]+)/i) || text.match(/1\s*USD\s*=\s*R\$?\s*([\d.,]+)/i);
  if (m) return { direction: "USD->BRL", rate: toNumber(m[1]) };

  // Pattern: "Valor total: US$ 1 = R$ 5,49" (extra words)
  m = text.match(/US\$?\s*1[^0-9]{0,10}R\$?\s*([\d.,]+)/i);
  if (m) return { direction: "USD->BRL", rate: toNumber(m[1]) };

  return null;
}


async function parseWise(url) {
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    timeout: 10_000,
  });

  // try targeted selector (from the DOM snippet you had)
  const $ = cheerio.load(html);
  const target = $('div._midMarketRateAmount_14arr_139 span[dir="ltr"]').first().text().trim();
  if (target) {
    // e.g. "R$1 BRL = 0,1858 USD"
    const m = target.match(/([\d.,]+)\s*USD/i);
    if (m) {
      const brlToUsd = toNumber(m[1]);
      if (brlToUsd) {
        const usdToBrl = 1 / brlToUsd;
        return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
      }
    }
  }

  // fallback: search in whole HTML
  const found = findRateByRegex(html);
  if (found) {
    if (found.direction === "BRL->USD") {
      const usdToBrl = 1 / found.rate;
      return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
    } else {
      return { buy_price: found.rate, sell_price: found.rate, source: url };
    }
  }

  // if nothing found
  return { buy_price: null, sell_price: null, source: url };
}


async function parseNomad(url) {
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    timeout: 10_000,
  });

  const $ = cheerio.load(html);

  // try a targeted selector if present
  let foundText = null;
  // possible labels seen: "Valor total: US$ 1 = R$ 5,49" or "US$ 1 = R$ 5,49"
  const detail = $(".ConverterDetailsMobile__item,.ConverterDetailsMobile__item-label").first().text();
  if (detail && detail.length > 0) foundText = detail;

  if (!foundText) {
    // fallback to regex across html
    const found = findRateByRegex(html);
    if (found) {
      if (found.direction === "BRL->USD") {
        const usdToBrl = 1 / found.rate;
        return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
      } else {
        return { buy_price: found.rate, sell_price: found.rate, source: url };
      }
    }
    return { buy_price: null, sell_price: null, source: url };
  }

  // parse the text we found
  const mUsdToBrl = foundText.match(/US\$?\s*1\s*=?\s*R\$?\s*([\d.,]+)/i) || foundText.match(/1\s*USD\s*=\s*R\$?\s*([\d.,]+)/i);
  if (mUsdToBrl) {
    const v = toNumber(mUsdToBrl[1]);
    return { buy_price: v, sell_price: v, source: url };
  }

  // fallback regex scan
  const found = findRateByRegex(foundText);
  if (found) {
    if (found.direction === "BRL->USD") {
      const usdToBrl = 1 / found.rate;
      return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
    } else {
      return { buy_price: found.rate, sell_price: found.rate, source: url };
    }
  }

  return { buy_price: null, sell_price: null, source: url };
}


async function parseNubank(url) {
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    timeout: 10_000,
  });

  // search for likely phrases
  const $ = cheerio.load(html);
  // try to find any element that contains "cambio", "taxa", "US$", "R$" near each other
  const candidate = $("body").text().slice(0, 50000); // limited length
  // direct regex scan
  const found = findRateByRegex(candidate || html);
  if (found) {
    if (found.direction === "BRL->USD") {
      const usdToBrl = 1 / found.rate;
      return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
    } else {
      return { buy_price: found.rate, sell_price: found.rate, source: url };
    }
  }

  // final fallback: try to find numeric mentions like "R$ 5,49" and "US$" nearby
  const nearMatch = candidate.match(/(US\$?.{0,20}R\$?[\d.,]+|R\$?.{0,20}US\$?[\d.,]+)/i);
  if (nearMatch) {
    const maybe = findRateByRegex(nearMatch[0]);
    if (maybe) {
      if (maybe.direction === "BRL->USD") {
        const usdToBrl = 1 / maybe.rate;
        return { buy_price: usdToBrl, sell_price: usdToBrl, source: url };
      } else {
        return { buy_price: maybe.rate, sell_price: maybe.rate, source: url };
      }
    }
  }

  // If nothing works, return nulls (you can decide to throw if you want strict failure)
  return { buy_price: null, sell_price: null, source: url };
}


export async function fetchBRLQuotes() {
  const sources = [
    { url: "https://wise.com/es/currency-converter/brl-to-usd-rate", parser: parseWise },
    { url: "https://nubank.com.br/taxas-conversao/", parser: parseNubank },
    { url: "https://www.nomadglobal.com", parser: parseNomad },
  ];

  const results = [];
  for (const s of sources) {
    try {
      const q = await s.parser(s.url);
      results.push(q);
    } catch (err) {
      console.error("Error scraping", s.url, err.message || err);
      results.push({ buy_price: null, sell_price: null, source: s.url });
    }
  }
  return results;
}
