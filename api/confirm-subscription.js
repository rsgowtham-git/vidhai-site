// ============================================
// VIDHAI — Confirm Subscription (Double Opt-In)
// Verifies token and activates subscriber
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

  const { token } = req.query || {};

  if (!token) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(renderPage('Invalid Link', 'This confirmation link is missing a token. Please try subscribing again.', true));
  }

  try {
    // Look up subscriber by token
    const result = await supabaseFetch(
      `subscribers?verification_token=eq.${encodeURIComponent(token)}&select=id,email,status,token_expires_at,frequency`
    );

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(renderPage('Link Expired or Invalid', 'This confirmation link is no longer valid. It may have already been used or expired. Please subscribe again at vidhai.co.', true));
    }

    const sub = result.data[0];

    // Already confirmed?
    if (sub.status === 'active') {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(renderPage('Already Confirmed', 'Your subscription is already active. You are all set to receive the Vidhai newsletter.', false));
    }

    // Check expiry (24 hours)
    if (sub.token_expires_at && new Date(sub.token_expires_at) < new Date()) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(410).send(renderPage('Link Expired', 'This confirmation link has expired. Please subscribe again at vidhai.co to get a new one.', true));
    }

    // Activate the subscriber
    const update = await supabaseFetch(`subscribers?id=eq.${sub.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'active',
        verification_token: null,
        token_expires_at: null
      })
    });

    if (update.status >= 400) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(500).send(renderPage('Something Went Wrong', 'We could not confirm your subscription. Please try again or contact us.', true));
    }

    // Send the welcome email now that they are confirmed
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vidhai <newsletter@vidhai.co>',
            to: [sub.email],
            subject: 'Welcome to Vidhai — AI Takes Root',
            html: getWelcomeEmailHTML(sub.email)
          })
        });
      } catch (e) {
        console.error('Welcome email failed:', e);
      }

      // Notify admin
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vidhai <newsletter@vidhai.co>',
            to: ['rsgowtham@gmail.com'],
            subject: `New Confirmed Subscriber: ${sub.email}`,
            html: `<p>New confirmed subscriber: <strong>${sub.email}</strong></p><p>Frequency: ${sub.frequency || 'weekly'}</p><p>Confirmed at: ${new Date().toISOString()}</p>`
          })
        });
      } catch (e) {
        console.error('Admin notification failed:', e);
      }
    }

    // Success page
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(renderPage(
      'Subscription Confirmed',
      'Welcome to Vidhai. Your subscription is now active and you will receive curated AI and semiconductor industry insights in your inbox.',
      false
    ));

  } catch (err) {
    console.error('Confirm subscription error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(renderPage('Something Went Wrong', 'An unexpected error occurred. Please try again.', true));
  }
};

function renderPage(title, message, isError) {
  const bgColor = '#0d1117';
  const cardBg = '#161b22';
  const borderColor = '#30363d';
  const titleColor = isError ? '#f87171' : '#34d399';
  return `<!DOCTYPE html>
<html><head><title>${title} — Vidhai</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:${bgColor};color:#e6edf3;}
  .card{text-align:center;padding:3rem;border-radius:12px;background:${cardBg};border:1px solid ${borderColor};max-width:420px;margin:20px;}
  h1{font-size:1.5rem;margin-bottom:1rem;color:${titleColor};}
  p{color:#8b949e;line-height:1.6;margin:0 0 1rem 0;}
  a{color:#58a6ff;text-decoration:none;}
  a:hover{text-decoration:underline;}
</style></head>
<body><div class="card">
  <h1>${title}</h1>
  <p>${message}</p>
  <p style="margin-top:1.5rem"><a href="https://vidhai.co">&larr; Back to Vidhai</a></p>
</div></body></html>`;
}

function getWelcomeEmailHTML(email) {
  const unsubUrl = `https://vidhai.co/api/subscribers?action=unsubscribe&email=${encodeURIComponent(email)}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #e2e8f0;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:24px;color:#0f172a;margin:0 0 8px 0;">Welcome to Vidhai</h1>
      <p style="color:#64748b;font-size:14px;margin:0;">AI Takes Root</p>
    </div>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Your subscription is confirmed. You will receive curated AI and semiconductor industry insights directly in your inbox.
    </p>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Here is what you can expect:
    </p>
    <ul style="color:#334155;font-size:15px;line-height:1.9;margin:0 0 24px 0;padding-left:20px;">
      <li>Latest AI news and model releases</li>
      <li>Semiconductor industry updates</li>
      <li>Curated video recommendations</li>
      <li>Original analysis and insights</li>
    </ul>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
      In the meantime, visit <a href="https://vidhai.co" style="color:#0ea5e9;text-decoration:none;font-weight:500;">vidhai.co</a> to explore the latest articles.
    </p>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0;">
      — Team Vidhai
    </p>
  </div>
  <div style="text-align:center;margin-top:24px;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      <a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> · 
      <a href="https://vidhai.co" style="color:#94a3b8;text-decoration:underline;">vidhai.co</a>
    </p>
  </div>
</div>
</body>
</html>`;
}
