-- Migration 025: Create hourly performance snapshots table
-- Stores hourly/day-of-week breakdown for heatmap analysis

CREATE TABLE IF NOT EXISTS google_ads_hourly_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  hour_of_day SMALLINT NOT NULL,
  day_of_week SMALLINT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, hour_of_day, day_of_week, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_hourly_snap_date ON google_ads_hourly_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_hourly_snap_campaign ON google_ads_hourly_snapshots(campaign_id, snapshot_date);
