import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CountryService } from '../../../core/services/country.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';

interface ContrastRow {
  member_name: string;
  google_ads_account_id: string | null;
  clientes: number;
  clientes_efectivos: number;
  menores: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cost: number;
  budget: number;
}

@Component({
  selector: 'app-conglomerado-contrast',
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatTooltipModule,
    GoogleAdsIdPipe,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1>Contraste Conglomerado</h1>
        <p class="page-subtitle">Entradas del conglomerado vs. metricas de Google Ads</p>
      </div>
    </div>

    <div class="content-card">
      <div class="tab-toolbar">
        <mat-form-field appearance="outline" class="filter-date">
          <mat-label>Desde</mat-label>
          <input matInput [matDatepicker]="dateFrom" [(ngModel)]="dateFromValue" (dateChange)="loadData()">
          <mat-datepicker-toggle matIconSuffix [for]="dateFrom"></mat-datepicker-toggle>
          <mat-datepicker #dateFrom></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline" class="filter-date">
          <mat-label>Hasta</mat-label>
          <input matInput [matDatepicker]="dateTo" [(ngModel)]="dateToValue" (dateChange)="loadData()">
          <mat-datepicker-toggle matIconSuffix [for]="dateTo"></mat-datepicker-toggle>
          <mat-datepicker #dateTo></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>País</mat-label>
          <mat-select [(value)]="selectedCountryId" (selectionChange)="loadData()">
            <mat-option [value]="0">Todos</mat-option>
            @for (country of countries; track country.id) {
              <mat-option [value]="country.id">{{ country.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-stroked-button class="action-btn" (click)="clearFilters()" matTooltip="Limpiar filtros">
          <mat-icon>restart_alt</mat-icon>
        </button>
        <span class="record-count">{{ rows.length }} miembros</span>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Cargando datos de contraste...</span>
        </div>
      } @else if (rows.length === 0) {
        <div class="empty-state">
          <mat-icon>compare</mat-icon>
          <p>No se encontraron datos para el rango seleccionado</p>
          <p class="empty-hint">Selecciona un rango de fechas y un pais para ver el contraste</p>
        </div>
      } @else {
        <div class="data-table-wrap">
          <table mat-table [dataSource]="rows">
            <ng-container matColumnDef="member_name">
              <th mat-header-cell *matHeaderCellDef>Miembro</th>
              <td mat-cell *matCellDef="let row">
                <div class="member-cell">
                  <span class="cell-primary">{{ row.member_name }}</span>
                  @if (row.google_ads_account_id) {
                    <span class="account-id-small">{{ row.google_ads_account_id | googleAdsId }}</span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="clientes">
              <th mat-header-cell *matHeaderCellDef class="num-header">Clientes</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.clientes | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="clientes_efectivos">
              <th mat-header-cell *matHeaderCellDef class="num-header">Clientes Efectivos</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.clientes_efectivos | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="menores">
              <th mat-header-cell *matHeaderCellDef class="num-header">Menores</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.menores | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="clicks">
              <th mat-header-cell *matHeaderCellDef class="num-header">Clicks</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.clicks | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="impressions">
              <th mat-header-cell *matHeaderCellDef class="num-header">Impresiones</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.impressions | number:'1.0-0' }}</td>
            </ng-container>

            <ng-container matColumnDef="conversions">
              <th mat-header-cell *matHeaderCellDef class="num-header">Conversiones</th>
              <td mat-cell *matCellDef="let row" class="num">{{ row.conversions | number:'1.0-1' }}</td>
            </ng-container>

            <ng-container matColumnDef="cost">
              <th mat-header-cell *matHeaderCellDef class="num-header">Costo</th>
              <td mat-cell *matCellDef="let row" class="num amount-cell">{{ formatMoney(row.cost) }}</td>
            </ng-container>

            <ng-container matColumnDef="budget">
              <th mat-header-cell *matHeaderCellDef class="num-header">Presupuesto</th>
              <td mat-cell *matCellDef="let row" class="num amount-cell">{{ formatMoney(row.budget) }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
    }
    .page-header h1 { margin: 0 0 4px; font-size: 24px; font-weight: var(--weight-bold); color: var(--gray-900); }
    .page-subtitle { margin: 0; font-size: 14px; color: var(--gray-500); }

    .content-card {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: 20px 24px; overflow: hidden;
    }

    .tab-toolbar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .filter-select { min-width: 180px; }
    .filter-select .mat-mdc-form-field-subscript-wrapper { display: none; }
    .filter-date { width: 150px; }
    .filter-date .mat-mdc-form-field-subscript-wrapper { display: none; }
    .action-btn {
      height: 40px; min-width: 40px; padding: 0 8px;
      border-color: var(--gray-200) !important; color: var(--gray-500) !important;
    }
    .record-count { font-size: 13px; color: var(--gray-500); margin-left: auto; white-space: nowrap; }

    .loading-state {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 48px 16px; color: var(--gray-500);
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px 16px; color: var(--gray-500); text-align: center;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; opacity: 0.5; }
    .empty-state p { margin: 0 0 4px; }
    .empty-hint { font-size: 13px; }

    .data-table-wrap { overflow-x: auto; border: var(--border-subtle); border-radius: var(--radius-md); }
    table { width: 100%; }
    .cell-primary { font-weight: var(--weight-semibold); color: var(--gray-900); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .num-header { text-align: right; }
    .amount-cell { font-weight: var(--weight-bold); color: var(--gray-900); }

    .member-cell { display: flex; flex-direction: column; gap: 2px; }
    .account-id-small {
      font-family: var(--font-mono); font-size: 11px;
      color: var(--gray-500); letter-spacing: 0.3px;
    }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .content-card { padding: 16px 12px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConglomeradoContrastComponent implements OnInit {
  rows: ContrastRow[] = [];
  countries: Country[] = [];
  selectedCountryId = 0;
  dateFromValue: Date | null = null;
  dateToValue: Date | null = null;
  loading = false;

  displayedColumns = [
    'member_name', 'clientes', 'clientes_efectivos', 'menores',
    'clicks', 'impressions', 'conversions', 'cost', 'budget',
  ];

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private authService: AuthService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });

    // Default to today
    const today = new Date();
    this.dateFromValue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.dateToValue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.loadData();
  }

  loadData(): void {
    if (!this.dateFromValue || !this.dateToValue) return;

    this.loading = true;
    this.cdr.markForCheck();

    let params = new HttpParams()
      .set('date_from', this.fmtDate(this.dateFromValue))
      .set('date_to', this.fmtDate(this.dateToValue));

    if (this.selectedCountryId) {
      params = params.set('country_id', this.selectedCountryId);
    }

    this.http.get<ApiResponse<ContrastRow[]>>(API_URLS.pautadores.conglomeradoContrast, { params }).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Error al cargar los datos de contraste');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  clearFilters(): void {
    const today = new Date();
    this.dateFromValue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.dateToValue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.selectedCountryId = 0;
    this.loadData();
  }

  formatMoney(value: number | null): string {
    if (value == null) return '—';
    return '$' + Math.round(value).toLocaleString('es-CO');
  }

  private fmtDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
}
