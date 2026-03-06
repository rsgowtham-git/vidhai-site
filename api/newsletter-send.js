// ============================================
// VIDHAI — Newsletter Send API (Vercel Serverless)
// Sends newsletter to all active subscribers via Resend
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured. Add RESEND_API_KEY to Vercel env vars.' });
  }

  try {
    const { subject, htmlContent, frequency } = req.body || {};

    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Subject and HTML content are required.' });
    }

    // Fetch active subscribers (optionally filter by frequency)
    let query = 'subscribers?status=eq.active&select=email,frequency';
    if (frequency && frequency !== 'all') {
      query += `&frequency=eq.${frequency}`;
    }
    const subResult = await supabaseFetch(query);
    const subscribers = subResult.data || [];

    if (subscribers.length === 0) {
      return res.status(200).json({ success: true, message: 'No active subscribers to send to.', sent: 0 });
    }

    // Send emails in batches of 50 (Resend batch API limit is 100)
    const BATCH_SIZE = 50;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      
      // Send individual emails so each has their own unsubscribe link
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
            console.error(`Failed to send to ${sub.email}:`, await emailRes.text());
          }
        } catch (err) {
          totalFailed++;
          console.error(`Error sending to ${sub.email}:`, err.message);
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
      message: `Newsletter sent to ${totalSent} subscriber${totalSent !== 1 ? 's' : ''}${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}.`,
      sent: totalSent,
      failed: totalFailed
    });

  } catch (err) {
    console.error('Newsletter send error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
