-- ============================================
-- VIDHAI — Subscribers Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'monthly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);

-- Enable Row Level Security
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Allow the anon key to INSERT (subscribe) and UPDATE (unsubscribe)
CREATE POLICY "Allow public subscribe" ON subscribers
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public unsubscribe" ON subscribers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to SELECT (needed for checking duplicates and admin view)
CREATE POLICY "Allow public read subscribers" ON subscribers
  FOR SELECT TO anon
  USING (true);

-- Newsletter sends log (optional — tracks what was sent)
CREATE TABLE IF NOT EXISTS newsletter_sends (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'partial'))
);

ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read newsletter_sends" ON newsletter_sends
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow public insert newsletter_sends" ON newsletter_sends
  FOR INSERT TO anon
  WITH CHECK (true);
