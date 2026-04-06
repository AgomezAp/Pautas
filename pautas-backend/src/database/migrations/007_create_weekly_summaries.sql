CREATE TABLE IF NOT EXISTS weekly_summaries (
    id                       SERIAL PRIMARY KEY,
    country_id               INTEGER NOT NULL REFERENCES countries(id),
    campaign_id              INTEGER REFERENCES campaigns(id),
    user_id                  INTEGER REFERENCES users(id),
    iso_year                 INTEGER NOT NULL,
    iso_week                 INTEGER NOT NULL,
    total_clientes           INTEGER NOT NULL DEFAULT 0,
    total_clientes_efectivos INTEGER NOT NULL DEFAULT 0,
    total_menores            INTEGER NOT NULL DEFAULT 0,
    total_conversions        DECIMAL(12,2) DEFAULT 0,
    avg_daily_clientes       DECIMAL(10,2) DEFAULT 0,
    effectiveness_rate       DECIMAL(8,4),
    conversion_rate          DECIMAL(8,4),
    days_with_entries        INTEGER NOT NULL DEFAULT 0,
    computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(country_id, campaign_id, user_id, iso_year, iso_week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_lookup ON weekly_summaries(country_id, iso_year, iso_week);
