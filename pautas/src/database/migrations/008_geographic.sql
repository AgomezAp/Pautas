-- Geographic performance
CREATE TABLE IF NOT EXISTS geographic_performance (
    id                      SERIAL PRIMARY KEY,
    account_id              VARCHAR(50) NOT NULL,
    campaign_id             VARCHAR(50) NOT NULL,
    country_criterion_id    VARCHAR(50) DEFAULT '',
    location_type           VARCHAR(50) DEFAULT '',
    geo_target_constant     VARCHAR(200) DEFAULT '',
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    conversions             DECIMAL(12,2) DEFAULT 0,
    conversions_value       DECIMAL(14,2) DEFAULT 0,
    cost                    DECIMAL(14,2) DEFAULT 0,
    clicks                  INTEGER DEFAULT 0,
    impressions             INTEGER DEFAULT 0,
    ctr                     DECIMAL(8,6) DEFAULT 0,
    average_cpc             DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion     DECIMAL(14,2) DEFAULT 0,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User location performance
CREATE TABLE IF NOT EXISTS user_location_performance (
    id                      SERIAL PRIMARY KEY,
    account_id              VARCHAR(50) NOT NULL,
    campaign_id             VARCHAR(50) NOT NULL,
    country_criterion_id    VARCHAR(50) DEFAULT '',
    targeting_location      BOOLEAN DEFAULT FALSE,
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    conversions             DECIMAL(12,2) DEFAULT 0,
    cost                    DECIMAL(14,2) DEFAULT 0,
    clicks                  INTEGER DEFAULT 0,
    impressions             INTEGER DEFAULT 0,
    ctr                     DECIMAL(8,6) DEFAULT 0,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_account ON geographic_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_geo_campaign ON geographic_performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_uloc_account ON user_location_performance(account_id);
