-- Device performance
CREATE TABLE IF NOT EXISTS device_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    device              VARCHAR(30) NOT NULL,
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
    video_views         INTEGER DEFAULT 0,
    interactions        INTEGER DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ad schedule performance (day of week / hour)
CREATE TABLE IF NOT EXISTS ad_schedule_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    day_of_week         VARCHAR(20) NOT NULL,
    hour                INTEGER NOT NULL DEFAULT 0,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Network type performance (Search vs Display vs YouTube)
CREATE TABLE IF NOT EXISTS network_performance (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    network_type        VARCHAR(50) NOT NULL,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion DECIMAL(14,2) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_account ON device_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_sched_account ON ad_schedule_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_net_account ON network_performance(account_id);
