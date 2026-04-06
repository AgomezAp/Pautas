import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AlertsService } from '../alerts.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Alert,
  AlertSummary,
  AlertTrendItem,
  TopAlertedUser,
  AlertFilters,
  AlertSeverity,
  AlertStatus,
} from '../../../core/models/alert.model';

@Component({
  selector: 'app-alert-dashboard',
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatChipsModule, MatMenuModule,
    MatPaginatorModule, MatProgressSpinnerModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule,
    BaseChartDirective,
  ],
  template: `
    <div class="alerts-dashboard">
      <h2 class="page-title">Centro de Alertas</h2>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <mat-card class="summary-card summary-card--critical" (click)="filterBySeverity('CRITICAL')">
          <div class="summary-card__icon">
            <mat-icon>error</mat-icon>
          </div>
          <div class="summary-card__content">
            <span class="summary-card__value">{{ summary?.critical?.active || 0 }}</span>
            <span class="summary-card__label">Cr\u00edticas Activas</span>
          </div>
          <span class="summary-card__total">{{ summary?.critical?.total || 0 }} total</span>
        </mat-card>

        <mat-card class="summary-card summary-card--warning" (click)="filterBySeverity('WARNING')">
          <div class="summary-card__icon">
            <mat-icon>warning</mat-icon>
          </div>
          <div class="summary-card__content">
            <span class="summary-card__value">{{ summary?.warning?.active || 0 }}</span>
            <span class="summary-card__label">Advertencias Activas</span>
          </div>
          <span class="summary-card__total">{{ summary?.warning?.total || 0 }} total</span>
        </mat-card>

        <mat-card class="summary-card summary-card--info" (click)="filterBySeverity('INFO')">
          <div class="summary-card__icon">
            <mat-icon>info</mat-icon>
          </div>
          <div class="summary-card__content">
            <span class="summary-card__value">{{ summary?.info?.active || 0 }}</span>
            <span class="summary-card__label">Informativas Activas</span>
          </div>
          <span class="summary-card__total">{{ summary?.info?.total || 0 }} total</span>
        </mat-card>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <div class="filters-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Severidad</mat-label>
            <mat-select [(value)]="filters.severity" (selectionChange)="loadAlerts()">
              <mat-option [value]="undefined">Todas</mat-option>
              <mat-option value="CRITICAL">Cr\u00edtica</mat-option>
              <mat-option value="WARNING">Advertencia</mat-option>
              <mat-option value="INFO">Informativa</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Estado</mat-label>
            <mat-select [(value)]="filters.status" (selectionChange)="loadAlerts()">
              <mat-option [value]="undefined">Todos</mat-option>
              <mat-option value="ACTIVE">Activa</mat-option>
              <mat-option value="ACKNOWLEDGED">Vista</mat-option>
              <mat-option value="RESOLVED">Resuelta</mat-option>
              <mat-option value="DISMISSED">Descartada</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Pa\u00eds</mat-label>
            <mat-select [(value)]="filters.country_id" (selectionChange)="loadAlerts()">
              <mat-option [value]="undefined">Todos</mat-option>
              @for (country of countries; track country.id) {
                <mat-option [value]="country.id">{{ country.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Desde</mat-label>
            <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="dateFrom" (dateChange)="onDateChange()">
            <mat-datepicker-toggle matIconSuffix [for]="pickerFrom" />
            <mat-datepicker #pickerFrom />
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Hasta</mat-label>
            <input matInput [matDatepicker]="pickerTo" [(ngModel)]="dateTo" (dateChange)="onDateChange()">
            <mat-datepicker-toggle matIconSuffix [for]="pickerTo" />
            <mat-datepicker #pickerTo />
          </mat-form-field>

          <button mat-stroked-button (click)="clearFilters()">
            <mat-icon>clear</mat-icon> Limpiar
          </button>
        </div>
      </mat-card>

      <div class="main-grid">
        <!-- Alerts List -->
        <div class="alerts-list-section">
          @if (loading) {
            <div class="loading-container">
              <mat-progress-spinner mode="indeterminate" diameter="40" />
            </div>
          } @else {
            @for (alert of alerts; track alert.id) {
              <mat-card class="alert-card" [class]="'alert-card--' + alert.severity.toLowerCase()">
                <div class="alert-card__header">
                  <div class="alert-card__severity">
                    <mat-icon>{{ getSeverityIcon(alert.severity) }}</mat-icon>
                    <span class="alert-card__type-badge">{{ getTypeLabel(alert.alert_type) }}</span>
                  </div>
                  <div class="alert-card__meta">
                    <span class="alert-card__status-chip" [class]="'chip--' + alert.status.toLowerCase()">
                      {{ getStatusLabel(alert.status) }}
                    </span>
                    <span class="alert-card__date">{{ alert.created_at | date:'dd/MM/yy HH:mm' }}</span>
                  </div>
                </div>

                <h4 class="alert-card__title">{{ alert.title }}</h4>
                <p class="alert-card__message">{{ alert.message }}</p>

                <div class="alert-card__context">
                  @if (alert.user_full_name) {
                    <span class="context-chip">
                      <mat-icon>person</mat-icon> {{ alert.user_full_name }}
                    </span>
                  }
                  @if (alert.country_name) {
                    <span class="context-chip">
                      <mat-icon>public</mat-icon> {{ alert.country_name }}
                    </span>
                  }
                  @if (alert.campaign_name) {
                    <span class="context-chip">
                      <mat-icon>campaign</mat-icon> {{ alert.campaign_name }}
                    </span>
                  }
                </div>

                @if (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') {
                  <div class="alert-card__actions">
                    @if (alert.status === 'ACTIVE') {
                      <button mat-stroked-button color="primary" (click)="onAcknowledge(alert)">
                        <mat-icon>visibility</mat-icon> Marcar vista
                      </button>
                    }
                    <button mat-stroked-button color="accent" (click)="onResolve(alert)">
                      <mat-icon>check_circle</mat-icon> Resolver
                    </button>
                    <button mat-stroked-button (click)="onDismiss(alert)">
                      <mat-icon>close</mat-icon> Descartar
                    </button>
                  </div>
                }
              </mat-card>
            } @empty {
              <mat-card class="empty-state">
                <mat-icon>notifications_none</mat-icon>
                <p>No hay alertas para los filtros seleccionados.</p>
              </mat-card>
            }

            @if (totalAlerts > pageSize) {
              <mat-paginator
                [length]="totalAlerts"
                [pageSize]="pageSize"
                [pageSizeOptions]="[10, 25, 50]"
                (page)="onPageChange($event)"
                showFirstLastButtons
              />
            }
          }
        </div>

        <!-- Sidebar: Chart + Top Alerted -->
        <div class="sidebar-section">
          <mat-card class="chart-card">
            <h3>Tendencia (7 d\u00edas)</h3>
            @if (trendChartData) {
              <canvas baseChart
                [data]="trendChartData"
                [options]="trendChartOptions"
                type="bar"
              ></canvas>
            }
          </mat-card>

          <mat-card class="top-alerted-card">
            <h3>Top Alertados (30 d\u00edas)</h3>
            @for (user of topAlerted; track user.user_id; let i = $index) {
              <div class="top-item">
                <span class="top-item__rank">{{ i + 1 }}</span>
                <div class="top-item__info">
                  <span class="top-item__name">{{ user.full_name }}</span>
                  <span class="top-item__country">{{ user.country_name }}</span>
                </div>
                <div class="top-item__counts">
                  @if (user.critical_count > 0) {
                    <span class="count-badge count-badge--critical">{{ user.critical_count }}</span>
                  }
                  @if (user.warning_count > 0) {
                    <span class="count-badge count-badge--warning">{{ user.warning_count }}</span>
                  }
                  @if (user.info_count > 0) {
                    <span class="count-badge count-badge--info">{{ user.info_count }}</span>
                  }
                </div>
              </div>
            } @empty {
              <p class="empty-text">Sin datos.</p>
            }
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .alerts-dashboard { max-width: 1400px; margin: 0 auto; }

    .page-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--gray-900);
      margin: 0 0 var(--space-5) 0;
    }

    /* ─── Summary Cards ─── */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      border-left: 4px solid transparent;
      position: relative;
    }
    .summary-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

    .summary-card--critical { border-left-color: #f44336; }
    .summary-card--critical .summary-card__icon { color: #f44336; background: #ffebee; }
    .summary-card--warning { border-left-color: #ff9800; }
    .summary-card--warning .summary-card__icon { color: #ff9800; background: #fff3e0; }
    .summary-card--info { border-left-color: #2196f3; }
    .summary-card--info .summary-card__icon { color: #2196f3; background: #e3f2fd; }

    .summary-card__icon {
      width: 48px; height: 48px;
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
    }
    .summary-card__icon mat-icon { font-size: 28px; width: 28px; height: 28px; }

    .summary-card__content { flex: 1; display: flex; flex-direction: column; }
    .summary-card__value { font-size: 2rem; font-weight: 700; color: var(--gray-900); line-height: 1; }
    .summary-card__label { font-size: 0.8rem; color: var(--gray-500); margin-top: 4px; }
    .summary-card__total { font-size: 0.75rem; color: var(--gray-400); position: absolute; top: 12px; right: 16px; }

    /* ─── Filters ─── */
    .filters-card { padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); }
    .filters-row {
      display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center;
    }
    .filter-field { min-width: 140px; flex: 1; }
    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }

    /* ─── Main Grid ─── */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: var(--space-5);
    }

    /* ─── Alert Cards ─── */
    .alert-card {
      margin-bottom: var(--space-3);
      padding: var(--space-4);
      border-left: 4px solid transparent;
      transition: box-shadow 0.15s;
    }
    .alert-card:hover { box-shadow: var(--shadow-md); }
    .alert-card--critical { border-left-color: #f44336; }
    .alert-card--warning { border-left-color: #ff9800; }
    .alert-card--info { border-left-color: #2196f3; }

    .alert-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
    .alert-card__severity { display: flex; align-items: center; gap: var(--space-2); }
    .alert-card--critical .alert-card__severity mat-icon { color: #f44336; }
    .alert-card--warning .alert-card__severity mat-icon { color: #ff9800; }
    .alert-card--info .alert-card__severity mat-icon { color: #2196f3; }

    .alert-card__type-badge {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      background: var(--gray-100); color: var(--gray-600);
      padding: 2px 8px; border-radius: 10px;
    }

    .alert-card__meta { display: flex; align-items: center; gap: var(--space-2); }
    .alert-card__status-chip {
      font-size: 0.7rem; font-weight: 600; padding: 2px 10px;
      border-radius: 10px; text-transform: uppercase;
    }
    .chip--active { background: #ffebee; color: #c62828; }
    .chip--acknowledged { background: #e3f2fd; color: #1565c0; }
    .chip--resolved { background: #e8f5e9; color: #2e7d32; }
    .chip--dismissed { background: var(--gray-100); color: var(--gray-500); }

    .alert-card__date { font-size: 0.75rem; color: var(--gray-400); }
    .alert-card__title { font-size: 0.95rem; font-weight: 600; color: var(--gray-900); margin: 0 0 4px 0; }
    .alert-card__message { font-size: 0.85rem; color: var(--gray-600); margin: 0 0 var(--space-2) 0; line-height: 1.4; }

    .alert-card__context { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
    .context-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.75rem; color: var(--gray-500); background: var(--gray-50);
      padding: 2px 8px; border-radius: 6px;
    }
    .context-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .alert-card__actions { display: flex; gap: var(--space-2); }
    .alert-card__actions button { font-size: 0.8rem; }
    .alert-card__actions mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }

    /* ─── Sidebar ─── */
    .chart-card, .top-alerted-card { padding: var(--space-4); margin-bottom: var(--space-4); }
    .chart-card h3, .top-alerted-card h3 {
      font-size: 0.95rem; font-weight: 600; color: var(--gray-800);
      margin: 0 0 var(--space-3) 0;
    }

    .top-item {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--gray-100);
    }
    .top-item:last-child { border-bottom: none; }
    .top-item__rank {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--gray-100); color: var(--gray-600);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
    }
    .top-item__info { flex: 1; min-width: 0; }
    .top-item__name { display: block; font-size: 0.85rem; font-weight: 500; color: var(--gray-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-item__country { display: block; font-size: 0.7rem; color: var(--gray-400); }
    .top-item__counts { display: flex; gap: 4px; }
    .count-badge {
      font-size: 0.7rem; font-weight: 700; color: #fff;
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .count-badge--critical { background: #f44336; }
    .count-badge--warning { background: #ff9800; }
    .count-badge--info { background: #2196f3; }

    /* ─── States ─── */
    .loading-container { display: flex; justify-content: center; padding: var(--space-8); }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: var(--space-8); color: var(--gray-400);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: var(--space-3); }
    .empty-text { font-size: 0.85rem; color: var(--gray-400); text-align: center; }

    /* ─── Responsive ─── */
    @media (max-width: 1024px) {
      .main-grid { grid-template-columns: 1fr; }
      .sidebar-section { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    }
    @media (max-width: 768px) {
      .summary-cards { grid-template-columns: 1fr; }
      .sidebar-section { grid-template-columns: 1fr; }
    }
  `],
})
export class AlertDashboardComponent implements OnInit {
  summary: AlertSummary | null = null;
  alerts: Alert[] = [];
  topAlerted: TopAlertedUser[] = [];
  countries: any[] = [];
  loading = false;
  totalAlerts = 0;
  pageSize = 10;
  currentPage = 0;

