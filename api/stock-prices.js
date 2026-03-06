// Vercel Serverless Function — Live Stock Price Fetcher
// GET /api/stock-prices?tickers=NVDA,AVGO,MRVL,...
// Returns live quotes from Yahoo Finance for the requested tickers.
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
    var symbols = tickers.join(',');
    var url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbols);

    var resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Vidhai/1.0)'
      }
    });

    if (!resp.ok) {
      // Fallback: try v6 endpoint
      var url6 = 'https://query2.finance.yahoo.com/v6/finance/quote?symbols=' + encodeURIComponent(symbols);
      resp = await fetch(url6, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Vidhai/1.0)'
        }
      });
    }

    if (!resp.ok) {
      return res.status(502).json({ error: 'Could not fetch stock data', status: resp.status });
    }

    var data = await resp.json();
    var quotes = (data.quoteResponse && data.quoteResponse.result) || [];

    var results = {};
    quotes.forEach(function(q) {
      results[q.symbol] = {
        price: q.regularMarketPrice || null,
        change: q.regularMarketChange != null ? parseFloat(q.regularMarketChange.toFixed(2)) : null,
        change_percent: q.regularMarketChangePercent != null ? parseFloat(q.regularMarketChangePercent.toFixed(2)) : null,
        market_cap: formatMarketCap(q.marketCap),
        prev_close: q.regularMarketPreviousClose || null,
        market_state: q.marketState || null
      };
    });

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
