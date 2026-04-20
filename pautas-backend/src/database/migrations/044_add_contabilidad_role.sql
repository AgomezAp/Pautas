-- Migration 044: Add contabilidad role
INSERT INTO roles (name, description)
VALUES ('contabilidad', 'Área de Contabilidad — revisión y aprobación de cierres')
ON CONFLICT (name) DO NOTHING;
