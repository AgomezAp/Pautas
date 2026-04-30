import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';

export const CONTABILIDAD_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./dashboard/contabilidad-dashboard.component').then(m => m.ContabilidadDashboardComponent),
      },
      {
        path: 'cierres',
        loadComponent: () => import('./cierres/cierres.component').then(m => m.CierresComponent),
      },
    ],
  },
];
