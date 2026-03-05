-- Run this in Supabase SQL Editor to create the posts table

CREATE TABLE posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  author text DEFAULT 'Gowtham',
  tags text[] DEFAULT '{}',
  excerpt text DEFAULT '',
  content text NOT NULL,
  date_display text DEFAULT '',
  read_time text DEFAULT '1 min read',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can view blog posts)
CREATE POLICY "Public can read posts" ON posts
  FOR SELECT TO anon USING (true);

-- Allow public write access (admin panel handles auth via password)
CREATE POLICY "Public can insert posts" ON posts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public can update posts" ON posts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete posts" ON posts
  FOR DELETE TO anon USING (true);

-- Seed with existing blog posts
INSERT INTO posts (title, author, tags, excerpt, content, date_display, read_time) VALUES
(
  'Why I Started Vidhai',
  'Gowtham',
  ARRAY['Personal', 'AI', 'Vision'],
  'In Tamil, ''Vidhai'' means seed. Every transformative technology starts as a seed — an idea that, given the right conditions, grows into something that reshapes the world. AI is that seed for our generation.',
  'In Tamil, ''Vidhai'' means seed. Every transformative technology starts as a seed — an idea that, given the right conditions, grows into something that reshapes the world. AI is that seed for our generation.

As someone who has spent over two decades in manufacturing, engineering services, and business development, I''ve watched technology waves come and go. But generative AI is different. It''s not just automating tasks — it''s fundamentally changing how we think, create, and solve problems.

I created Vidhai to be a curated space where professionals like me can stay informed without drowning in noise. This isn''t about hype. It''s about understanding which AI developments actually matter, which training paths are worth your time, and how specific industries are being transformed.

Whether you''re an executive trying to understand AI''s impact on your supply chain, an engineer exploring automation opportunities, or simply curious about the technology reshaping every industry — Vidhai is your starting point.

The seed has been planted. Let''s watch it grow.',
  'March 4, 2026',
  '3 min read'
),
(
  '5 Free AI Courses Every Professional Should Take in 2026',
  'Gowtham',
  ARRAY['Training', 'Career', 'Free Resources'],
  'You don''t need a computer science degree to understand AI. These five free courses will give any working professional a solid foundation — from strategy to hands-on application.',
  'You don''t need a computer science degree to understand AI. These five free courses will give any working professional a solid foundation — from strategy to hands-on application.

1. Elements of AI (University of Helsinki) — The gold standard for AI literacy. 30 hours of accessible content covering AI''s potential, limitations, and societal impact. Available in 25+ languages with a free certificate.

2. AI For Everyone by Andrew Ng — Built specifically for non-technical professionals. Learn to spot AI opportunities in your organization, work effectively with AI teams, and build AI strategies. About 8-10 hours on Coursera.

3. Generative AI for Everyone (DeepLearning.AI) — Covers prompt engineering, responsible AI, and practical applications. Perfect for understanding the current wave of AI tools like ChatGPT and Claude.

4. Prompt Engineering for ChatGPT (Vanderbilt) — 18 hours of hands-on training in crafting effective prompts. This is the most immediately practical skill any knowledge worker can develop today.

5. Microsoft AI Fundamentals — 6-8 hours on Microsoft Learn with free hands-on labs. Great for understanding enterprise AI services and optionally pursuing AI-900 certification.

The barrier to AI literacy has never been lower. Pick one and start this week.',
  'March 4, 2026',
  '5 min read'
),
(
  'How AI is Transforming Manufacturing — A Practitioner''s View',
  'Gowtham',
  ARRAY['Manufacturing', 'Industry 4.0', 'Vision Inspection'],
  'Having worked in industrial automation for years, I''ve seen firsthand how AI is reshaping factory floors — from vision inspection systems to predictive maintenance and beyond.',
  'Having worked in industrial automation for years, I''ve seen firsthand how AI is reshaping factory floors — from vision inspection systems to predictive maintenance and beyond.

The numbers tell a compelling story: over 60% of leading manufacturers now employ AI for quality inspections, yield improvement, and supply chain optimization. The global AI-in-manufacturing market is projected to grow at 28% CAGR through 2040.

But the real transformation isn''t in the numbers — it''s in what''s happening on the shop floor.

Vision Inspection: AI-powered computer vision can now detect defects that would take human inspectors hours. Real-time quality control using AI vision allows immediate detection of cracks, contamination, and dimensional errors on production lines.

Predictive Maintenance: Machine learning models analyze equipment sensor data to predict failures before they happen. This shifts maintenance from reactive to proactive, reducing downtime by 30-50% in well-implemented systems.

Digital Twins: AI-driven simulations of manufacturing processes let you optimize parameters like temperature, pressure, and mixing speeds before touching the physical line. The result: less waste, better yields.

Supply Chain Intelligence: The semiconductor supply crisis — where AI data centers are consuming 70% of all memory chips — shows why AI-powered supply chain visibility isn''t optional anymore. Companies like Tesla are using AI to manage dual-sourcing strategies across TSMC and Samsung.

The manufacturers who thrive in the next decade won''t be the ones with the biggest factories. They''ll be the ones who best integrate AI into every part of their operations.',
  'March 4, 2026',
  '6 min read'
);
