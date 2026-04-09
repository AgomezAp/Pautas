-- Billing accounts
CREATE TABLE IF NOT EXISTS billing_accounts (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    account_name                VARCHAR(255) DEFAULT '',
    country_code                VARCHAR(5),
    billing_id                  VARCHAR(50) NOT NULL,
    status                      VARCHAR(30) DEFAULT '',
    payments_account_id         VARCHAR(100) DEFAULT '',
    payments_account_name       VARCHAR(255) DEFAULT '',
    payments_profile_id         VARCHAR(100) DEFAULT '',
    payments_profile_name       VARCHAR(255) DEFAULT '',
    secondary_payments_profile  VARCHAR(100) DEFAULT '',
    currency_code               VARCHAR(10) DEFAULT '',
    last_synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, billing_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    invoice_id          VARCHAR(100) NOT NULL,
    type                VARCHAR(30) DEFAULT '',
    issue_date          VARCHAR(30) DEFAULT '',
    due_date            VARCHAR(30) DEFAULT '',
    subtotal            DECIMAL(14,2) DEFAULT 0,
    tax                 DECIMAL(14,2) DEFAULT 0,
    total               DECIMAL(14,2) DEFAULT 0,
    currency_code       VARCHAR(10) DEFAULT '',
    pdf_url             VARCHAR(2000) DEFAULT '',
    payments_account_id VARCHAR(100) DEFAULT '',
    payments_profile_id VARCHAR(100) DEFAULT '',
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, invoice_id)
);

-- Account charges (budgets)
CREATE TABLE IF NOT EXISTS account_charges (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    account_name                VARCHAR(255) DEFAULT '',
    budget_id                   VARCHAR(50) NOT NULL,
    budget_name                 VARCHAR(255) DEFAULT '',
    budget_status               VARCHAR(30) DEFAULT '',
    proposed_start_date         VARCHAR(50),
    approved_start_date         VARCHAR(50),
    proposed_end_date           VARCHAR(50),
    approved_end_date           VARCHAR(50),
    purchase_order_number       VARCHAR(100) DEFAULT '',
    total_adjustments           DECIMAL(14,2) DEFAULT 0,
    amount_served               DECIMAL(14,2) DEFAULT 0,
    approved_spending_limit     DECIMAL(14,2) DEFAULT 0,
    proposed_spending_limit     DECIMAL(14,2) DEFAULT 0,
    billing_setup               VARCHAR(200) DEFAULT '',
    last_synced_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, budget_id)
);

-- Recharges (budget proposals)
CREATE TABLE IF NOT EXISTS recharges (
    id                          SERIAL PRIMARY KEY,
    account_id                  VARCHAR(50) NOT NULL,
    account_name                VARCHAR(255) DEFAULT '',
    country_code                VARCHAR(5),
    proposal_id                 VARCHAR(50) NOT NULL,
    proposal_type               VARCHAR(50) DEFAULT '',
    status                      VARCHAR(30) DEFAULT '',
    recharge_amount             DECIMAL(14,2) DEFAULT 0,
    new_spending_limit          DECIMAL(14,2) DEFAULT 0,
    proposed_spending_limit     DECIMAL(14,2) DEFAULT 0,
    approved_spending_limit     DECIMAL(14,2) DEFAULT 0,
    proposed_start_date         VARCHAR(50),
    approved_start_date         VARCHAR(50),
    proposed_end_date           VARCHAR(50),
    approved_end_date           VARCHAR(50),
    creation_date               VARCHAR(50) DEFAULT '',
    approval_date               VARCHAR(50) DEFAULT '',
    account_budget              VARCHAR(200) DEFAULT '',
    fetched_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_account ON billing_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_inv_account ON invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_chg_account ON account_charges(account_id);
CREATE INDEX IF NOT EXISTS idx_rch_account ON recharges(account_id);
CREATE INDEX IF NOT EXISTS idx_rch_country ON recharges(country_code);
