-- Migration 034: Account conversion value configuration + ML performance index
-- Replaces all hardcoded $50 conversion values.
-- ROI/ROAS will only be calculated when an account has a configured value here.

CREATE TABLE IF NOT EXISTS account_conversion_config (
  id SERIAL PRIMARY KEY,
  customer_account_id VARCHAR(50) NOT NULL UNIQUE,
  conversion_value DECIMAL(14,2) NOT NULL,
  currency_code VARCHAR(10) DEFAULT 'USD',
  notes TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_conv_config_account
  ON account_conversion_config(customer_account_id);

-- Covering index for ML queries that pull all historical snapshots.
-- Avoids heap lookups when the query only needs the INCLUDE columns.
CREATE INDEX IF NOT EXISTS idx_snapshots_ml_covering
  ON google_ads_snapshots(campaign_id, snapshot_date)
  INCLUDE (cost, conversions, clicks, impressions, daily_budget,
           search_impression_share, search_budget_lost_is, search_rank_lost_is);
