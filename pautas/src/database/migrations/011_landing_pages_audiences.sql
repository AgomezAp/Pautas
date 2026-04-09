-- Landing page performance
CREATE TABLE IF NOT EXISTS landing_page_performance (
    id                              SERIAL PRIMARY KEY,
    account_id                      VARCHAR(50) NOT NULL,
    campaign_id                     VARCHAR(50) NOT NULL,
    ad_group_id                     VARCHAR(50) DEFAULT '',
    landing_page_url                VARCHAR(2000) NOT NULL,
    period_start                    DATE NOT NULL,
    period_end                      DATE NOT NULL,
    conversions                     DECIMAL(12,2) DEFAULT 0,
    cost                            DECIMAL(14,2) DEFAULT 0,
    clicks                          INTEGER DEFAULT 0,
    impressions                     INTEGER DEFAULT 0,
    ctr                             DECIMAL(8,6) DEFAULT 0,
    average_cpc                     DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion             DECIMAL(14,2) DEFAULT 0,
    mobile_friendly_clicks_pct      DECIMAL(8,6) DEFAULT 0,
    speed_score                     DECIMAL(8,4) DEFAULT 0,
    fetched_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audience performance
CREATE TABLE IF NOT EXISTS audience_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    resource_name       VARCHAR(500) DEFAULT '',
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    conversions_value   DECIMAL(14,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion DECIMAL(14,2) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_account ON landing_page_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_aud_account ON audience_performance(account_id);
