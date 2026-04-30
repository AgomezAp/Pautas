-- ============================================================
-- Migración 031: Snapshots de Demographics (Age & Gender)
-- ============================================================

CREATE TABLE IF NOT EXISTS google_ads_demographics_snapshots (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    demographic_type VARCHAR(10) NOT NULL CHECK (demographic_type IN ('AGE', 'GENDER')),
    demographic_value VARCHAR(30) NOT NULL,
    clicks          INTEGER DEFAULT 0,
    impressions     INTEGER DEFAULT 0,
    cost            DECIMAL(14,2) DEFAULT 0,
    conversions     DECIMAL(12,2) DEFAULT 0,
    ctr             DECIMAL(8,4),
    snapshot_date   DATE NOT NULL,
    UNIQUE(campaign_id, demographic_type, demographic_value, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_demographics_campaign ON google_ads_demographics_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_demographics_date ON google_ads_demographics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_demographics_type ON google_ads_demographics_snapshots(demographic_type);
