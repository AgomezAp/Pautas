-- Missing indexes for performance optimization

-- manual_ads_uploads: queried by uploaded_by and created_at
CREATE INDEX IF NOT EXISTS idx_manual_ads_uploads_uploaded_by ON manual_ads_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_manual_ads_uploads_created_at ON manual_ads_uploads(created_at);

-- daily_entries.campaign_id: used in JOINs
CREATE INDEX IF NOT EXISTS idx_daily_entries_campaign_id ON daily_entries(campaign_id);

-- daily_entries: commonly filtered by entry_date
CREATE INDEX IF NOT EXISTS idx_daily_entries_entry_date ON daily_entries(entry_date);

-- daily_entries: commonly filtered by country_id
CREATE INDEX IF NOT EXISTS idx_daily_entries_country_id ON daily_entries(country_id);

-- google_ads_billing_accounts: queried by customer_account_id
CREATE INDEX IF NOT EXISTS idx_gaba_customer_account_id ON google_ads_billing_accounts(customer_account_id);

-- audit_log: filtered by action
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- user_google_ads_accounts: ensure user_id index
CREATE INDEX IF NOT EXISTS idx_ugaa_user_id ON user_google_ads_accounts(user_id);
