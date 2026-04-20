-- Migration 040: Multi-country assignment for gestion_administrativa users
CREATE TABLE IF NOT EXISTS user_countries (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_user_countries_user_id    ON user_countries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_countries_country_id ON user_countries(country_id);

COMMENT ON TABLE user_countries IS 'Países asignados a usuarios de gestion_administrativa (relación N:M)';
