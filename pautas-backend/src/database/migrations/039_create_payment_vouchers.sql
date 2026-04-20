-- Migration 039: Payment vouchers table (comprobantes de pago del cierre)
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id               SERIAL PRIMARY KEY,
    entry_id         INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
    image_path       VARCHAR(500) NOT NULL,
    original_name    VARCHAR(255) NOT NULL,
    thumb_path       VARCHAR(500),
    is_approved      BOOLEAN,
    approved_by      INTEGER REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    approval_comment TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_entry_id   ON payment_vouchers(entry_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_is_approved ON payment_vouchers(is_approved);

COMMENT ON TABLE payment_vouchers IS 'Comprobantes de pago subidos por el conglomerado al cerrar el día, revisados por contabilidad';
