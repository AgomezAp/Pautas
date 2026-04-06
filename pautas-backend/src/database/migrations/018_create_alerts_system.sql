-- ============================================================
-- SISTEMA DE ALERTAS INTELIGENTE
-- Migración 018: alerts, alert_thresholds, conglomerate_stats
-- ============================================================

-- 1. Tabla de umbrales configurables
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id                  SERIAL PRIMARY KEY,
    alert_type          VARCHAR(50) NOT NULL,
    country_id          INTEGER REFERENCES countries(id),
    campaign_id         INTEGER REFERENCES campaigns(id),
    threshold_value     DECIMAL(10,2) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(alert_type, country_id, campaign_id)
);

-- Umbrales por defecto (globales, country_id y campaign_id NULL)
INSERT INTO alert_thresholds (alert_type, threshold_value) VALUES
    ('CONVERSION_DROP', 30.00),
    ('TRAFFIC_DROP', 25.00),
    ('HIGH_MINORS_RATIO', 40.00),
    ('CONVERSION_SPIKE', 20.00),
    ('NO_REPORT', 0),
    ('TREND_DECLINING', 0),
    ('ADS_DISCREPANCY', 50.00)
ON CONFLICT DO NOTHING;

-- 2. Tabla principal de alertas
CREATE TABLE IF NOT EXISTS alerts (
    id                  SERIAL PRIMARY KEY,
    alert_type          VARCHAR(50) NOT NULL,
    severity            VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    user_id             INTEGER REFERENCES users(id),
    country_id          INTEGER REFERENCES countries(id),
    campaign_id         INTEGER REFERENCES campaigns(id),
    daily_entry_id      INTEGER REFERENCES daily_entries(id),
    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    metadata            JSONB DEFAULT '{}',
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    acknowledged_by     INTEGER REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         INTEGER REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    dismissed_by        INTEGER REFERENCES users(id),
    dismissed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_country ON alerts(country_id);
CREATE INDEX IF NOT EXISTS idx_alerts_campaign ON alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_type_user_date ON alerts(alert_type, user_id, created_at);

-- 3. Estadísticas históricas precalculadas por conglomerado/semana
CREATE TABLE IF NOT EXISTS conglomerate_stats (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER NOT NULL REFERENCES users(id),
    iso_year                    INTEGER NOT NULL,
    iso_week                    INTEGER NOT NULL,
    avg_clientes                DECIMAL(10,2) DEFAULT 0,
    avg_clientes_efectivos      DECIMAL(10,2) DEFAULT 0,
    avg_menores                 DECIMAL(10,2) DEFAULT 0,
    avg_conversion_rate         DECIMAL(8,4) DEFAULT 0,
    total_entries               INTEGER DEFAULT 0,
    max_clientes_efectivos      INTEGER DEFAULT 0,
    computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, iso_year, iso_week)
);

CREATE INDEX IF NOT EXISTS idx_conglomerate_stats_user ON conglomerate_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_conglomerate_stats_week ON conglomerate_stats(iso_year, iso_week);

-- 4. Vista de ranking de conglomerados por tasa de conversión por país
CREATE OR REPLACE VIEW v_conglomerate_ranking AS
SELECT
    u.id AS user_id,
    u.full_name,
    u.username,
    c.id AS country_id,
    c.name AS country_name,
    c.code AS country_code,
    camp.id AS campaign_id,
    camp.name AS campaign_name,
    COUNT(de.id) AS total_entries,
    COALESCE(SUM(de.clientes), 0) AS total_clientes,
    COALESCE(SUM(de.clientes_efectivos), 0) AS total_efectivos,
    COALESCE(SUM(de.menores), 0) AS total_menores,
    CASE
        WHEN SUM(de.clientes) > 0
        THEN ROUND(SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric * 100, 2)
        ELSE 0
    END AS conversion_rate,
    RANK() OVER (
        PARTITION BY c.id
        ORDER BY CASE WHEN SUM(de.clientes) > 0
            THEN SUM(de.clientes_efectivos)::numeric / SUM(de.clientes)::numeric
            ELSE 0 END DESC
    ) AS rank_in_country,
    MAX(de.entry_date) AS last_entry_date
FROM users u
JOIN roles r ON r.id = u.role_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN campaigns camp ON camp.id = u.campaign_id
LEFT JOIN daily_entries de ON de.user_id = u.id
    AND de.entry_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE r.name = 'conglomerado' AND u.is_active = TRUE
GROUP BY u.id, u.full_name, u.username, c.id, c.name, c.code, camp.id, camp.name;
