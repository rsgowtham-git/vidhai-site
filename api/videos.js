// Vercel Serverless Function — Curated Videos + Preferences via Supabase
// GET /api/videos — fetch active videos with preference data
// GET /api/videos?history=true — fetch all videos (including liked/disliked) for history
// POST /api/videos — add a new video (admin)
// PUT /api/videos — update preference (like/dislike) for a video
// DELETE /api/videos?id=xxx — remove a video (admin)

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

  const videosURL = `${SUPABASE_URL}/rest/v1/curated_videos`;
  const prefsURL = `${SUPABASE_URL}/rest/v1/video_preferences`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // GET — fetch videos with preferences
    if (req.method === 'GET') {
      const showHistory = req.query.history === 'true';

      // Fetch all videos
      const vidsRes = await fetch(
        `${videosURL}?select=*&order=added_date.desc`,
        { method: 'GET', headers }
      );
      const videos = await vidsRes.json();
      if (!vidsRes.ok) {
        return res.status(vidsRes.status).json({ error: videos.message || 'Failed to fetch videos' });
      }

      // Fetch all preferences
      const prefsRes = await fetch(
        `${prefsURL}?select=*`,
        { method: 'GET', headers }
      );
      const prefs = await prefsRes.json();
      if (!prefsRes.ok) {
        return res.status(prefsRes.status).json({ error: prefs.message || 'Failed to fetch preferences' });
      }

      // Build preference map: video_id -> preference
      const prefMap = {};
      for (const p of prefs) {
        prefMap[p.video_id] = p.preference;
      }

      // Merge and filter
      const merged = videos.map(v => ({
        id: v.id,
        url: v.url,
        title: v.title,
        thumbnail: v.thumbnail,
        category: v.category,
        tags: v.tags || [],
        source_channel: v.source_channel,
        added_date: v.added_date,
        is_active: v.is_active,
        preference: prefMap[v.id] || null
      }));

      if (showHistory) {
        // Return all videos (liked, disliked, neutral) for history view
        return res.status(200).json(merged);
      }

      // Default: return active videos that are NOT disliked
      const filtered = merged.filter(v => v.is_active && v.preference !== 'disliked');
      return res.status(200).json(filtered);
    }

    // POST — add a new video (used by admin/cron)
    if (req.method === 'POST') {
      const { url, title, thumbnail, category, tags, source_channel } = req.body;
      if (!url || !title) {
        return res.status(400).json({ error: 'URL and title are required' });
      }
      const payload = {
        url,
        title,
        thumbnail: thumbnail || '',
        category: category || 'AI',
        tags: tags || [],
        source_channel: source_channel || ''
      };
      const response = await fetch(videosURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || 'Failed to add video' });
      }
      return res.status(201).json({ success: true, video: data[0] });
    }

    // PUT — set preference (like/dislike) for a video
    if (req.method === 'PUT') {
      const { video_id, preference } = req.body;
      if (!video_id || !preference) {
        return res.status(400).json({ error: 'video_id and preference (liked/disliked) are required' });
      }
      if (preference !== 'liked' && preference !== 'disliked') {
        return res.status(400).json({ error: 'preference must be "liked" or "disliked"' });
      }

      // Check if preference already exists for this video
      const checkRes = await fetch(
        `${prefsURL}?video_id=eq.${video_id}&select=id`,
        { method: 'GET', headers }
      );
      const existing = await checkRes.json();

      if (existing && existing.length > 0) {
        // Update existing preference
        const updateRes = await fetch(
          `${prefsURL}?video_id=eq.${video_id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ preference })
          }
        );
        if (!updateRes.ok) {
          const errData = await updateRes.json();
          return res.status(updateRes.status).json({ error: errData.message || 'Failed to update preference' });
        }
        const updated = await updateRes.json();
        return res.status(200).json({ success: true, preference: updated[0] });
      } else {
        // Insert new preference
        const insertRes = await fetch(prefsURL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ video_id, preference })
        });
        if (!insertRes.ok) {
          const errData = await insertRes.json();
          return res.status(insertRes.status).json({ error: errData.message || 'Failed to save preference' });
        }
        const inserted = await insertRes.json();
        return res.status(201).json({ success: true, preference: inserted[0] });
      }
    }

    // DELETE — remove a video
    if (req.method === 'DELETE') {
      const videoId = req.query.id;
      if (!videoId) {
        return res.status(400).json({ error: 'Video id is required as query parameter' });
      }
      // Preferences cascade-delete via FK
      const response = await fetch(`${videosURL}?id=eq.${videoId}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) {
        const data = await response.json();
        return res.status(response.status).json({ error: data.message || 'Failed to delete video' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