  filters: AlertFilters = {};
  dateFrom: Date | null = null;
  dateTo: Date | null = null;

  trendChartData: ChartConfiguration<'bar'>['data'] | null = null;
  trendChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  private isAdmin = false;

  constructor(
    private alertsService: AlertsService,
    private countryService: CountryService,
    private notification: NotificationService,
    private authService: AuthService,
  ) {
    this.isAdmin = ['admin', 'pautador'].includes(this.authService.userRole() || '');
  }

  ngOnInit(): void {
    this.loadCountries();
    this.loadAll();
  }

  loadAll(): void {
    this.loadSummary();
    this.loadAlerts();
    this.loadTrend();
    this.loadTopAlerted();
  }

  loadCountries(): void {
    this.countryService.getAll().subscribe({
      next: (res:any) => this.countries = res.data || [],
      error: () => {},
    });
  }

  loadSummary(): void {
    this.alertsService.getSummary().subscribe({
      next: (res) => this.summary = res.data,
      error: () => {},
    });
  }

  loadAlerts(): void {
    this.loading = true;
    const params: AlertFilters = {
      ...this.filters,
      page: this.currentPage + 1,
      limit: this.pageSize,
    };
    this.alertsService.getAlerts(params).subscribe({
      next: (res: any) => {
        this.alerts = res.data || [];
        this.totalAlerts = res.meta?.total || 0;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadTrend(): void {
    this.alertsService.getTrend().subscribe({
      next: (res) => this.buildTrendChart(res.data || []),
      error: () => {},
    });
  }

  loadTopAlerted(): void {
    this.alertsService.getTopAlerted(10).subscribe({
      next: (res) => this.topAlerted = res.data || [],
      error: () => {},
    });
  }

  filterBySeverity(severity: AlertSeverity): void {
    this.filters.severity = this.filters.severity === severity ? undefined : severity;
    this.currentPage = 0;
    this.loadAlerts();
  }

  onDateChange(): void {
    this.filters.date_from = this.dateFrom ? this.formatDate(this.dateFrom) : undefined;
    this.filters.date_to = this.dateTo ? this.formatDate(this.dateTo) : undefined;
    this.currentPage = 0;
    this.loadAlerts();
  }

  clearFilters(): void {
    this.filters = {};
    this.dateFrom = null;
    this.dateTo = null;
    this.currentPage = 0;
    this.loadAlerts();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAlerts();
  }

  onAcknowledge(alert: Alert): void {
    this.alertsService.acknowledge(alert.id).subscribe({
      next: () => {
        this.notification.success('Alerta marcada como vista');
        this.loadAll();
      },
      error: (err) => this.notification.error(err.error?.error?.message || 'Error al actualizar alerta'),
    });
  }

  onResolve(alert: Alert): void {
    this.alertsService.resolve(alert.id).subscribe({
      next: () => {
        this.notification.success('Alerta resuelta');
        this.loadAll();
      },
      error: (err) => this.notification.error(err.error?.error?.message || 'Error al resolver alerta'),
    });
  }

  onDismiss(alert: Alert): void {
    this.alertsService.dismiss(alert.id).subscribe({
      next: () => {
        this.notification.success('Alerta descartada');
        this.loadAll();
      },
      error: (err) => this.notification.error(err.error?.error?.message || 'Error al descartar alerta'),
    });
  }

  getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
    }
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      CONVERSION_DROP: 'Conversi\u00f3n',
      ZERO_EFFECTIVE: 'Cero Efectivos',
      TRAFFIC_DROP: 'Tr\u00e1fico',
      HIGH_MINORS_RATIO: 'Menores',
      NO_REPORT: 'Sin Reporte',
      CONVERSION_SPIKE: 'Pico',
      RECORD_DAY: 'R\u00e9cord',
      TREND_DECLINING: 'Tendencia',
      ADS_DISCREPANCY: 'Ads vs Campo',
    };
    return labels[type] || type;
  }

  getStatusLabel(status: AlertStatus): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Activa',
      ACKNOWLEDGED: 'Vista',
      RESOLVED: 'Resuelta',
      DISMISSED: 'Descartada',
    };
    return labels[status] || status;
  }

  private buildTrendChart(data: AlertTrendItem[]): void {
    const dates = [...new Set(data.map(d => d.date))].sort();
    const last7: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7.push(d.toISOString().split('T')[0]);
    }

    const labels = last7.map(d => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}`;
    });

    const getSeverityData = (severity: string) =>
      last7.map(date => {
        const item = data.find(d => d.date === date && d.severity === severity);
        return item ? Number(item.count) : 0;
      });

    this.trendChartData = {
      labels,
      datasets: [
        { label: 'Cr\u00edticas', data: getSeverityData('CRITICAL'), backgroundColor: '#f4433666', borderColor: '#f44336', borderWidth: 1 },
        { label: 'Advertencias', data: getSeverityData('WARNING'), backgroundColor: '#ff980066', borderColor: '#ff9800', borderWidth: 1 },
        { label: 'Info', data: getSeverityData('INFO'), backgroundColor: '#2196f366', borderColor: '#2196f3', borderWidth: 1 },
      ],
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
