-- Add payment profile details to billing accounts
ALTER TABLE google_ads_billing_accounts ADD COLUMN IF NOT EXISTS payments_profile_name VARCHAR(255);
ALTER TABLE google_ads_billing_accounts ADD COLUMN IF NOT EXISTS customer_account_id VARCHAR(50);
ALTER TABLE google_ads_billing_accounts ADD COLUMN IF NOT EXISTS customer_account_name VARCHAR(255);

-- Add account budget tracking table for payment/charge history
CREATE TABLE IF NOT EXISTS google_ads_account_charges (
    id                      SERIAL PRIMARY KEY,
    customer_account_id     VARCHAR(50) NOT NULL,
    customer_account_name   VARCHAR(255),
    billing_account_id      INTEGER REFERENCES google_ads_billing_accounts(id),
    payments_account_id     VARCHAR(100),
    payments_profile_name   VARCHAR(255),
    currency_code           VARCHAR(10),
    budget_name             VARCHAR(255),
    budget_status           VARCHAR(30),
    budget_start_date       TIMESTAMPTZ,
    budget_end_date         TIMESTAMPTZ,
    purchase_order_number   VARCHAR(100),
    total_adjustments_micros BIGINT DEFAULT 0,
    amount_served_micros    BIGINT DEFAULT 0,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_account_id, payments_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_charges_customer ON google_ads_account_charges(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_account_charges_billing ON google_ads_account_charges(billing_account_id);

-- Recharge history from account_budget_proposal
CREATE TABLE IF NOT EXISTS google_ads_recharges (
    id                      SERIAL PRIMARY KEY,
    customer_account_id     VARCHAR(50) NOT NULL,
    customer_account_name   VARCHAR(255),
    payments_account_id     VARCHAR(100),
    payments_profile_name   VARCHAR(255),
    currency_code           VARCHAR(10),
    recharge_amount         DECIMAL(14,2) NOT NULL,
    new_spending_limit      DECIMAL(14,2),
    proposal_id             VARCHAR(100) UNIQUE,
    proposal_type           INTEGER,
    recharge_date           TIMESTAMPTZ,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recharges_account ON google_ads_recharges(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_recharges_date ON google_ads_recharges(recharge_date DESC);
