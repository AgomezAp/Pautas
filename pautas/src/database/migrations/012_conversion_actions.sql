-- Conversion actions
CREATE TABLE IF NOT EXISTS conversion_actions (
    id                              SERIAL PRIMARY KEY,
    account_id                      VARCHAR(50) NOT NULL,
    conversion_action_id            VARCHAR(50) NOT NULL,
    name                            VARCHAR(500) DEFAULT '',
    type                            VARCHAR(50) DEFAULT '',
    category                        VARCHAR(50) DEFAULT '',
    status                          VARCHAR(30) DEFAULT '',
    counting_type                   VARCHAR(50) DEFAULT '',
    attribution_model               VARCHAR(50) DEFAULT '',
    default_value                   DECIMAL(14,2) DEFAULT 0,
    default_currency                VARCHAR(10) DEFAULT '',
    click_through_lookback_days     INTEGER DEFAULT 0,
    view_through_lookback_days      INTEGER DEFAULT 0,
    include_in_conversions_metric   BOOLEAN DEFAULT TRUE,
    phone_call_duration_seconds     INTEGER DEFAULT 0,
    app_id                          VARCHAR(200) DEFAULT '',
    last_synced_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, conversion_action_id)
);

CREATE INDEX IF NOT EXISTS idx_ca2_account ON conversion_actions(account_id);
