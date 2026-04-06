CREATE TABLE IF NOT EXISTS manual_ads_uploads (
    id              SERIAL PRIMARY KEY,
    uploaded_by     INTEGER NOT NULL REFERENCES users(id),
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    records_imported INTEGER DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_log       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
