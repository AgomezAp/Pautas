INSERT INTO countries (name, code, google_sheet_tab, timezone) VALUES
('Colombia', 'CO', 'Colombia', 'America/Bogota'),
('México', 'MX', 'Mexico', 'America/Mexico_City'),
('Perú', 'PE', 'Peru', 'America/Lima'),
('Chile', 'CL', 'Chile', 'America/Santiago'),
('Ecuador', 'EC', 'Ecuador', 'America/Guayaquil'),
('Panamá', 'PA', 'Panama', 'America/Panama'),
('Bolivia', 'BO', 'Bolivia', 'America/La_Paz')
ON CONFLICT (code) DO NOTHING;
