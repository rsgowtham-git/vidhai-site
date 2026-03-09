// /api/newsletter-news.js
// Fetches real AI/manufacturing/semiconductor news using native fetch (no dependencies)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Use a free RSS-to-JSON conversion service
    const feeds = [
      'https://www.semiconductor-digest.com/feed/',
      'https://www.manufacturing.net/rss/topic/3494-automation',
      'https://venturebeat.com/category/ai/feed/',
    ];

    const allArticles = [];

    // Fetch from each feed using rss2json.com (free, no auth needed)
    for (const feedUrl of feeds) {
      try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=3`;
        const response = await fetch(apiUrl, {
          timeout: 8000
        });

        if (!response.ok) {
          console.error(`Feed ${feedUrl} returned ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.status === 'ok' && data.items) {
          const articles = data.items.map(item => ({
            title: item.title || 'No title',
            description: item.description?.replace(/<[^>]*>/g, '').substring(0, 200) || 'No description available',
            url: item.link || item.guid,
            source: data.feed?.title || 'News Source',
            publishedAt: item.pubDate
          }));
          allArticles.push(...articles);
        }
      } catch (feedError) {
        console.error(`Error fetching ${feedUrl}:`, feedError.message);
        // Continue with other feeds
      }
    }

    // Sort by date and take top 5
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const topArticles = allArticles.slice(0, 5);

    return res.status(200).json({
      success: true,
      articles: topArticles,
      count: topArticles.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('RSS fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      articles: []
    });
  }
}
