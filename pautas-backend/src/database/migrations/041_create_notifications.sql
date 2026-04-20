-- Migration 041: Internal notifications system
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(60)  NOT NULL,   -- e.g. 'campaign_change_report'
    title      VARCHAR(255) NOT NULL,
    message    TEXT         NOT NULL,
    data       JSONB,                   -- extra payload (report_id, campaign_id, etc.)
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;

COMMENT ON TABLE notifications IS 'Notificaciones internas entre áreas (pautadores → gestión administrativa, etc.)';
