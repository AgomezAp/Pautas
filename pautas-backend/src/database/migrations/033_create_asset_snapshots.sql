-- Asset Performance Snapshots (headlines, descriptions, sitelinks, callouts)
CREATE TABLE IF NOT EXISTS google_ads_asset_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id VARCHAR(50),
  asset_id VARCHAR(50) NOT NULL,
  asset_type VARCHAR(30) NOT NULL, -- HEADLINE, DESCRIPTION, SITELINK, CALLOUT, STRUCTURED_SNIPPET
  asset_text TEXT,
  asset_url VARCHAR(500),
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, asset_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_snap_date ON google_ads_asset_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_asset_snap_campaign ON google_ads_asset_snapshots(campaign_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_asset_snap_type ON google_ads_asset_snapshots(asset_type);
