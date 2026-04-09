-- Age range demographics
CREATE TABLE IF NOT EXISTS age_range_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    age_range           VARCHAR(50) NOT NULL,
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

-- Gender demographics
CREATE TABLE IF NOT EXISTS gender_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    gender              VARCHAR(30) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_age_account ON age_range_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_gender_account ON gender_performance(account_id);
