-- Migration 024: Create device and geographic performance tables

CREATE TABLE IF NOT EXISTS google_ads_device_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  device VARCHAR(20) NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, device, snapshot_date)
);

CREATE TABLE IF NOT EXISTS google_ads_geo_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  geo_target_name VARCHAR(255) NOT NULL,
  geo_target_type VARCHAR(50),
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, geo_target_name, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_device_snap_date ON google_ads_device_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_device_snap_campaign ON google_ads_device_snapshots(campaign_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_geo_snap_date ON google_ads_geo_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_geo_snap_campaign ON google_ads_geo_snapshots(campaign_id, snapshot_date);
