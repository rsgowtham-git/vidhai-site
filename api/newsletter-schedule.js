// ============================================
// VIDHAI — Newsletter Schedule API (Optional)
// Can be triggered via GitHub Actions or Vercel Cron
// for automated weekly/monthly newsletter sends
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SCHEDULE_SECRET = process.env.NEWSLETTER_SCHEDULE_SECRET; // Add this to Vercel env vars for security

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

function generateNewsletterHTML(posts, frequency = 'weekly') {
  const formattedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const postsHTML = posts.map(post => `
    <tr>
      <td style="padding: 30px 0; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #111827;">
          ${post.title}
        </h2>
        <div style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
          <span>${post.date}</span> • <span>${post.readTime}</span>
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
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; color: #111827;">
                விதை Vidhai
              </h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                Your AI Intelligence Brief
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #9ca3af;">
                ${formattedDate}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
                ${frequency === 'weekly' ? 'Here\'s your weekly roundup of AI insights, training resources, and industry transformations from Vidhai.' : 'Fresh insights from Vidhai on AI, automation, and the future of work.'}
              </p>
            </td>
          </tr>
          ${postsHTML}
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #111827;">
                Stay Connected
              </h3>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #6b7280;">
                Visit our blog for more insights on AI, training, and manufacturing transformation.
              </p>
              <a href="https://vidhai.co/blog.html" 
                 style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; 
                        text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; margin: 0 8px 8px 0;">
                Visit Blog
              </a>
              <a href="https://www.linkedin.com/in/gowtham-rs/" 
                 style="display: inline-block; padding: 14px 32px; background-color: #0a66c2; color: #ffffff; 
                        text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; margin: 0 8px 8px 0;">
                Connect on LinkedIn
              </a>
            </td>
          </tr>
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
  // Security: Verify secret token
  const authHeader = req.headers.authorization;
  if (!SCHEDULE_SECRET || authHeader !== `Bearer ${SCHEDULE_SECRET}`) {
    return res.status(401).json({ 
      error: 'Unauthorized. Set NEWSLETTER_SCHEDULE_SECRET in Vercel env vars.' 
    });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ 
      error: 'Resend API key not configured. Add RESEND_API_KEY to Vercel env vars.' 
    });
  }

  try {
    const frequency = req.query.frequency || 'weekly';
    
    // Check if we should send (e.g., only on Mondays for weekly)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (frequency === 'weekly' && dayOfWeek !== 1) {
      return res.status(200).json({ 
        success: true, 
        message: 'Not Monday. Weekly newsletter only sends on Mondays.',
        skipped: true
      });
    }

    // Fetch recent posts
    let posts = [];
    try {
      const postsResult = await supabaseFetch('posts?order=created_at.desc&limit=5');
      if (postsResult.status === 200 && Array.isArray(postsResult.data)) {
        posts = postsResult.data;
      }
    } catch (err) {
      console.log('Fetching from posts.json fallback');
    }

    if (posts.length === 0) {
      const postsJsonUrl = 'https://raw.githubusercontent.com/rsgowtham-git/vidhai-site/main/posts.json';
      const postsRes = await fetch(postsJsonUrl);
      if (postsRes.ok) {
        const allPosts = await postsRes.json();
        posts = allPosts.slice(0, 3);
      }
    }

    if (posts.length === 0) {
      return res.status(404).json({ 
        error: 'No posts found to send newsletter' 
      });
    }

    // Get active subscribers
    const subsResult = await supabaseFetch('subscribers?status=eq.active&select=email,frequency');
    const subscribers = subsResult.data || [];

    if (subscribers.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No active subscribers.',
        sent: 0 
      });
    }

    // Generate newsletter
    const htmlContent = generateNewsletterHTML(posts, frequency);
    const subjectDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const subject = frequency === 'weekly' 
      ? `Vidhai Weekly: AI Insights for ${subjectDate}`
      : `Vidhai Update: ${posts[0].title}`;

    // Send emails
    const BATCH_SIZE = 50;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async (sub) => {
        const unsubUrl = `https://vidhai.co/api/subscribers?action=unsubscribe&email=${encodeURIComponent(sub.email)}`;
        const personalizedHTML = htmlContent.replace(/{{UNSUBSCRIBE_URL}}/g, unsubUrl);
        
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Vidhai <newsletter@vidhai.co>',
              to: [sub.email],
              subject: subject,
              html: personalizedHTML,
              headers: {
                'List-Unsubscribe': `<${unsubUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
              }
            })
          });
          
          if (emailRes.ok) {
            totalSent++;
          } else {
            totalFailed++;
          }
        } catch (err) {
          totalFailed++;
        }
      });

      await Promise.all(promises);
    }

    // Log the send
    await supabaseFetch('newsletter_sends', {
      method: 'POST',
      body: JSON.stringify({
        subject: subject,
        recipient_count: totalSent,
        status: totalFailed > 0 ? (totalSent > 0 ? 'partial' : 'failed') : 'sent'
      })
    });

    return res.status(200).json({
      success: true,
      message: `Automated newsletter sent to ${totalSent} subscribers.`,
      sent: totalSent,
      failed: totalFailed
    });

  } catch (err) {
    console.error('Scheduled newsletter error:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error' 
    });
  }
};
