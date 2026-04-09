-- Client accounts discovered under the MCC
CREATE TABLE IF NOT EXISTS client_accounts (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL UNIQUE,
    account_name        VARCHAR(255) NOT NULL DEFAULT '',
    country_code        VARCHAR(5),
    currency_code       VARCHAR(10) DEFAULT '',
    time_zone           VARCHAR(100) DEFAULT '',
    auto_tagging        BOOLEAN DEFAULT FALSE,
    has_partners_badge  BOOLEAN DEFAULT FALSE,
    optimization_score  DECIMAL(5,4) DEFAULT 0,
    status              VARCHAR(30) DEFAULT '',
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca_country_code ON client_accounts(country_code);
