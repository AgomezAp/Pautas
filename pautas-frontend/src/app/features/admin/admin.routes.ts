import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { AdminDashboardComponent } from './admin-layout/admin-layout.component';
import { UserListComponent } from './user-management/user-list/user-list.component';
import { CampaignListComponent } from './campaign-management/campaign-list/campaign-list.component';
import { CountryListComponent } from './country-management/country-list/country-list.component';
import { AuditLogComponent } from './audit-log/audit-log.component';
import { GoogleAdsViewComponent } from '../pautadores/google-ads/google-ads-view.component';
import { ConglomeradoEntriesComponent } from './conglomerado-entries/conglomerado-entries.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: UserListComponent },
      { path: 'campaigns', component: CampaignListComponent },
      { path: 'google-ads', component: GoogleAdsViewComponent },
      { path: 'conglomerado-entries', component: ConglomeradoEntriesComponent },
      { path: 'countries', component: CountryListComponent },
      { path: 'audit-log', component: AuditLogComponent },
      {
        path: 'alertas',
        loadComponent: () => import('../alerts/alert-dashboard/alert-dashboard.component').then(m => m.AlertDashboardComponent),
      },
      {
        path: 'ranking',
        loadComponent: () => import('../alerts/conglomerate-ranking/conglomerate-ranking.component').then(m => m.ConglomerateRankingComponent),
      },
    ],
  },
];
