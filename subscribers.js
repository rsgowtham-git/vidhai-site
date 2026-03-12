// ============================================
// VIDHAI — Subscribers API (Vercel Serverless)
// Handles: subscribe (double opt-in), unsubscribe, list subscribers
// ============================================

const crypto = require('crypto');

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

// Disposable/temporary email domains to block
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamailblock.com','tempmail.com','throwaway.email',
  'temp-mail.org','10minutemail.com','trashmail.com','yopmail.com','sharklasers.com',
  'grr.la','guerrillamail.info','guerrillamail.de','guerrillamail.net',
  'maildrop.cc','dispostable.com','mailnesia.com','tempr.email','discard.email',
  'fake.com','fakeinbox.com','mailcatch.com','tempail.com','tempmailaddress.com',
  'emailondeck.com','33mail.com','getnada.com','mohmal.com','burnermail.io',
  'inboxkitten.com','mail7.io','harakirimail.com','mailsac.com','anonbox.net',
  'mytemp.email','tempinbox.com','binkmail.com','spamdecoy.net','trashmail.net',
  'mailforspam.com','safetymail.info','filzmail.com','spamgourmet.com','incognitomail.com',
  'mailnull.com','spamfree24.org','jetable.org','trash-mail.com','guerrillamail.org',
  'spam4.me','cuvox.de','armyspy.com','dayrep.com','einrot.com',
  'fleckens.hu','gustr.com','jourrapide.com','rhyta.com','superrito.com','teleworm.us'
]);

function isValidEmail(email) {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return false;
  const domain = email.split('@')[1];
  if (!domain || !domain.includes('.')) return false;
  if (DISPOSABLE_DOMAINS.has(domain.toLowerCase())) return false;
  return true;
}

function generateToken() {
  return crypto.randomUUID();
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---- POST: Subscribe (double opt-in) ----
    if (req.method === 'POST') {
      const { email, frequency, _hp, _ts } = req.body || {};

      // Anti-bot: honeypot field must be empty
      if (_hp) {
        return res.status(200).json({ success: true, message: 'Check your inbox to confirm your subscription.' });
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

      const cleanEmail = email.toLowerCase().trim();
      const freq = (frequency === 'monthly') ? 'monthly' : 'weekly';

      // Rate limiting: check if same IP subscribed recently (within last 5 minutes)
      const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
      if (clientIP) {
        const recentFromIP = await supabaseFetch(
          `subscribers?ip_address=eq.${encodeURIComponent(clientIP)}&order=subscribed_at.desc&limit=1&select=subscribed_at`
        );
        if (recentFromIP.data && recentFromIP.data.length > 0) {
          const lastSub = new Date(recentFromIP.data[0].subscribed_at);
          if (Date.now() - lastSub.getTime() < 5 * 60 * 1000) {
            return res.status(429).json({ error: 'Too many subscribe attempts. Please wait a few minutes and try again.' });
          }
        }
      }

      // Check if already exists
      const existing = await supabaseFetch(`subscribers?email=eq.${encodeURIComponent(cleanEmail)}&select=id,status,verification_token`);

      if (existing.data && existing.data.length > 0) {
        const sub = existing.data[0];
        if (sub.status === 'active') {
          return res.status(200).json({ success: true, message: 'You are already subscribed.' });
        }
        if (sub.status === 'pending') {
          // Resend confirmation email with new token
          const token = generateToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await supabaseFetch(`subscribers?id=eq.${sub.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              verification_token: token,
              token_expires_at: expiresAt,
              frequency: freq
            })
          });
          await sendConfirmationEmail(cleanEmail, token);
          return res.status(200).json({ success: true, message: 'We sent another confirmation email. Please check your inbox (and spam folder).' });
        }
        // Was unsubscribed — start fresh with double opt-in
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabaseFetch(`subscribers?id=eq.${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'pending',
            verification_token: token,
            token_expires_at: expiresAt,
            frequency: freq,
            unsubscribed_at: null
          })
        });
        await sendConfirmationEmail(cleanEmail, token);
        return res.status(200).json({ success: true, message: 'Please check your inbox and click the confirmation link to resubscribe.' });
      }

      // New subscriber — insert as 'pending'
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const insert = await supabaseFetch('subscribers', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          frequency: freq,
          status: 'pending',
          verification_token: token,
          token_expires_at: expiresAt,
          ip_address: clientIP,
          user_agent: req.headers['user-agent'] || null
        })
      });

      if (insert.status >= 400) {
        console.error('Insert failed:', insert.data);
        return res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
      }

      // Send confirmation email
      await sendConfirmationEmail(cleanEmail, token);

      return res.status(200).json({
        success: true,
        message: 'Almost there! Please check your inbox and click the confirmation link to complete your subscription.'
      });
    }

    // ---- GET: List subscribers (admin) or handle unsubscribe ----
    if (req.method === 'GET') {
      const { action, email } = req.query || {};

      // Unsubscribe via link
      if (action === 'unsubscribe' && email) {
        await supabaseFetch(`subscribers?email=eq.${encodeURIComponent(email.toLowerCase().trim())}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), verification_token: null })
        });

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
          <p style="margin-top:1.5rem"><a href="https://vidhai.co">&larr; Back to Vidhai</a></p>
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
        body: JSON.stringify({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), verification_token: null })
      });

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

// Send the confirmation email with a verify link
async function sendConfirmationEmail(email, token) {
  if (!RESEND_API_KEY) return;

  const confirmUrl = `https://vidhai.co/api/confirm-subscription?token=${encodeURIComponent(token)}`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Vidhai <newsletter@vidhai.co>',
        to: [email],
        subject: 'Confirm your Vidhai subscription',
        html: getConfirmationEmailHTML(email, confirmUrl)
      })
    });
  } catch (err) {
    console.error('Confirmation email failed:', err);
  }
}

function getConfirmationEmailHTML(email, confirmUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #e2e8f0;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:24px;color:#0f172a;margin:0 0 8px 0;">Confirm Your Subscription</h1>
      <p style="color:#64748b;font-size:14px;margin:0;">Vidhai — AI Takes Root</p>
    </div>
    <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px 0;">
      Thanks for signing up for the Vidhai newsletter. Please confirm your email address by clicking the button below.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;">Confirm Subscription</a>
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
      This link will expire in 24 hours. If you did not sign up for Vidhai, you can safely ignore this email.
    </p>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:16px 0 0 0;border-top:1px solid #f1f5f9;padding-top:12px;">
      If the button does not work, copy and paste this URL into your browser:<br>
      <span style="color:#64748b;word-break:break-all;">${confirmUrl}</span>
    </p>
  </div>
  <div style="text-align:center;margin-top:24px;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      <a href="https://vidhai.co" style="color:#94a3b8;text-decoration:underline;">vidhai.co</a>
    </p>
  </div>
</div>
</body>
</html>`;
}
