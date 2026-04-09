-- Bidding strategies
CREATE TABLE IF NOT EXISTS bidding_strategies (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    strategy_id                 VARCHAR(50) NOT NULL,
    name                        VARCHAR(500) DEFAULT '',
    type                        VARCHAR(50) DEFAULT '',
    status                      VARCHAR(30) DEFAULT '',
    campaign_count              INTEGER DEFAULT 0,
    non_removed_campaign_count  INTEGER DEFAULT 0,
    effective_currency_code     VARCHAR(10) DEFAULT '',
    conversions                 DECIMAL(12,2) DEFAULT 0,
    conversions_value           DECIMAL(14,2) DEFAULT 0,
    cost                        DECIMAL(14,2) DEFAULT 0,
    clicks                      INTEGER DEFAULT 0,
    impressions                 INTEGER DEFAULT 0,
    last_synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, strategy_id)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    campaign_id                 VARCHAR(50) DEFAULT '',
    type                        VARCHAR(100) NOT NULL,
    base_impressions            DECIMAL(14,2) DEFAULT 0,
    base_clicks                 DECIMAL(14,2) DEFAULT 0,
    base_cost                   DECIMAL(14,2) DEFAULT 0,
    base_conversions            DECIMAL(14,2) DEFAULT 0,
    potential_impressions       DECIMAL(14,2) DEFAULT 0,
    potential_clicks            DECIMAL(14,2) DEFAULT 0,
    potential_cost              DECIMAL(14,2) DEFAULT 0,
    potential_conversions       DECIMAL(14,2) DEFAULT 0,
    fetched_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Labels
CREATE TABLE IF NOT EXISTS labels (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    label_id            VARCHAR(50) NOT NULL,
    name                VARCHAR(255) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    background_color    VARCHAR(20) DEFAULT '',
    description         VARCHAR(500) DEFAULT '',
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_bs_account ON bidding_strategies(account_id);
CREATE INDEX IF NOT EXISTS idx_rec_account ON recommendations(account_id);
CREATE INDEX IF NOT EXISTS idx_lbl_account ON labels(account_id);
