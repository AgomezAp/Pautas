-- Tabla para datos de rendimiento por localidad (regiones, ciudades)
-- Proviene de user_location_view de Google Ads API
CREATE TABLE IF NOT EXISTS google_ads_location_snapshots (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  country_criterion_id VARCHAR(20),
  country_name VARCHAR(255),
  location_criterion_id VARCHAR(20) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(50) DEFAULT 'UNKNOWN',
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(14,2) DEFAULT 0,
  conversions DECIMAL(12,2) DEFAULT 0,
  snapshot_date DATE NOT NULL,
  UNIQUE(campaign_id, location_criterion_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_location_snapshots_country ON google_ads_location_snapshots(country_criterion_id);
CREATE INDEX IF NOT EXISTS idx_location_snapshots_date ON google_ads_location_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_location_snapshots_campaign ON google_ads_location_snapshots(campaign_id);
