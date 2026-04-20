-- Migration 038: Add cierre (daily earnings) field to daily_entries
ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS cierre DECIMAL(14, 2);

COMMENT ON COLUMN daily_entries.cierre IS 'Cierre del día: monto en dinero reportado por el maestro';
