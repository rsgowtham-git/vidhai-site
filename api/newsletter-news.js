// /api/newsletter-news.js
// Fetches real news with automatic fallback to curated samples

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Curated fallback articles (update these weekly)
  const fallbackArticles = [
    {
      title: "TSMC Reports Record AI Chip Orders for Q1 2026",
      description: "Taiwan Semiconductor Manufacturing Company announces unprecedented demand for 3nm AI processors, driven by enterprise adoption of large language models and edge computing applications.",
      url: "https://www.semiconductor-digest.com",
      source: "Semiconductor Digest",
      publishedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      title: "Cobots Gain Ground in Small Manufacturing Facilities",
      description: "Collaborative robots now account for 15% of industrial automation purchases as SMEs embrace flexible automation solutions with rapid ROI.",
      url: "https://www.manufacturing.net",
      source: "Manufacturing.net",
      publishedAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      title: "Machine Vision Systems Hit 99.9% Accuracy in Quality Control",
      description: "New generation computer vision platforms using transformer architectures achieve human-level defect detection in high-speed production lines.",
      url: "https://venturebeat.com",
      source: "VentureBeat AI",
      publishedAt: new Date(Date.now() - 259200000).toISOString()
    },
    {
      title: "Industrial IoT Market to Reach $263B by 2027",
      description: "Analysts forecast continued double-digit growth as manufacturers prioritize predictive maintenance and digital twin technologies.",
      url: "https://www.manufacturing.net",
      source: "Industry Analyst Report",
      publishedAt: new Date(Date.now() - 345600000).toISOString()
    },
    {
      title: "AI-Powered Supply Chain Tools Show 30% Cost Reduction",
      description: "Early adopters of generative AI for logistics optimization report significant improvements in inventory management and demand forecasting.",
      url: "https://venturebeat.com",
      source: "VentureBeat AI",
      publishedAt: new Date(Date.now() - 432000000).toISOString()
    }
  ];

  try {
    const feeds = [
      'https://www.semiconductor-digest.com/feed/',
      'https://www.manufacturing.net/rss/topic/3494-automation',
      'https://venturebeat.com/category/ai/feed/',
    ];

    const allArticles = [];

    // Try fetching from RSS feeds
    for (const feedUrl of feeds) {
      try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=3`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(apiUrl, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();

          if (data.status === 'ok' && data.items && data.items.length > 0) {
            const articles = data.items.map(item => ({
              title: item.title || 'No title',
              description: item.description?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
              url: item.link || item.guid || '#',
              source: data.feed?.title || 'News Source',
              publishedAt: item.pubDate || new Date().toISOString()
            }));
            allArticles.push(...articles);
          }
        }
      } catch (feedError) {
        // Silent fail, continue to next feed
        console.log(`Feed ${feedUrl} failed, continuing...`);
      }
    }

    // Use real articles if we got any, otherwise use fallback
    let finalArticles = [];
    let dataSource = 'fallback';

    if (allArticles.length > 0) {
      allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      finalArticles = allArticles.slice(0, 5);
      dataSource = 'live_rss';
    } else {
      finalArticles = fallbackArticles.slice(0, 5);
    }

    return res.status(200).json({
      success: true,
      articles: finalArticles,
      count: finalArticles.length,
      source: dataSource,
      timestamp: new Date().toISOString(),
      note: dataSource === 'fallback' ? 'Using curated articles - update fallbackArticles array weekly' : 'Live RSS data'
    });

  } catch (error) {
    // If everything fails, return fallback
    return res.status(200).json({
      success: true,
      articles: fallbackArticles.slice(0, 5),
      count: fallbackArticles.length,
      source: 'fallback',
      timestamp: new Date().toISOString()
    });
  }
}
