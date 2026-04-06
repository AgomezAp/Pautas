INSERT INTO countries (name, code, google_sheet_tab, timezone) VALUES
('Colombia', 'CO', 'Colombia', 'America/Bogota'),
('México', 'MX', 'Mexico', 'America/Mexico_City'),
('Perú', 'PE', 'Peru', 'America/Lima'),
('Chile', 'CL', 'Chile', 'America/Santiago'),
('Ecuador', 'EC', 'Ecuador', 'America/Guayaquil'),
('Panamá', 'PA', 'Panama', 'America/Panama'),
('Costa Rica', 'CR', 'Costa_Rica', 'America/Costa_Rica')
ON CONFLICT (code) DO NOTHING;
