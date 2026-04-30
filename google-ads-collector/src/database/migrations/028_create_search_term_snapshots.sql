-- ============================================================
-- Migración 028: Snapshots de Search Terms
-- ============================================================

CREATE TABLE IF NOT EXISTS google_ads_search_term_snapshots (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_group_name   VARCHAR(255),
    search_term     VARCHAR(500) NOT NULL,
    status          VARCHAR(30),
    clicks          INTEGER DEFAULT 0,
    impressions     INTEGER DEFAULT 0,
    cost            DECIMAL(14,2) DEFAULT 0,
    conversions     DECIMAL(12,2) DEFAULT 0,
    ctr             DECIMAL(8,4),
    snapshot_date   DATE NOT NULL,
    UNIQUE(campaign_id, search_term, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_search_term_campaign ON google_ads_search_term_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_search_term_date ON google_ads_search_term_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_search_term_term ON google_ads_search_term_snapshots(search_term);
