-- Keywords
CREATE TABLE IF NOT EXISTS keywords (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    campaign_id                 VARCHAR(50) NOT NULL,
    ad_group_id                 VARCHAR(50) NOT NULL,
    criterion_id                VARCHAR(50) NOT NULL,
    keyword_text                VARCHAR(500) DEFAULT '',
    match_type                  VARCHAR(30) DEFAULT '',
    status                      VARCHAR(30) DEFAULT '',
    quality_score               INTEGER DEFAULT 0,
    creative_quality_score      VARCHAR(30) DEFAULT '',
    post_click_quality_score    VARCHAR(30) DEFAULT '',
    search_predicted_ctr        VARCHAR(30) DEFAULT '',
    effective_cpc_bid           DECIMAL(14,2) DEFAULT 0,
    final_urls                  TEXT DEFAULT '[]',
    last_synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, criterion_id)
);

-- Keyword daily snapshots
CREATE TABLE IF NOT EXISTS keyword_snapshots (
    id                              SERIAL PRIMARY KEY,
    account_id                      VARCHAR(50) NOT NULL,
    criterion_id                    VARCHAR(50) NOT NULL,
    snapshot_date                   DATE NOT NULL,
    conversions                     DECIMAL(12,2) DEFAULT 0,
    conversions_value               DECIMAL(14,2) DEFAULT 0,
    cost                            DECIMAL(14,2) DEFAULT 0,
    clicks                          INTEGER DEFAULT 0,
    impressions                     INTEGER DEFAULT 0,
    ctr                             DECIMAL(8,6) DEFAULT 0,
    average_cpc                     DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion             DECIMAL(14,2) DEFAULT 0,
    search_impression_share         DECIMAL(8,6) DEFAULT 0,
    search_rank_lost_imp_share      DECIMAL(8,6) DEFAULT 0,
    top_impression_pct              DECIMAL(8,6) DEFAULT 0,
    absolute_top_impression_pct     DECIMAL(8,6) DEFAULT 0,
    fetched_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, criterion_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_kw_account ON keywords(account_id);
CREATE INDEX IF NOT EXISTS idx_kw_campaign ON keywords(campaign_id);
CREATE INDEX IF NOT EXISTS idx_kwsnap_date ON keyword_snapshots(snapshot_date);
