-- Change history / audit log
CREATE TABLE IF NOT EXISTS change_history (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) DEFAULT '',
    campaign_name       VARCHAR(500) DEFAULT '',
    change_date_time    VARCHAR(50) NOT NULL,
    resource_type       VARCHAR(100) DEFAULT '',
    resource_name       VARCHAR(500) DEFAULT '',
    client_type         VARCHAR(50) DEFAULT '',
    user_email          VARCHAR(255) DEFAULT '',
    operation           VARCHAR(50) DEFAULT '',
    changed_fields      TEXT DEFAULT '[]',
    old_resource        TEXT,
    new_resource        TEXT,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ch_account ON change_history(account_id);
CREATE INDEX IF NOT EXISTS idx_ch_date ON change_history(change_date_time);
CREATE INDEX IF NOT EXISTS idx_ch_email ON change_history(user_email);
