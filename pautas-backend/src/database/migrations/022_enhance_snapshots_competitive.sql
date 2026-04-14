-- Migration 022: Add competitive metrics + campaign metadata
-- Adds channel_type and bidding_strategy_type to campaigns
-- Adds impression share columns to google_ads_snapshots

-- Campaign metadata
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel_type VARCHAR(30);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bidding_strategy_type VARCHAR(50);

-- Impression share metrics on snapshots
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS search_impression_share DECIMAL(8,4);
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS search_top_impression_rate DECIMAL(8,4);
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS search_abs_top_impression_rate DECIMAL(8,4);
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS search_budget_lost_is DECIMAL(8,4);
ALTER TABLE google_ads_snapshots ADD COLUMN IF NOT EXISTS search_rank_lost_is DECIMAL(8,4);
