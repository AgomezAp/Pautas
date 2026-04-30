-- Columnas de cuenta de Google Ads en campaigns (necesarias para el sync)
-- Nota: la parte de ALTER TABLE users se omite porque el google-ads-collector
-- no gestiona usuarios — solo sincroniza datos de la API de Google Ads.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS customer_account_id VARCHAR(50);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS customer_account_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_campaigns_customer_account ON campaigns(customer_account_id);
