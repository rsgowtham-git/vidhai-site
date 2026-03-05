-- Run this in Supabase SQL Editor to create the video curation tables

-- Table: curated_videos
-- Stores all curated video entries (added by cron refresh or manually)
CREATE TABLE curated_videos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url text NOT NULL,
  title text NOT NULL,
  thumbnail text DEFAULT '',
  category text DEFAULT 'AI',
  tags text[] DEFAULT '{}',
  source_channel text DEFAULT '',
  added_date timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Table: video_preferences
-- Stores user thumbs up/down preferences (anonymous, one per video)
CREATE TABLE video_preferences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  video_id bigint REFERENCES curated_videos(id) ON DELETE CASCADE,
  preference text CHECK (preference IN ('liked', 'disliked')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(video_id)
);

-- Enable Row Level Security
ALTER TABLE curated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_preferences ENABLE ROW LEVEL SECURITY;

-- Public read access for curated_videos
CREATE POLICY "Public can read videos" ON curated_videos
  FOR SELECT TO anon USING (true);

-- Public insert/update for curated_videos (admin panel handles auth)
CREATE POLICY "Public can insert videos" ON curated_videos
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public can update videos" ON curated_videos
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete videos" ON curated_videos
  FOR DELETE TO anon USING (true);

-- Public full access for video_preferences
CREATE POLICY "Public can read preferences" ON video_preferences
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can insert preferences" ON video_preferences
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public can update preferences" ON video_preferences
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete preferences" ON video_preferences
  FOR DELETE TO anon USING (true);

-- Seed with initial curated videos (the 3 currently on the site)
INSERT INTO curated_videos (url, title, thumbnail, category, source_channel) VALUES
(
  'https://www.youtube.com/watch?v=msrbd-d6lWk',
  'AI News This Week — Matt Wolfe',
  'https://img.youtube.com/vi/msrbd-d6lWk/mqdefault.jpg',
  'AI News',
  'Matt Wolfe'
),
(
  'https://www.youtube.com/watch?v=fFL7la73RO4',
  'DeepSeek Research — Two Minute Papers',
  'https://img.youtube.com/vi/fFL7la73RO4/mqdefault.jpg',
  'Research',
  'Two Minute Papers'
),
(
  'https://www.youtube.com/watch?v=sAM_csZ5N5E',
  'Generative AI for Everyone — Andrew Ng',
  'https://img.youtube.com/vi/sAM_csZ5N5E/mqdefault.jpg',
  'Learning',
  'Andrew Ng'
);
