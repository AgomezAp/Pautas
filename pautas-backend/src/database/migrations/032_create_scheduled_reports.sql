-- ============================================================
-- Migración 032: Reportes Programados
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    report_type     VARCHAR(30) NOT NULL CHECK (report_type IN ('EXECUTIVE', 'OPERATIONAL')),
    frequency       VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    recipients      TEXT NOT NULL,
    filters         JSONB DEFAULT '{}',
    format          VARCHAR(10) DEFAULT 'PDF' CHECK (format IN ('PDF', 'EXCEL')),
    is_active       BOOLEAN DEFAULT TRUE,
    last_sent_at    TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_frequency ON scheduled_reports(frequency);
