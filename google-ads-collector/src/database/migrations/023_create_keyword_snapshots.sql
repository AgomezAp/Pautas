-- Migration 023: Create keyword snapshots table
-- Stores daily keyword-level performance metrics from Google Ads

CREATE TABLE IF NOT EXISTS google_ads_keyword_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_name VARCHAR(255),
  keyword_text VARCHAR(500) NOT NULL,
  match_type VARCHAR(20),
  quality_score INTEGER,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  ctr DECIMAL(8,4),
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, keyword_text, match_type, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_kw_snap_date ON google_ads_keyword_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_kw_snap_campaign ON google_ads_keyword_snapshots(campaign_id, snapshot_date);
