-- Daily campaign metrics snapshots
CREATE TABLE IF NOT EXISTS campaign_snapshots (
    id                              SERIAL PRIMARY KEY,
    account_id                      VARCHAR(50) NOT NULL,
    campaign_id                     VARCHAR(50) NOT NULL,
    snapshot_date                   DATE NOT NULL,
    conversions                     DECIMAL(12,2) DEFAULT 0,
    conversions_value               DECIMAL(14,2) DEFAULT 0,
    all_conversions                 DECIMAL(12,2) DEFAULT 0,
    cost                            DECIMAL(14,2) DEFAULT 0,
    clicks                          INTEGER DEFAULT 0,
    impressions                     INTEGER DEFAULT 0,
    ctr                             DECIMAL(8,6) DEFAULT 0,
    average_cpc                     DECIMAL(14,2) DEFAULT 0,
    average_cpm                     DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion             DECIMAL(14,2) DEFAULT 0,
    search_impression_share         DECIMAL(8,6) DEFAULT 0,
    search_budget_lost_imp_share    DECIMAL(8,6) DEFAULT 0,
    search_rank_lost_imp_share      DECIMAL(8,6) DEFAULT 0,
    content_impression_share        DECIMAL(8,6) DEFAULT 0,
    interactions                    INTEGER DEFAULT 0,
    interaction_rate                DECIMAL(8,6) DEFAULT 0,
    video_views                     INTEGER DEFAULT 0,
    video_view_rate                 DECIMAL(8,6) DEFAULT 0,
    engagements                     INTEGER DEFAULT 0,
    engagement_rate                 DECIMAL(8,6) DEFAULT 0,
    active_view_impressions         INTEGER DEFAULT 0,
    active_view_ctr                 DECIMAL(8,6) DEFAULT 0,
    active_view_cpm                 DECIMAL(14,2) DEFAULT 0,
    active_view_viewability         DECIMAL(8,6) DEFAULT 0,
    fetched_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, campaign_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_cs_date ON campaign_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cs_account ON campaign_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_cs_campaign ON campaign_snapshots(campaign_id);
