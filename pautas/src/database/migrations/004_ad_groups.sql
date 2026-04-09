-- Ad Groups
CREATE TABLE IF NOT EXISTS ad_groups (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    ad_group_name       VARCHAR(500) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    type                VARCHAR(50) DEFAULT '',
    cpc_bid             DECIMAL(14,2) DEFAULT 0,
    cpm_bid             DECIMAL(14,2) DEFAULT 0,
    target_cpa          DECIMAL(14,2) DEFAULT 0,
    target_roas         DECIMAL(10,4) DEFAULT 0,
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, ad_group_id)
);

-- Ad Group daily snapshots
CREATE TABLE IF NOT EXISTS ad_group_snapshots (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    snapshot_date       DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    conversions_value   DECIMAL(14,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion DECIMAL(14,2) DEFAULT 0,
    interactions        INTEGER DEFAULT 0,
    interaction_rate    DECIMAL(8,6) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, ad_group_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ag_account ON ad_groups(account_id);
CREATE INDEX IF NOT EXISTS idx_ag_campaign ON ad_groups(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ags_date ON ad_group_snapshots(snapshot_date);
