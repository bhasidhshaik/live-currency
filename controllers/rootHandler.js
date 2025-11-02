// controllers/rootController.js
export const rootHandler = (req, res) => {
  // If client specifically wants JSON, return machine-readable docs
  if (req.accepts("json") && !req.accepts("html")) {
    return res.json({
      name: "RateBridge (example)",
      version: "1.0.0",
      description: "API that scrapes multiple sources and returns live currency quotes (USD↔BRL).",
      base_url: req.protocol + "://" + req.get("host"),
      endpoints: [
        {
          path: "/api/quotes",
          method: "GET",
          description: "Scrapes configured sources and returns per-source quotes.",
          query: { region: "brl (default) | ars (optional future)" },
          returns: [
            {
              buy_price: "Number (USD → BRL or USD→ARS depending on region)",
              sell_price: "Number",
              source: "String (URL)"
            }
          ],
          example: {
            request: "/api/quotes?region=brl",
            response: {
              success: true,
              region: "brl",
              quotes: [
                { buy_price: 5.37, sell_price: 5.37, source: "https://wise.com/..." },
                { buy_price: 5.45, sell_price: 5.45, source: "https://nubank.com.br/..." }
              ],
              updated_at: "2025-10-31T19:32:17.383Z"
            }
          }
        },
        {
          path: "/api/average",
          method: "GET",
          description: "Fetches live quotes (same scrapers) and returns average buy & sell prices computed across valid sources.",
          query: { region: "brl (default)" },
          example: {
            request: "/api/average?region=brl",
            response: {
              success: true,
              average_buy_price: 5.403333,
              average_sell_price: 5.403333
            }
          }
        },
        {
          path: "/api/slippage",
          method: "GET",
          description: "Fetches live quotes and returns slippage per source relative to the computed average.",
          query: { region: "brl (default)" },
          example: {
            request: "/api/slippage?region=brl",
            response: {
              success: true,
              average: { buy: 5.40, sell: 5.40 },
              slippage: [
                { source: "https://wise.com/...", buy_price_slippage: 0.005, sell_price_slippage: 0.005 }
              ]
            }
          }
        }
      ],
      notes: [
        "All endpoints fetch fresh data on each request (no cache) — ensure your environment allows outbound requests and puppeteer if used.",
        "If a site renders client-side (JS), Puppeteer is used as a fallback. Puppeteer adds latency and needs a headless Chrome runtime in your environment.",
        "Timeouts and DNS failures will result in a 500 or partial responses when no valid sources are available."
      ],
      contact: "Your Name / repo link"
    });
  }

  // Otherwise serve a small HTML documentation page
  const base = req.protocol + "://" + req.get("host");
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>RateBridge — API Documentation</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      body { font-family: Inter, Roboto, system-ui, -apple-system, "Segoe UI", Arial; line-height:1.5; padding:28px; color:#0f172a; background:#f8fafc }
      h1{margin:0 0 8px}
      p.lead{color:#475569;margin:0 0 18px}
      pre{background:#0b1220;color:#dbeafe;padding:12px;border-radius:8px;overflow:auto}
      .card{background:#fff;border-radius:10px;padding:18px;box-shadow:0 6px 18px rgba(2,6,23,0.06);margin-bottom:14px}
      code{background:#eef2ff;padding:3px 6px;border-radius:5px}
      a.inline{color:#0b73ff}
    </style>
  </head>
  <body>
    <h1>RateBridge API</h1>
    <p class="lead">Simple API that scrapes multiple sources to return live currency quotes, averages and slippage.</p>

    <div class="card">
      <h3>Base URL</h3>
      <p><code>${base}/api</code></p>
    </div>

    <div class="card">
      <h3>Endpoints</h3>

      <h4><code>GET /api/quotes?region=brl</code></h4>
      <p>Scrape sources and return an array of per-source quotes.</p>
      <pre>{
  "success": true,
  "region": "brl",
  "quotes": [
    { "buy_price": 5.37, "sell_price": 5.37, "source": "https://wise.com/..." },
    { "buy_price": 5.45, "sell_price": 5.45, "source": "https://nubank.com.br/..." }
  ],
  "updated_at": "2025-10-31T19:32:17.383Z"
}</pre>

      <h4><code>GET /api/average?region=brl</code></h4>
      <p>Return the average buy & sell price across valid scraped sources.</p>
      <pre>{
  "success": true,
  "average_buy_price": 5.403333,
  "average_sell_price": 5.403333
}</pre>

      <h4><code>GET /api/slippage?region=brl</code></h4>
      <p>Return slippage per source relative to the average.</p>
      <pre>{
  "success": true,
  "average": { "buy": 5.40, "sell": 5.40 },
  "slippage": [
    { "source": "https://wise.com/...", "buy_price_slippage": 0.005 }
  ]
}</pre>
    </div>

    <div class="card">
      <h3>Notes</h3>
      <ul>
        <li>All endpoints fetch fresh data on every request (max freshness per assignment).</li>
        <li>Sites that render client-side use Puppeteer — ensure your host supports headless Chrome or run on a dev machine for tests.</li>
        <li>Network/DNS timeouts will produce partial results or an error if none of the sources return valid values.</li>
      </ul>
    </div>

    <div style="color:#64748b;font-size:13px;margin-top:6px">
      <strong>Tip:</strong> For machine use request <code>Accept: application/json</code> to receive the JSON-formatted documentation.
    </div>
  </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};
