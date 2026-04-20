-- Migration 042: Campaign change reports (pautadores → gestion_administrativa)
CREATE TABLE IF NOT EXISTS campaign_change_reports (
    id           SERIAL PRIMARY KEY,
    pautador_id  INTEGER NOT NULL REFERENCES users(id),
    campaign_id  INTEGER NOT NULL REFERENCES campaigns(id),
    description  TEXT    NOT NULL,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccr_pautador_id  ON campaign_change_reports(pautador_id);
CREATE INDEX IF NOT EXISTS idx_ccr_campaign_id  ON campaign_change_reports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ccr_sent_at      ON campaign_change_reports(sent_at DESC);

COMMENT ON TABLE campaign_change_reports IS 'Reportes de cambios realizados a campañas por pautadores, enviados a gestión administrativa';
