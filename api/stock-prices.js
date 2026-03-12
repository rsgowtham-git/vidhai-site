// Vercel Serverless Function — Live Stock Price Fetcher
// GET /api/stock-prices?tickers=NVDA,AVGO,MRVL,...
// Returns live quotes from Yahoo Finance v8 chart API for the requested tickers.
// Falls back gracefully if any ticker fails.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var tickerParam = req.query.tickers;
  if (!tickerParam) {
    return res.status(400).json({ error: 'tickers parameter required (comma-separated)' });
  }

  var tickers = tickerParam.split(',').map(function(t) { return t.trim().toUpperCase(); }).filter(Boolean);
  if (tickers.length === 0) {
    return res.status(400).json({ error: 'No valid tickers provided' });
  }
  if (tickers.length > 25) {
    return res.status(400).json({ error: 'Maximum 25 tickers per request' });
  }

  try {
    var results = {};

    // Fetch each ticker via v8 chart API (no auth required)
    var promises = tickers.map(async function(ticker) {
      try {
        var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=5d&includePrePost=false';
        var resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vidhai/1.0)' }
        });
        if (!resp.ok) return;
        var data = await resp.json();
        var chart = data.chart;
        if (!chart || !chart.result || !chart.result[0]) return;

        var meta = chart.result[0].meta;
        var price = meta.regularMarketPrice;
        var prevClose = meta.chartPreviousClose;
        var change = price && prevClose ? parseFloat((price - prevClose).toFixed(2)) : null;
        var changePct = price && prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : null;

        // Market cap from volume * price approximation is not reliable
        // Try to get market cap from indicators if available
        var volume = meta.regularMarketVolume || null;

        results[ticker] = {
          price: price || null,
          change: change,
          change_percent: changePct,
          market_cap: null, // v8 doesn't provide market cap directly
          pe_ratio: null,   // v8 doesn't provide PE directly
          prev_close: prevClose || null,
          market_state: null
        };
      } catch (e) {
        // Skip failed tickers silently
      }
    });

    await Promise.all(promises);

    // Try to enrich with PE and market cap via a single v7 quote call (may fail due to auth)
    try {
      var symbols = tickers.join(',');
      var quoteUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbols);
      var quoteResp = await fetch(quoteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vidhai/1.0)' }
      });
      if (quoteResp.ok) {
        var quoteData = await quoteResp.json();
        var quotes = (quoteData.quoteResponse && quoteData.quoteResponse.result) || [];
        quotes.forEach(function(q) {
          if (results[q.symbol]) {
            // Update with richer data from v7 if available
            if (q.regularMarketPrice) results[q.symbol].price = q.regularMarketPrice;
            if (q.regularMarketChange != null) results[q.symbol].change = parseFloat(q.regularMarketChange.toFixed(2));
            if (q.regularMarketChangePercent != null) results[q.symbol].change_percent = parseFloat(q.regularMarketChangePercent.toFixed(2));
            if (q.marketCap) results[q.symbol].market_cap = formatMarketCap(q.marketCap);
            if (q.trailingPE != null) results[q.symbol].pe_ratio = parseFloat(q.trailingPE.toFixed(2));
            results[q.symbol].market_state = q.marketState || null;
          }
        });
      }
    } catch (e) {
      // v7 enrichment failed; v8 data is still available
    }

    // Cache for 2 minutes during market hours, 30 minutes otherwise
    var now = new Date();
    var hour = now.getUTCHours();
    var isMarketOpen = (now.getUTCDay() >= 1 && now.getUTCDay() <= 5) && (hour >= 14 && hour < 21);
    var cacheSeconds = isMarketOpen ? 120 : 1800;

    res.setHeader('Cache-Control', 'public, s-maxage=' + cacheSeconds + ', stale-while-revalidate=' + (cacheSeconds * 2));
    return res.status(200).json({ quotes: results, fetched_at: now.toISOString() });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function formatMarketCap(val) {
  if (!val) return '';
  if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
  if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
  return String(val);
}
