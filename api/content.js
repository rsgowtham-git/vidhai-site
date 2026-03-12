// Vercel Serverless Function — Generic Content CRUD via Supabase
// Handles: ai_news, semiconductor_news, training_courses, industry_impact, ai_tools, breaking_news
// GET /api/content?table=ai_news — fetch all active items ordered by sort_order
// POST /api/content — create a new item { table, ...fields }
// PUT /api/content — update an item { table, id, ...fields }
// DELETE /api/content?table=xxx&id=xxx — delete an item

const ALLOWED_TABLES = ['ai_news', 'semiconductor_news', 'training_courses', 'industry_impact', 'ai_tools', 'breaking_news', 'market_movers', 'upcoming_ipos', 'curated_videos', 'posts'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // GET — fetch items
    if (req.method === 'GET') {
      const table = req.query.table;
      if (!table || !ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Invalid table. Allowed: ' + ALLOWED_TABLES.join(', ') });
      }

      const activeOnly = req.query.active !== 'false';
      const timeCol = table === 'market_movers' ? 'updated_at' : 'created_at';
      let url = `${SUPABASE_URL}/rest/v1/${table}?order=sort_order.asc,${timeCol}.desc`;
      if (activeOnly) {
        url += '&is_active=eq.true';
      }

      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ error: err });
      }
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // POST — create item
    if (req.method === 'POST') {
      const { table, ...fields } = req.body;
      if (!table || !ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Invalid table' });
      }

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(fields)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ error: err });
      }
      const data = await resp.json();
      return res.status(201).json(data);
    }

    // PUT — update item
    if (req.method === 'PUT') {
      const { table, id, ...fields } = req.body;
      if (!table || !ALLOWED_TABLES.includes(table) || !id) {
        return res.status(400).json({ error: 'table and id required' });
      }

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(fields)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ error: err });
      }
      const data = await resp.json();
      return res.status(200).json(data);
    }

    // DELETE — delete item
    if (req.method === 'DELETE') {
      const { table, id } = req.query;
      if (!table || !ALLOWED_TABLES.includes(table) || !id) {
        return res.status(400).json({ error: 'table and id required' });
      }

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ error: err });
      }
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
