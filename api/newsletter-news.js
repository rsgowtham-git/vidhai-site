// /api/newsletter-news.js
// Fetches real AI/manufacturing/semiconductor news from RSS feeds

import Parser from 'rss-parser';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://vidhai.co');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Vidhai Newsletter Bot'
      }
    });

    // RSS feeds focused on AI, manufacturing, semiconductors
    const feeds = [
      'https://www.semiconductor-digest.com/feed/',
      'https://www.manufacturing.net/rss/topic/3494-automation',
      'https://venturebeat.com/category/ai/feed/',
    ];

    const allArticles = [];

    // Fetch from each feed
    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const articles = feed.items.slice(0, 3).map(item => ({
          title: item.title,
          description: item.contentSnippet || item.content?.substring(0, 200) || 'No description available',
          url: item.link,
          source: feed.title,
          publishedAt: item.pubDate
        }));
        allArticles.push(...articles);
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
      count: topArticles.length
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
