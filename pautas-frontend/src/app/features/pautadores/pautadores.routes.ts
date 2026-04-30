import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { PautadoresDashboardComponent } from './dashboard/pautadores-dashboard.component';
import { ConsolidatedViewComponent } from './consolidated-view/consolidated-view.component';
import { GoogleAdsViewComponent } from './google-ads/google-ads-view.component';
import { ConglomeradoContrastComponent } from './conglomerado-contrast/conglomerado-contrast.component';
import { GoogleAdsAnalysisComponent } from './google-ads-analysis/google-ads-analysis.component';
import { EntriesDailyComponent } from './entries-daily/entries-daily.component';
import { EntriesWeeklyComponent } from './entries-weekly/entries-weekly.component';

export const PAUTADORES_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: PautadoresDashboardComponent },
      { path: 'consolidated', component: ConsolidatedViewComponent },
      { path: 'entries-daily', component: EntriesDailyComponent },
      { path: 'entries-weekly', component: EntriesWeeklyComponent },
      { path: 'campaigns', component: GoogleAdsViewComponent },
      { path: 'google-ads', component: GoogleAdsViewComponent },
      { path: 'google-ads-analysis', component: GoogleAdsAnalysisComponent },
      { path: 'conglomerado-contrast', component: ConglomeradoContrastComponent },
      {
        path: 'alertas',
        loadComponent: () => import('../alerts/alert-dashboard/alert-dashboard.component').then(m => m.AlertDashboardComponent),
      },
      {
        path: 'ranking',
        loadComponent: () => import('../alerts/conglomerate-ranking/conglomerate-ranking.component').then(m => m.ConglomerateRankingComponent),
      },
      {
        path: 'campaign-reports',
        loadComponent: () => import('./campaign-reports/campaign-reports.component').then(m => m.PautadorCampaignReportsComponent),
      },
    ],
  },
];
