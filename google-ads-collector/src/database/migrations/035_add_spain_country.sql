-- Agregar España al sistema y eliminar cualquier referencia a Costa Rica
INSERT INTO countries (name, code, google_sheet_tab, timezone)
VALUES ('España', 'ES', 'España', 'Europe/Madrid')
ON CONFLICT (code) DO NOTHING;

-- Si existiera Costa Rica, desactivar (no borrar por integridad referencial)
UPDATE countries SET is_active = FALSE WHERE code = 'CR';
