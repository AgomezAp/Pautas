-- Add Google Ads account ID to users (for conglomerado members)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_ads_account_id VARCHAR(50);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_users_google_ads_account ON users(google_ads_account_id)
  WHERE google_ads_account_id IS NOT NULL;

-- Formalize customer_account columns on campaigns (were added outside migrations)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS customer_account_id VARCHAR(50);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS customer_account_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_campaigns_customer_account ON campaigns(customer_account_id);
