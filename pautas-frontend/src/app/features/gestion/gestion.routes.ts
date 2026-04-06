import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { GestionDashboardComponent } from './dashboard/gestion-dashboard.component';
import { CampaignRotationComponent } from './campaign-rotation/campaign-rotation.component';
import { ConglomeradoAccountsComponent } from './conglomerado-accounts/conglomerado-accounts.component';

export const GESTION_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: GestionDashboardComponent },
      { path: 'rotations', component: CampaignRotationComponent },
      { path: 'conglomerado-accounts', component: ConglomeradoAccountsComponent },
      { path: 'soporte-images', loadComponent: () => import('./soporte-images/soporte-images.component').then(m => m.SoporteImagesComponent) },
      { path: 'alertas', loadComponent: () => import('../alerts/alert-dashboard/alert-dashboard.component').then(m => m.AlertDashboardComponent) },
    ],
  },
];
