// Vercel Serverless Function — Blog Posts CRUD via Supabase
// GET /api/posts — fetch all posts (ordered by created_at desc)
// POST /api/posts — create a new post
// PUT /api/posts — update an existing post (requires id in body)
// DELETE /api/posts?id=xxx — delete a post

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const baseURL = `${SUPABASE_URL}/rest/v1/posts`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // GET — fetch all posts
    if (req.method === 'GET') {
      const response = await fetch(`${baseURL}?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: headers
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Failed to fetch posts' });
      }
      // Transform to frontend format
      const posts = data.map(row => ({
        id: row.id,
        title: row.title,
        date: row.date_display,
        author: row.author,
        readTime: row.read_time,
        tags: row.tags || [],
        excerpt: row.excerpt,
        content: row.content
      }));
      return res.status(200).json(posts);
    }

    // POST — create a new post
    if (req.method === 'POST') {
      const { title, author, tags, excerpt, content, date, readTime } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }
      const payload = {
        title: title,
        author: author || 'Gowtham',
        tags: tags || [],
        excerpt: excerpt || '',
        content: content,
        date_display: date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        read_time: readTime || '1 min read'
      };
      const response = await fetch(baseURL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Failed to create post' });
      }
      const created = data[0];
      return res.status(201).json({
        success: true,
        post: {
          id: created.id,
          title: created.title,
          date: created.date_display,
          author: created.author,
          readTime: created.read_time,
          tags: created.tags || [],
          excerpt: created.excerpt,
          content: created.content
        }
      });
    }

    // PUT — update a post
    if (req.method === 'PUT') {
      const { id, title, author, tags, excerpt, content, readTime } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Post id is required' });
      }
      const payload = {};
      if (title !== undefined) payload.title = title;
      if (author !== undefined) payload.author = author;
      if (tags !== undefined) payload.tags = tags;
      if (excerpt !== undefined) payload.excerpt = excerpt;
      if (content !== undefined) payload.content = content;
      if (readTime !== undefined) payload.read_time = readTime;

      const response = await fetch(`${baseURL}?id=eq.${id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Failed to update post' });
      }
      return res.status(200).json({ success: true, post: data[0] });
    }

    // DELETE — delete a post
    if (req.method === 'DELETE') {
      const postId = req.query.id;
      if (!postId) {
        return res.status(400).json({ error: 'Post id is required as query parameter' });
      }
      const response = await fetch(`${baseURL}?id=eq.${postId}`, {
        method: 'DELETE',
        headers: headers
      });
      if (!response.ok) {
        const data = await response.json();
        return res.status(response.status).json({ error: data.message || 'Failed to delete post' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
