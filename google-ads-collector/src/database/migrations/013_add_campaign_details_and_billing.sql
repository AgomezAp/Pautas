-- Add campaign detail fields synced from Google Ads
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(14,2);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ads_status VARCHAR(30);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add daily_budget to snapshots for tracking budget changes over time
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS daily_budget DECIMAL(14,2);

-- Billing accounts linked to Google Ads
CREATE TABLE IF NOT EXISTS google_ads_billing_accounts (
    id                      SERIAL PRIMARY KEY,
    billing_id              VARCHAR(100) NOT NULL UNIQUE,
    name                    VARCHAR(255),
    currency_code           VARCHAR(10),
    status                  VARCHAR(30),
    last_synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Billing (invoices/charges) history
CREATE TABLE IF NOT EXISTS google_ads_billing_history (
    id                      SERIAL PRIMARY KEY,
    billing_account_id      INTEGER REFERENCES google_ads_billing_accounts(id),
    invoice_id              VARCHAR(100),
    issue_date              DATE,
    due_date                DATE,
    subtotal                DECIMAL(14,2),
    tax                     DECIMAL(14,2),
    total                   DECIMAL(14,2),
    currency_code           VARCHAR(10),
    status                  VARCHAR(30),
    pdf_url                 TEXT,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_history_date ON google_ads_billing_history(issue_date);
CREATE INDEX IF NOT EXISTS idx_billing_history_account ON google_ads_billing_history(billing_account_id);
