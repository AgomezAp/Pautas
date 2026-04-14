CREATE TABLE IF NOT EXISTS google_ads_ad_snapshots (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_group_id     VARCHAR(50) NOT NULL,
    ad_group_name   VARCHAR(255),
    ad_id           VARCHAR(50) NOT NULL,
    ad_type         VARCHAR(30),
    headlines       TEXT,
    descriptions    TEXT,
    final_url       VARCHAR(500),
    status          VARCHAR(20),
    clicks          INTEGER DEFAULT 0,
    impressions     INTEGER DEFAULT 0,
    cost            DECIMAL(14,2) DEFAULT 0,
    conversions     DECIMAL(12,2) DEFAULT 0,
    ctr             DECIMAL(8,4),
    snapshot_date   DATE NOT NULL,
    UNIQUE(campaign_id, ad_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_campaign ON google_ads_ad_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_date ON google_ads_ad_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_ad_group ON google_ads_ad_snapshots(ad_group_id);
