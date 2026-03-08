-- ============================================
-- VIDHAI - Newsletter Sends Tracking Table
-- Logs every newsletter send for analytics
-- ============================================

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('sent', 'partial', 'failed')),
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'special')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying by date
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_created_at 
ON newsletter_sends(created_at DESC);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_status 
ON newsletter_sends(status);

-- Enable Row Level Security
ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (since this is admin-only via API)
-- In production, you may want to restrict based on authenticated admin users
CREATE POLICY "Allow all operations on newsletter_sends"
ON newsletter_sends
FOR ALL
USING (true)
WITH CHECK (true);

-- Optional: Create a view for send analytics
CREATE OR REPLACE VIEW newsletter_analytics AS
SELECT 
  DATE_TRUNC('week', created_at) AS week,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_sends,
  SUM(recipient_count) AS total_recipients,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS successful_sends,
  SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_sends,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_sends,
  AVG(recipient_count) AS avg_recipients_per_send
FROM newsletter_sends
GROUP BY week, month
ORDER BY week DESC, month DESC;

-- Grant access to the view
GRANT SELECT ON newsletter_analytics TO anon, authenticated;

COMMENT ON TABLE newsletter_sends IS 'Tracks all newsletter sends with recipient counts and status';
COMMENT ON COLUMN newsletter_sends.subject IS 'Email subject line';
COMMENT ON COLUMN newsletter_sends.recipient_count IS 'Number of emails successfully sent';
COMMENT ON COLUMN newsletter_sends.status IS 'Send status: sent (all successful), partial (some failed), failed (all failed)';
COMMENT ON COLUMN newsletter_sends.frequency IS 'Newsletter frequency type: weekly, monthly, or special';
COMMENT ON COLUMN newsletter_sends.created_at IS 'When the newsletter was sent';
