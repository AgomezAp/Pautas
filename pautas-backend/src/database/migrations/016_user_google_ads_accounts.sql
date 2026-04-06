-- Migration 016: Junction table for assigning multiple Google Ads accounts to pautador users
CREATE TABLE IF NOT EXISTS user_google_ads_accounts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_ads_account_id VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, google_ads_account_id)
);

CREATE INDEX IF NOT EXISTS idx_ugaa_account ON user_google_ads_accounts(google_ads_account_id);
CREATE INDEX IF NOT EXISTS idx_ugaa_user ON user_google_ads_accounts(user_id);
