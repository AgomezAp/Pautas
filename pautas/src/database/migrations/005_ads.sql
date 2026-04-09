-- Ad creatives
CREATE TABLE IF NOT EXISTS ads (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    ad_id               VARCHAR(50) NOT NULL,
    ad_name             VARCHAR(500) DEFAULT '',
    ad_type             VARCHAR(50) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    display_url         VARCHAR(1000) DEFAULT '',
    final_urls          TEXT DEFAULT '[]',
    final_mobile_urls   TEXT DEFAULT '[]',
    rsa_headlines       TEXT DEFAULT '[]',
    rsa_descriptions    TEXT DEFAULT '[]',
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, ad_id)
);

-- Ad daily snapshots
CREATE TABLE IF NOT EXISTS ad_snapshots (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    ad_id               VARCHAR(50) NOT NULL,
    snapshot_date       DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    conversions_value   DECIMAL(14,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion DECIMAL(14,2) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, ad_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ads_account ON ads(account_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign ON ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_adsnap_date ON ad_snapshots(snapshot_date);
