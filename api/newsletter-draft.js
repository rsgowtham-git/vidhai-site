// /api/newsletter-draft.js
// Generates a newsletter subject + body using real news and curated IPOs

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const baseUrl = process.env.VIDHAI_BASE_URL || 'https://vidhai.co';

    // 1) Fetch news articles
    const newsResponse = await fetch(`${baseUrl}/api/newsletter-news`);
    let newsData = { success: false, articles: [] };
    if (newsResponse.ok) {
      newsData = await newsResponse.json();
    }

    const articles = newsData.articles || [];

    const topNews = articles.slice(0, 3);
    const insights = articles.slice(3, 6);

    // 2) Curated IPOs (edit as needed)
    const upcomingIPOs = [
      {
        company: 'OpenAI',
        description: 'Leading AI research organization behind ChatGPT and GPT-4, expanding into enterprise AI platforms.',
        expected: 'Q2 2026',
        why: 'Sets benchmarks for foundation models used across manufacturing, design, and supply chain optimization.'
      },
      {
        company: 'SpaceX Starlink',
        description: 'Global satellite internet constellation targeting ubiquitous low-latency connectivity.',
        expected: '2H 2026',
        why: 'Enables resilient connectivity for remote plants, mobile assets, and distributed industrial IoT.'
      },
      {
        company: 'SiFive',
        description: 'RISC-V chip designer focused on customizable CPU IP for AI and edge workloads.',
        expected: '2026 (watchlist)',
        why: 'Open architectures may reshape how industrial controllers and edge devices are designed.'
      }
    ];

    const ipos = upcomingIPOs.slice(0, 3);

    // 3) Build a human-readable subject line
    const firstTitle = topNews[0]?.title || 'AI & Manufacturing Weekly Briefing';
    const subject = `Vidhai Weekly — ${firstTitle}`.slice(0, 120);

    // 4) Build the body text (plain text / markdown-ish)
    let body = '';

    body += 'Top 3 News
';
    body += '-----------
';
    if (topNews.length === 0) {
      body += '- No major stories this week.

';
    } else {
      topNews.forEach((a, idx) => {
        body += `${idx + 1}. ${a.title}
`;
        if (a.description) body += `${a.description}
`;
        if (a.url) body += `${a.url}
`;
        body += '
';
      });
    }

    body += '
Industry Insights
';
    body += '-----------------
';
    if (insights.length === 0) {
      body += '- No additional deep dives this week.

';
    } else {
      insights.forEach((a, idx) => {
        body += `${idx + 1}. ${a.title}
`;
        if (a.description) body += `${a.description}
`;
        if (a.url) body += `${a.url}
`;
        body += '
';
      });
    }

    body += '
Top 3 Upcoming IPOs
';
    body += '-------------------
';
    if (ipos.length === 0) {
      body += '- No IPOs on our watchlist this week.

';
    } else {
      ipos.forEach((ipo, idx) => {
        body += `${idx + 1}. ${ipo.company} — ${ipo.description}
`;
        body += `   Expected: ${ipo.expected}
`;
        body += `   Why it matters: ${ipo.why}

`;
      });
    }

    // Trim trailing whitespace
    body = body.trim() + '
';

    return res.status(200).json({
      success: true,
      subject,
      body
    });

  } catch (error) {
    console.error('newsletter-draft error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
