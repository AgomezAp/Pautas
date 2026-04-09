-- Campaigns with full metadata
CREATE TABLE IF NOT EXISTS campaigns (
    id                      SERIAL PRIMARY KEY,
    account_id              VARCHAR(50) NOT NULL,
    campaign_id             VARCHAR(50) NOT NULL,
    campaign_name           VARCHAR(500) NOT NULL DEFAULT '',
    country_code            VARCHAR(5),
    status                  VARCHAR(30) DEFAULT '',
    channel_type            VARCHAR(50) DEFAULT '',
    channel_sub_type        VARCHAR(50) DEFAULT '',
    start_date              VARCHAR(20),
    end_date                VARCHAR(20),
    serving_status          VARCHAR(50) DEFAULT '',
    bidding_strategy_type   VARCHAR(50) DEFAULT '',
    budget_daily            DECIMAL(14,2) DEFAULT 0,
    budget_total            DECIMAL(14,2) DEFAULT 0,
    budget_delivery_method  VARCHAR(30) DEFAULT '',
    budget_period           VARCHAR(30) DEFAULT '',
    last_synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_account ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_camp_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_camp_country ON campaigns(country_code);
