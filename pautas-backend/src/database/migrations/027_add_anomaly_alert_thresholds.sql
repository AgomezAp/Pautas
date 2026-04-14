-- ============================================================
-- Migración 027: Umbrales para alertas de anomalías avanzadas
-- ============================================================

INSERT INTO alert_thresholds (alert_type, threshold_value) VALUES
    ('CPC_SPIKE', 30.00),             -- % incremento CPC vs promedio 7 días
    ('CTR_ANOMALY', 2.00),            -- desviaciones estándar de la media CTR
    ('IMPRESSION_SHARE_DROP', 20.00), -- % caída IS vs semana anterior
    ('KEYWORD_QS_DROP', 1.00),        -- puntos de caída en QS promedio
    ('CLICK_PATTERN_ANOMALY', 3.00),  -- desviaciones estándar en distribución horaria
    ('OPPORTUNITY_ALERT', 30.00)      -- % budget_lost_IS mínimo para alertar
ON CONFLICT DO NOTHING;
