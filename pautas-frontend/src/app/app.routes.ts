import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'conglomerado',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['conglomerado'] },
    loadChildren: () => import('./features/conglomerado/conglomerado.routes').then(m => m.CONGLOMERADO_ROUTES),
  },
  {
    path: 'pautadores',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['pautador'] },
    loadChildren: () => import('./features/pautadores/pautadores.routes').then(m => m.PAUTADORES_ROUTES),
  },
  {
    path: 'gestion',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['gestion_administrativa'] },
    loadChildren: () => import('./features/gestion/gestion.routes').then(m => m.GESTION_ROUTES),
  },
  {
    path: 'contabilidad',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['contabilidad'] },
    loadChildren: () => import('./features/contabilidad/contabilidad.routes').then(m => m.CONTABILIDAD_ROUTES),
  },
  { path: '**', redirectTo: '/auth/login' },
];
