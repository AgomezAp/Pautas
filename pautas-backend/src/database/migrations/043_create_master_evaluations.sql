-- Migration 043: Master profiles / hoja de vida de maestros (conglomerado)
CREATE TABLE IF NOT EXISTS master_evaluations (
    id                     SERIAL PRIMARY KEY,
    master_user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by             INTEGER NOT NULL REFERENCES users(id),
    type                   VARCHAR(30) NOT NULL
                               CHECK (type IN ('evaluation', 'incident', 'campaign_change', 'phone_history')),
    title                  VARCHAR(255),
    description            TEXT,
    numeric_rating         SMALLINT CHECK (numeric_rating >= 1 AND numeric_rating <= 10),
    phone_number           VARCHAR(30),
    campaign_change_date   DATE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_eval_master_user ON master_evaluations(master_user_id);
CREATE INDEX IF NOT EXISTS idx_master_eval_type        ON master_evaluations(type);

COMMENT ON TABLE master_evaluations IS 'Hoja de vida / perfil de desempeño de los maestros (conglomerado), creada solo por gestión administrativa';
