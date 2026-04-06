import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertsService } from '../alerts.service';
import { CountryService } from '../../../core/services/country.service';
import { ConglomerateRanking } from '../../../core/models/alert.model';

@Component({
  selector: 'app-conglomerate-ranking',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatIconModule, MatSelectModule, MatFormFieldModule,
    MatProgressSpinnerModule, MatTableModule, MatTooltipModule,
  ],
  template: `
    <div class="ranking-page">
      <h2 class="page-title">Ranking de Conglomerados</h2>
      <p class="page-subtitle">Ranking por tasa de conversi\u00f3n (clientes efectivos / clientes totales) de los \u00faltimos 30 d\u00edas.</p>

      <mat-card class="filter-card">
        <mat-form-field appearance="outline">
          <mat-label>Filtrar por Pa\u00eds</mat-label>
          <mat-select [(value)]="selectedCountry" (selectionChange)="loadRanking()">
            <mat-option [value]="undefined">Todos los pa\u00edses</mat-option>
            @for (country of countries; track country.id) {
              <mat-option [value]="country.id">{{ country.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-card>

      @if (loading) {
        <div class="loading-container">
          <mat-progress-spinner mode="indeterminate" diameter="40" />
        </div>
      } @else {
        @if (rankings.length === 0) {
          <mat-card class="empty-state">
            <mat-icon>emoji_events</mat-icon>
            <p>No hay datos de ranking disponibles.</p>
          </mat-card>
        } @else {
          <mat-card class="table-card">
            <table mat-table [dataSource]="rankings" class="ranking-table">
              <ng-container matColumnDef="rank">
                <th mat-header-cell *matHeaderCellDef>#</th>
                <td mat-cell *matCellDef="let row">
                  <div class="rank-badge" [class]="getRankClass(row.rank_in_country)">
                    @if (row.rank_in_country <= 3) {
                      <mat-icon>{{ row.rank_in_country === 1 ? 'emoji_events' : 'military_tech' }}</mat-icon>
                    }
                    {{ row.rank_in_country }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Conglomerado</th>
                <td mat-cell *matCellDef="let row">
                  <div class="user-cell">
                    <span class="user-cell__name">{{ row.full_name }}</span>
                    <span class="user-cell__username">{{ row.username }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="country">
                <th mat-header-cell *matHeaderCellDef>Pa\u00eds</th>
                <td mat-cell *matCellDef="let row">
                  <span class="country-chip">{{ row.country_code }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="campaign">
                <th mat-header-cell *matHeaderCellDef>Campa\u00f1a</th>
                <td mat-cell *matCellDef="let row">{{ row.campaign_name || '—' }}</td>
              </ng-container>

              <ng-container matColumnDef="conversion_rate">
                <th mat-header-cell *matHeaderCellDef>Conversi\u00f3n</th>
                <td mat-cell *matCellDef="let row">
                  <div class="rate-cell">
                    <div class="rate-bar">
                      <div class="rate-bar__fill" [style.width.%]="row.conversion_rate" [class]="getRateClass(row.conversion_rate)"></div>
                    </div>
                    <span class="rate-value">{{ row.conversion_rate }}%</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="total_clientes">
                <th mat-header-cell *matHeaderCellDef>Clientes</th>
                <td mat-cell *matCellDef="let row">{{ row.total_clientes | number }}</td>
              </ng-container>

              <ng-container matColumnDef="total_efectivos">
                <th mat-header-cell *matHeaderCellDef>Efectivos</th>
                <td mat-cell *matCellDef="let row">{{ row.total_efectivos | number }}</td>
              </ng-container>

              <ng-container matColumnDef="entries">
                <th mat-header-cell *matHeaderCellDef>Reportes</th>
                <td mat-cell *matCellDef="let row">{{ row.total_entries }}</td>
              </ng-container>

              <ng-container matColumnDef="last_entry">
                <th mat-header-cell *matHeaderCellDef>\u00daltimo Reporte</th>
                <td mat-cell *matCellDef="let row">{{ row.last_entry_date ? (row.last_entry_date | date:'dd/MM/yy') : 'Nunca' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                  [class.top-1]="row.rank_in_country === 1"
                  [class.top-3]="row.rank_in_country <= 3"></tr>
            </table>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .ranking-page { max-width: 1200px; margin: 0 auto; }

    .page-title {
      font-size: 1.5rem; font-weight: 600;
      color: var(--gray-900); margin: 0 0 var(--space-1) 0;
    }
    .page-subtitle {
      font-size: 0.85rem; color: var(--gray-500);
      margin: 0 0 var(--space-4) 0;
    }

    .filter-card { padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); }
    .filter-card mat-form-field { min-width: 250px; }
    .filter-card ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }

    .table-card { padding: 0; overflow: hidden; }

    .ranking-table { width: 100%; }

    .rank-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-weight: 700; font-size: 0.9rem; color: var(--gray-600);
    }
    .rank-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .rank-badge.rank-1 { color: #f9a825; }
    .rank-badge.rank-2 { color: #78909c; }
    .rank-badge.rank-3 { color: #8d6e63; }

    .user-cell { display: flex; flex-direction: column; }
    .user-cell__name { font-weight: 500; font-size: 0.9rem; color: var(--gray-800); }
    .user-cell__username { font-size: 0.75rem; color: var(--gray-400); }

    .country-chip {
      display: inline-block; background: var(--gray-100);
      padding: 2px 10px; border-radius: 10px;
      font-size: 0.75rem; font-weight: 600; color: var(--gray-600);
    }

    .rate-cell { display: flex; align-items: center; gap: var(--space-2); }
    .rate-bar {
      width: 80px; height: 8px; border-radius: 4px;
      background: var(--gray-100); overflow: hidden;
    }
    .rate-bar__fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .rate-bar__fill.rate-high { background: #4caf50; }
    .rate-bar__fill.rate-medium { background: #ff9800; }
    .rate-bar__fill.rate-low { background: #f44336; }
    .rate-value { font-size: 0.85rem; font-weight: 600; min-width: 50px; }

    tr.top-1 { background: #fffde7; }
    tr.top-3 { font-weight: 500; }

    .loading-container { display: flex; justify-content: center; padding: var(--space-8); }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: var(--space-8); color: var(--gray-400);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: var(--space-3); }
  `],
})
export class ConglomerateRankingComponent implements OnInit {
  rankings: ConglomerateRanking[] = [];
  countries: any[] = [];
  selectedCountry: number | undefined;
  loading = false;

  displayedColumns = ['rank', 'name', 'country', 'campaign', 'conversion_rate', 'total_clientes', 'total_efectivos', 'entries', 'last_entry'];

  constructor(
    private alertsService: AlertsService,
    private countryService: CountryService,
  ) {}

  ngOnInit(): void {
    this.loadCountries();
    this.loadRanking();
  }

  loadCountries(): void {
    this.countryService.getAll().subscribe({
      next: (res:any) => this.countries = res.data || [],
      error: () => {},
    });
  }

  loadRanking(): void {
    this.loading = true;
    this.alertsService.getRanking(this.selectedCountry).subscribe({
      next: (res) => {
        this.rankings = res.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }

  getRateClass(rate: number): string {
    if (rate >= 60) return 'rate-high';
    if (rate >= 30) return 'rate-medium';
    return 'rate-low';
  }
}
