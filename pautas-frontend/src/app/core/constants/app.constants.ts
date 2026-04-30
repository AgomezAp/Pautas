export enum UserRole {
  ADMIN = 'admin',
  CONGLOMERADO = 'conglomerado',
  PAUTADOR = 'pautador',
  GESTION = 'gestion_administrativa',
  CONTABILIDAD = 'contabilidad',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  conglomerado: 'Conglomerado',
  pautador: 'Pautador',
  gestion_administrativa: 'Gestión Administrativa',
  contabilidad: 'Contabilidad',
};

export const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  conglomerado: '/conglomerado',
  pautador: '/pautadores',
  gestion_administrativa: '/gestion',
  contabilidad: '/contabilidad',
};
