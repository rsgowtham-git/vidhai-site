// /api/newsletter-draft.js
// Generates a structured newsletter draft using real news + curated IPOs

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1) Fetch real news articles (already implemented)
    const newsResponse = await fetch(`${process.env.VIDHAI_BASE_URL || 'https://vidhai.co'}/api/newsletter-news`);
    let newsData = { success: false, articles: [] };
    if (newsResponse.ok) {
      newsData = await newsResponse.json();
    }

    // Take up to 3 articles for Top News
    const topNewsArticles = (newsData.articles || []).slice(0, 3).map((a, index) => ({
      id: `news-${index + 1}`,
      title: a.title,
      summary: a.description,
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt
    }));

    // 2) Curated IPO data (edit this array as needed)
    const upcomingIPOs = [
      {
        company: 'OpenAI',
        description: 'Leading AI research organization behind ChatGPT and GPT-4, expanding into enterprise AI platforms.',
        expected: 'Q2 2026',
        why_it_matters: 'Sets benchmarks for foundation models used across manufacturing, design, and supply chain optimization.'
      },
      {
        company: 'SpaceX Starlink',
        description: 'Global satellite internet constellation targeting ubiquitous low-latency connectivity.',
        expected: '2H 2026',
        why_it_matters: 'Enables resilient connectivity for remote plants, mobile assets, and distributed industrial IoT.'
      },
      {
        company: 'SiFive',
        description: 'RISC-V chip designer focused on customizable CPU IP for AI and edge workloads.',
        expected: '2026 (watchlist)',
        why_it_matters: 'Open instruction set architectures may reshape how specialized industrial controllers are designed.'
      }
    ];

    const ipoItems = upcomingIPOs.slice(0, 3).map((ipo, index) => ({
      id: `ipo-${index + 1}`,
      title: ipo.company,
      description: ipo.description,
      expected: ipo.expected,
      whyItMatters: ipo.why_it_matters
    }));

    // 3) Industry insights section based on remaining news
    const remainingArticles = (newsData.articles || []).slice(3, 6);
    const insights = remainingArticles.map((a, index) => ({
      id: `insight-${index + 1}`,
      title: a.title,
      takeaway: a.description,
      url: a.url,
      source: a.source
    }));

    // 4) Build the draft payload expected by your frontend
    const draft = {
      metadata: {
        generatedAt: new Date().toISOString(),
        newsSource: newsData.source || 'hybrid',
        newsCount: newsData.count || 0
      },
      sections: {
        topNews: {
          title: 'Top 3 News',
          items: topNewsArticles
        },
        industryInsights: {
          title: 'Industry Insights',
          items: insights
        },
        ipos: {
          title: 'Top 3 Upcoming IPOs',
          items: ipoItems
        }
      }
    };

    return res.status(200).json({
      success: true,
      draft
    });

  } catch (error) {
    console.error('newsletter-draft error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
