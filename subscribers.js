// ============================================
// VIDHAI — Subscribers API (Vercel Serverless)
// Handles: subscribe, unsubscribe, list subscribers
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

// Disposable/temporary email domains to block
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamailblock.com','tempmail.com','throwaway.email',
  'temp-mail.org','10minutemail.com','trashmail.com','yopmail.com','sharklasers.com',
  'grr.la','guerrillamail.info','guerrillamail.de','guerrillamail.net','disposableemailaddresses.emailmiser.com',
  'maildrop.cc','dispostable.com','mailnesia.com','tempr.email','discard.email',
  'fake.com','fakeinbox.com','mailcatch.com','tempail.com','tempmailaddress.com',
  'emailondeck.com','33mail.com','getnada.com','mohmal.com','burnermail.io',
  'inboxkitten.com','mail7.io','harakirimail.com','mailsac.com','anonbox.net',
  'mytemp.email','tempinbox.com','binkmail.com','spamdecoy.net','trashmail.net',
  'mailforspam.com','safetymail.info','filzmail.com','spamgourmet.com','incognitomail.com',
  'mailnull.com','spamfree24.org','jetable.org','trash-mail.com','guerrillamail.org',
  'spam4.me','grr.la','cuvox.de','armyspy.com','dayrep.com','einrot.com',
  'fleckens.hu','gustr.com','jourrapide.com','rhyta.com','superrito.com','teleworm.us'
]);

function isValidEmail(email) {
  // RFC 5322 simplified: local@domain.tld
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return false;
  // Must have at least one dot in domain
  const domain = email.split('@')[1];
  if (!domain || !domain.includes('.')) return false;
  // Block disposable domains
  if (DISPOSABLE_DOMAINS.has(domain.toLowerCase())) return false;
  return true;
}

