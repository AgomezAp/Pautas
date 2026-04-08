-- Migration 021: Performance indexes for slow endpoints
-- Addresses: admin/stats (~1900ms), admin/entries (~770ms), conglomerado/entries (~760ms)

-- ─── admin/stats: Partial indexes for is_active COUNT queries ─────────────

CREATE INDEX IF NOT EXISTS idx_users_is_active
    ON users (is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_campaigns_is_active
    ON campaigns (is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_countries_is_active
    ON countries (is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON users (role_id) WHERE is_active = TRUE;

-- ─── admin/conglomerado-entries: Composite for country + date filter + sort ──

CREATE INDEX IF NOT EXISTS idx_daily_entries_country_date_desc
    ON daily_entries (country_id, entry_date DESC);

-- ─── conglomerado/entries: Composite for user + date sort (pagination) ───────

CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date_desc
    ON daily_entries (user_id, entry_date DESC);

-- ─── ILIKE search optimization (requires pg_trgm extension) ─────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
    ON users USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
    ON users USING gin (username gin_trgm_ops);
