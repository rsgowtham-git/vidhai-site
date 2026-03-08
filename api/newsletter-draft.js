// ============================================
// VIDHAI — Newsletter Draft Generator API
// Generates newsletter content from recent posts
// UPDATED: Now includes news, highlights, market data, IPOs, and AI tools reminder
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

function generateNewsletterHTML(posts, frequency = 'weekly', newsletterData = null) {
  const formattedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Safely unwrap newsletterData
  const {
    topNews = [],
    industryHighlights = [],
    bestPerformers = [],
    worstPerformers = [],
    upcomingIPOs = [],
    aiToolsReminder = ''
  } = newsletterData || {};

  const postsHTML = posts.map(post => `
    <tr>
      <td style="padding: 30px 0; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #111827;">
          ${post.title}
        </h2>
        <div style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
          <span>${post.date}</span>${post.readTime ? ` • <span>${post.readTime}</span>` : ''}
          ${post.tags && post.tags.length > 0 ? ` • <span>${post.tags.join(', ')}</span>` : ''}
        </div>
        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
          ${post.excerpt}
        </p>
        <a href="https://vidhai.co/blog.html?post=${post.id}" 
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; 
                  text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
          Read Full Article →
        </a>
      </td>
    </tr>
  `).join('');

  const topNewsHTML = topNews.length
    ? `
      <tr>
        <td style="padding: 30px 40px 10px 40px; border-top: 1px solid #e5e7eb;">
          <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111827;">
            Top 3 News
          </h2>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${topNews.slice(0, 3).map(item => `
              <tr>
                <td style="padding: 12px 0;">
                  <a href="${item.url}" style="font-size: 16px; font-weight: 500; color: #1d4ed8; text-decoration: none;">
                    ${item.title}
                  </a>
                  <p style="margin: 4px 0 0 0; font-size: 14px; line-height: 1.5; color: #4b5563;">
                    ${item.summary}
                  </p>
                </td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    `
    : '';

  const industryHighlightsHTML = industryHighlights.length
    ? `
      <tr>
        <td style="padding: 20px 40px 10px 40px;">
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111827;">
            Industry Highlights
          </h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #374151;">
            ${industryHighlights.slice(0, 3).map(item => `
              <li style="margin-bottom: 6px;">${item}</li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `
    : '';

  const bestWorstHTML = (bestPerformers.length || worstPerformers.length)
    ? `
      <tr>
        <td style="padding: 20px 40px 10px 40px;">
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111827;">
            Market Snapshot (From Vidhai Commentary)
          </h2>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td valign="top" style="width: 50%; padding-right: 10px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #16a34a;">
                  Top 3 Best Performers
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #374151;">
                  ${bestPerformers.slice(0, 3).map(item => `
                    <li style="margin-bottom: 4px;">${item}</li>
                  `).join('')}
                </ul>
              </td>
              <td valign="top" style="width: 50%; padding-left: 10px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #dc2626;">
                  Top 3 Worst Performers
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #374151;">
                  ${worstPerformers.slice(0, 3).map(item => `
                    <li style="margin-bottom: 4px;">${item}</li>
                  `).join('')}
                </ul>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : '';

  const iposHTML = upcomingIPOs.length
    ? `
      <tr>
        <td style="padding: 20px 40px 10px 40px;">
          <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111827;">
            Top 3 Upcoming IPOs
          </h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #374151;">
            ${upcomingIPOs.slice(0, 3).map(item => `
              <li style="margin-bottom: 4px;">${item}</li>
            `).join('')}
          </ul>
        </td>
      </tr>
    `
    : '';

  const aiToolsHTML = aiToolsReminder
    ? `
      <tr>
        <td style="padding: 30px 40px 20px 40px; border-top: 1px solid #e5e7eb;">
          <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 600; color: #111827;">
            Try the Vidhai AI Tools
          </h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
            ${aiToolsReminder}
          </p>
          <a href="https://vidhai.co/meetpilot.html"
             style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff;
                    text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; margin-right: 8px;">
            Explore MeetPilot →
          </a>
          <a href="https://vidhai.co"
             style="display: inline-block; padding: 12px 24px; background-color: #e5e7eb; color: #111827;
                    text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
            View All Tools →
          </a>
        </td>
      </tr>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vidhai Newsletter — ${formattedDate}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; color: #111827;">
                Vidhai
              </h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                Your AI Intelligence Brief
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #9ca3af;">
                ${formattedDate}
              </p>
            </td>
          </tr>

          <!-- Introduction -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
                ${frequency === 'weekly'
                  ? "Here's your weekly roundup of AI insights, industry shifts, and Vidhai commentary."
                  : "Fresh insights from Vidhai on AI, automation, and the future of work."}
              </p>
            </td>
          </tr>

          <!-- Top News -->
          ${topNewsHTML}

          <!-- Industry Highlights -->
          ${industryHighlightsHTML}

          <!-- Best/Worst Performers -->
          ${bestWorstHTML}

          <!-- Upcoming IPOs -->
          ${iposHTML}

          <!-- Blog Posts -->
          ${postsHTML}

          <!-- AI Tools Reminder -->
          ${aiToolsHTML}

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you subscribed to Vidhai's newsletter.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                <a href="{{UNSUBSCRIBE_URL}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
                 • 
                <a href="https://vidhai.co" style="color: #6b7280; text-decoration: underline;">Visit Website</a>
              </p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #d1d5db;">
                © 2026 Vidhai. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Fetch posts from Supabase (or fall back to posts.json)
    let posts = [];
    
    try {
      // Try to get posts from Supabase first
      const postsResult = await supabaseFetch('posts?order=created_at.desc&limit=5');
      if (postsResult.status === 200 && Array.isArray(postsResult.data)) {
        posts = postsResult.data;
      }
    } catch (err) {
      console.log('Could not fetch from Supabase, will use posts.json fallback');
    }

    // Fallback to posts.json if Supabase doesn't have posts table yet
    if (posts.length === 0) {
      const postsJsonUrl = 'https://raw.githubusercontent.com/rsgowtham-git/vidhai-site/main/posts.json';
      const postsRes = await fetch(postsJsonUrl);
      if (postsRes.ok) {
        const allPosts = await postsRes.json();
        // Get the 3 most recent posts
        posts = allPosts.slice(0, 3);
      }
    }

    if (posts.length === 0) {
      return res.status(404).json({ 
        error: 'No posts found to generate newsletter' 
      });
    }

    // Load curated sections from newsletter-data.json
    let newsletterData = null;
    try {
      const ndRes = await fetch('https://raw.githubusercontent.com/rsgowtham-git/vidhai-site/main/newsletter-data.json');
      if (ndRes.ok) {
        newsletterData = await ndRes.json();
      }
    } catch (e) {
      console.error('Failed to load newsletter-data.json', e);
    }

    // Get subscriber count for metadata
    const subsResult = await supabaseFetch('subscribers?status=eq.active&select=email');
    const subscriberCount = Array.isArray(subsResult.data) ? subsResult.data.length : 0;

    // Determine frequency (can be passed as query param, default to weekly)
    const frequency = req.query.frequency || 'weekly';

    // Generate newsletter HTML
    const htmlContent = generateNewsletterHTML(posts, frequency, newsletterData);

    // Generate subject line
    const subjectDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const subject = frequency === 'weekly' 
      ? `Vidhai Weekly: AI Insights for ${subjectDate}`
      : `Vidhai Update: ${posts[0].title}`;

    return res.status(200).json({
      success: true,
      subject: subject,
      htmlContent: htmlContent,
      postCount: posts.length,
      subscriberCount: subscriberCount,
      frequency: frequency,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title,
        date: p.date,
        excerpt: p.excerpt
      }))
    });

  } catch (err) {
    console.error('Newsletter draft generation error:', err);
    return res.status(500).json({ 
      error: err.message || 'Failed to generate newsletter draft' 
    });
  }
};