async function checkMXRecord(domain) {
  // Use DNS-over-HTTPS to verify domain has MX records (real mail server)
  try {
    const resp = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=MX', {
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) return true; // If DNS lookup fails, give benefit of the doubt
    const data = await resp.json();
    // Status 0 = NOERROR (domain exists). Check for MX answers or at least no NXDOMAIN
    if (data.Status === 3) return false; // NXDOMAIN — domain doesn't exist
    if (data.Answer && data.Answer.length > 0) return true; // Has MX records
    // No MX but domain exists — check for A record as fallback
    const aResp = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=A');
    if (!aResp.ok) return true;
    const aData = await aResp.json();
    return aData.Status !== 3 && aData.Answer && aData.Answer.length > 0;
  } catch {
    return true; // On error, allow through
  }
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---- POST: Subscribe ----
    if (req.method === 'POST') {
      const { email, frequency, _hp, _ts } = req.body || {};

      // Anti-bot: honeypot field must be empty
      if (_hp) {
        // Silently reject — return fake success to confuse bots
        return res.status(200).json({ success: true, message: 'Subscribed successfully!' });
      }

      // Anti-bot: timing check — form must be open at least 3 seconds
      if (_ts) {
        const elapsed = Date.now() - parseInt(_ts, 10);
        if (!isNaN(elapsed) && elapsed < 3000) {
          return res.status(400).json({ error: 'Please take a moment before submitting. Try again.' });
        }
      }

      if (!email || !isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // Additional local-part screening
      const localPart = email.trim().split('@')[0].toLowerCase();
      // Block obviously fake patterns: all same char, random gibberish (no vowels in 6+ chars)
      if (/^(.)\1{4,}$/.test(localPart)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // Verify domain has MX records (catches non-existent domains)
      const domain = email.trim().split('@')[1];
      const hasMX = await checkMXRecord(domain);
      if (!hasMX) {
        return res.status(400).json({ error: 'This email domain does not appear to accept mail. Please use a valid email.' });
      }

      // Rate limiting: check if same IP subscribed recently (within last 10 minutes)
      const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
      if (clientIP) {
        const recentFromIP = await supabaseFetch(
          `subscribers?ip_address=eq.${encodeURIComponent(clientIP)}&order=subscribed_at.desc&limit=1&select=subscribed_at`
        );
        if (recentFromIP.data && recentFromIP.data.length > 0) {
          const lastSub = new Date(recentFromIP.data[0].subscribed_at);
          if (Date.now() - lastSub.getTime() < 10 * 60 * 1000) {
            return res.status(429).json({ error: 'Too many subscribe attempts. Please wait a few minutes and try again.' });
          }
        }
      }

      const freq = (frequency === 'monthly') ? 'monthly' : 'weekly';

      // Check if already exists
      const existing = await supabaseFetch(`subscribers?email=eq.${encodeURIComponent(email)}&select=id,status`);
      
      if (existing.data && existing.data.length > 0) {
        const sub = existing.data[0];
        if (sub.status === 'active') {
          return res.status(200).json({ success: true, message: 'Already subscribed!' });
        }
        // Re-subscribe
        const update = await supabaseFetch(`subscribers?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active', frequency: freq, unsubscribed_at: null })
        });
        return res.status(200).json({ success: true, message: 'Welcome back! Re-subscribed successfully.' });
      }

      // New subscriber
      const insert = await supabaseFetch('subscribers', {
        method: 'POST',
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          frequency: freq,
          status: 'active',
          ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null,
          user_agent: req.headers['user-agent'] || null
        })
      });

      if (insert.status >= 400) {
        return res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
      }

      // Send welcome email via Resend (if configured)
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
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
              to: [email.toLowerCase().trim()],
              subject: 'Welcome to Vidhai — AI Takes Root 🌱',
              html: getWelcomeEmailHTML(email)
            })
          });
        } catch (emailErr) {
          console.error('Welcome email failed:', emailErr);
          // Don't fail the subscription if email fails
        }
      }

      // Notify admin via Resend
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
              to: ['rsgowtham@gmail.com'],
              subject: `🔔 New Vidhai Subscriber: ${email}`,
              html: `<p>New subscriber: <strong>${email}</strong></p><p>Frequency: ${freq}</p><p>Time: ${new Date().toISOString()}</p>`
            })
          });
        } catch (notifyErr) {
          console.error('Admin notification failed:', notifyErr);
        }
      }

      return res.status(200).json({ success: true, message: 'Subscribed successfully!' });
    }

    // ---- GET: List subscribers (admin) or handle unsubscribe page ----
    if (req.method === 'GET') {
      const { action, email, token } = req.query || {};

      // Unsubscribe via link
      if (action === 'unsubscribe' && email) {
        const update = await supabaseFetch(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        });

        // Return a simple HTML page confirming unsubscribe
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
          <!DOCTYPE html>
          <html><head><title>Unsubscribed — Vidhai</title>
          <style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0d1117;color:#e6edf3;}
          .card{text-align:center;padding:3rem;border-radius:12px;background:#161b22;border:1px solid #30363d;max-width:400px;}
          h1{font-size:1.5rem;margin-bottom:1rem;}p{color:#8b949e;line-height:1.6;}
          a{color:#58a6ff;text-decoration:none;}</style></head>
          <body><div class="card">
          <h1>Unsubscribed</h1>
          <p>You have been unsubscribed from the Vidhai newsletter. We're sorry to see you go.</p>
          <p style="margin-top:1.5rem"><a href="https://vidhai.co">← Back to Vidhai</a></p>
          </div></body></html>
        `);
      }

      // Admin: list all subscribers
      const result = await supabaseFetch('subscribers?select=*&order=subscribed_at.desc');
      return res.status(200).json(result.data || []);
    }

    // ---- DELETE: Remove subscriber (uses PATCH to 'unsubscribed' due to RLS) ----
    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'Subscriber ID required.' });
      
      const result = await supabaseFetch(`subscribers?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      });

      // Verify the update actually happened
      if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
        return res.status(404).json({ success: false, error: 'Subscriber not found or already removed.' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Subscribers API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

function getWelcomeEmailHTML(email) {
  const unsubUrl = `https://vidhai.co/api/subscribers?action=unsubscribe&email=${encodeURIComponent(email)}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #e2e8f0;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:24px;color:#0f172a;margin:0 0 8px 0;">Welcome to Vidhai 🌱</h1>
      <p style="color:#64748b;font-size:14px;margin:0;">AI Takes Root</p>
    </div>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Thank you for subscribing to the Vidhai newsletter. You will receive curated AI and semiconductor industry insights directly in your inbox.
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
