INSERT INTO roles (name, description) VALUES
('admin', 'Administrador del sistema'),
('conglomerado', 'Operador de entrada de datos diarios'),
('pautador', 'Colaborador - Pautadores'),
('gestion_administrativa', 'Colaborador - Gestión Administrativa')
ON CONFLICT (name) DO NOTHING;
