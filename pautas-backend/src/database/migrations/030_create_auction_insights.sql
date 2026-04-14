CREATE TABLE IF NOT EXISTS google_ads_auction_insights (
    id              SERIAL PRIMARY KEY,
    campaign_id     INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    display_domain  VARCHAR(255) NOT NULL,
    impression_share DECIMAL(8,4),
    overlap_rate    DECIMAL(8,4),
    position_above_rate DECIMAL(8,4),
    outranking_share DECIMAL(8,4),
    snapshot_date   DATE NOT NULL,
    UNIQUE(campaign_id, display_domain, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_auction_insights_campaign ON google_ads_auction_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_auction_insights_date ON google_ads_auction_insights(snapshot_date);
