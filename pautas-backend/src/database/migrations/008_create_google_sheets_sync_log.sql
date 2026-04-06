CREATE TABLE IF NOT EXISTS google_sheets_sync_log (
    id              SERIAL PRIMARY KEY,
    daily_entry_id  INTEGER REFERENCES daily_entries(id),
    country_id      INTEGER NOT NULL REFERENCES countries(id),
    status          VARCHAR(20) NOT NULL,
    error_message   TEXT,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
