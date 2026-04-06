CREATE TABLE IF NOT EXISTS daily_entries (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER NOT NULL REFERENCES users(id),
    country_id            INTEGER NOT NULL REFERENCES countries(id),
    campaign_id           INTEGER REFERENCES campaigns(id),
    entry_date            DATE NOT NULL,
    iso_year              INTEGER NOT NULL,
    iso_week              INTEGER NOT NULL,
    clientes              INTEGER NOT NULL CHECK (clientes >= 0),
    clientes_efectivos    INTEGER NOT NULL CHECK (clientes_efectivos >= 0),
    menores               INTEGER NOT NULL CHECK (menores >= 0),
    soporte_image_path    VARCHAR(500),
    soporte_original_name VARCHAR(255),
    synced_to_sheets      BOOLEAN NOT NULL DEFAULT FALSE,
    sheets_synced_at      TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_country_id ON daily_entries(country_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_entry_date ON daily_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_iso_week ON daily_entries(iso_year, iso_week);
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_id ON daily_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_synced ON daily_entries(synced_to_sheets) WHERE synced_to_sheets = FALSE;
