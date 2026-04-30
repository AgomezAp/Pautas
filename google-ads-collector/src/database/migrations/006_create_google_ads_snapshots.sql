CREATE TABLE IF NOT EXISTS google_ads_snapshots (
    id                      SERIAL PRIMARY KEY,
    campaign_id             INTEGER NOT NULL REFERENCES campaigns(id),
    snapshot_date           DATE NOT NULL,
    conversions             DECIMAL(12,2) NOT NULL DEFAULT 0,
    status                  VARCHAR(20) NOT NULL,
    remaining_budget        DECIMAL(14,2),
    cost                    DECIMAL(14,2),
    clicks                  INTEGER DEFAULT 0,
    impressions             INTEGER DEFAULT 0,
    ctr                     DECIMAL(8,4),
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ads_snapshots_campaign_date ON google_ads_snapshots(campaign_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ads_snapshots_date ON google_ads_snapshots(snapshot_date);
