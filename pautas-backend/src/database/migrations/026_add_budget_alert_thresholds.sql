-- ============================================================
-- Migración 026: Umbrales para alertas de presupuesto
-- ============================================================

INSERT INTO alert_thresholds (alert_type, threshold_value) VALUES
    ('BUDGET_OVERSPEND', 110.00),     -- % de daily_budget (costo > 110% del presupuesto diario)
    ('BUDGET_UNDERSPEND', 50.00),     -- % de daily_budget (costo < 50% del presupuesto diario)
    ('BUDGET_EXHAUSTION', 80.00)      -- % pacing (proyeccion agota presupuesto antes de fin de mes)
ON CONFLICT DO NOTHING;
