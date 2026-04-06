import { Routes } from '@angular/router';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { DailyEntryFormComponent } from './daily-entry-form/daily-entry-form.component';
import { EntryHistoryComponent } from './entry-history/entry-history.component';
import { WeeklySummaryComponent } from './weekly-summary/weekly-summary.component';

export const CONGLOMERADO_ROUTES: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: DailyEntryFormComponent },
      { path: 'history', component: EntryHistoryComponent },
      { path: 'weekly', component: WeeklySummaryComponent },
    ],
  },
];
