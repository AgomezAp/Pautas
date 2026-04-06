import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { GoogleAdsAnalysisService } from './google-ads-analysis.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

@Component({
  selector: 'app-google-ads-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule,
    MatProgressSpinnerModule, MatDatepickerModule, MatNativeDateModule,
    MatTabsModule, MatTooltipModule, BaseChartDirective,
  ],
  template: `
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>Analisis Google Ads</h1>
        <p class="page-subtitle">Tendencias de gasto, rendimiento y rankings de cuentas</p>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Desde</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filterDateFrom">
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Hasta</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filterDateTo">
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Pais</mat-label>
        <mat-select [(ngModel)]="filterCountryId">
          <mat-option [value]="null">Todos los paises</mat-option>
          @for (c of countries; track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <button mat-flat-button color="primary" class="apply-btn" (click)="applyFilters()">
        <mat-icon>search</mat-icon>
        Consultar
      </button>

      <button mat-stroked-button class="clear-btn" (click)="clearFilters()" matTooltip="Restablecer filtros">
        <mat-icon>restart_alt</mat-icon>
        Limpiar
      </button>
    </div>

    <!-- Tabs -->
    <mat-tab-group animationDuration="200ms" (selectedTabChange)="onTabChange($event.index)">
      <!-- Tab 1: Tendencia de Gasto -->
      <mat-tab label="Tendencia de Gasto">
        <div class="tab-content">
          <div class="toggle-row">
            <mat-button-toggle-group [(ngModel)]="granularity" (change)="loadSpendingTrend()">
              <mat-button-toggle value="daily">Diario</mat-button-toggle>
              <mat-button-toggle value="weekly">Semanal</mat-button-toggle>
              <mat-button-toggle value="monthly">Mensual</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          @if (loadingTrend) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Cargando tendencia...</span>
            </div>
          }

          @if (lineChartData) {
            <div class="chart-panel">
              <div class="chart-container">
                <canvas baseChart [data]="lineChartData" [options]="lineChartOptions" type="line"></canvas>
              </div>
            </div>
          }

          @if (spendingTrendData.length > 0) {
            <div class="table-panel">
              <div class="table-header">
                <mat-icon>table_chart</mat-icon>
                <span>Detalle por Periodo</span>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th class="text-right">Costo</th>
                      <th class="text-right">Presupuesto</th>
                      <th class="text-right">Campanas</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of spendingTrendData; track row.period) {
                      <tr>
                        <td>{{ formatPeriod(row.period) }}</td>
                        <td class="text-right fw-600">{{ formatCurrency(row.total_cost) }}</td>
                        <td class="text-right">{{ formatCurrency(row.total_budget) }}</td>
                        <td class="text-right">{{ row.campaigns_count }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- Tab 2: Rendimiento -->
      <mat-tab label="Rendimiento">
        <div class="tab-content">
          @if (loadingPerformance) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Cargando rendimiento...</span>
            </div>
          }

          @if (performanceBarData) {
            <div class="chart-panel">
              <div class="chart-title">CPC por Cuenta (Top 10)</div>
              <div class="chart-container">
                <canvas baseChart [data]="performanceBarData" [options]="performanceBarOptions" type="bar"></canvas>
              </div>
            </div>
          }

          @if (performanceData.length > 0) {
            <div class="table-panel">
              <div class="table-header">
                <mat-icon>leaderboard</mat-icon>
                <span>Metricas de Rendimiento</span>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th class="text-right">Costo</th>
                      <th class="text-right">Clicks</th>
                      <th class="text-right">Impresiones</th>
                      <th class="text-right">Conversiones</th>
                      <th class="text-right">CPC</th>
                      <th class="text-right">CTR</th>
                      <th class="text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of performanceData; track row.customer_account_id) {
                      <tr>
                        <td>
                          <div class="account-cell">
                            <span class="account-name">{{ row.customer_account_name }}</span>
                            <span class="account-country">{{ row.country_name }}</span>
                          </div>
                        </td>
                        <td class="text-right fw-600">{{ formatCurrency(row.total_cost) }}</td>
                        <td class="text-right">{{ row.total_clicks | number }}</td>
                        <td class="text-right">{{ row.total_impressions | number }}</td>
                        <td class="text-right">{{ row.total_conversions | number:'1.0-1' }}</td>
                        <td class="text-right">{{ formatCurrency(row.cpc) }}</td>
                        <td class="text-right">{{ row.ctr }}%</td>
                        <td class="text-right">{{ row.roi }}%</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- Tab 3: Rankings -->
      <mat-tab label="Rankings">
        <div class="tab-content">
          <div class="toggle-row">
            <mat-button-toggle-group [(ngModel)]="rankingSort" (change)="loadRankings()">
              <mat-button-toggle value="top">Top</mat-button-toggle>
              <mat-button-toggle value="bottom">Bottom</mat-button-toggle>
            </mat-button-toggle-group>

            <mat-button-toggle-group [(ngModel)]="rankingMetric" (change)="loadRankings()">
              <mat-button-toggle value="spend">Gasto</mat-button-toggle>
              <mat-button-toggle value="conversions">Conversiones</mat-button-toggle>
              <mat-button-toggle value="clicks">Clicks</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          @if (loadingRankings) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Cargando rankings...</span>
            </div>
          }

          @if (rankingsBarData) {
            <div class="chart-panel">
              <div class="chart-container">
                <canvas baseChart [data]="rankingsBarData" [options]="rankingsBarOptions" type="bar"></canvas>
              </div>
            </div>
          }

          @if (rankingsData.length > 0) {
            <div class="table-panel">
              <div class="table-header">
                <mat-icon>emoji_events</mat-icon>
                <span>Ranking de Cuentas</span>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cuenta</th>
                      <th class="text-right">Valor Metrica</th>
                      <th class="text-right">Costo</th>
                      <th class="text-right">Clicks</th>
                      <th class="text-right">Conversiones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rankingsData; track row.customer_account_id; let i = $index) {
                      <tr>
                        <td>
                          <span class="rank-badge">{{ i + 1 }}</span>
                        </td>
                        <td>
                          <div class="account-cell">
                            <span class="account-name">{{ row.customer_account_name }}</span>
                            <span class="account-country">{{ row.country_name }}</span>
                          </div>
                        </td>
                        <td class="text-right fw-600">{{ formatMetricValue(row.metric_value) }}</td>
                        <td class="text-right">{{ formatCurrency(row.total_cost) }}</td>
                        <td class="text-right">{{ row.total_clicks | number }}</td>
                        <td class="text-right">{{ row.total_conversions | number:'1.0-1' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- Tab 4: Distribucion Presupuestal -->
      <mat-tab label="Distribucion Presupuestal">
        <div class="tab-content">
          @if (loadingBudget) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Cargando distribucion...</span>
            </div>
          }

          @if (doughnutChartData) {
            <div class="chart-panel">
              <div class="chart-title">Presupuesto por Pais</div>
              <div class="chart-container chart-container-doughnut">
                <canvas baseChart [data]="doughnutChartData" [options]="doughnutChartOptions" type="doughnut"></canvas>
              </div>
            </div>
          }

          @if (budgetData.length > 0) {
            <div class="table-panel">
              <div class="table-header">
                <mat-icon>account_balance</mat-icon>
                <span>Distribucion por Pais</span>
              </div>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pais</th>
                      <th class="text-right">Presupuesto Asignado</th>
                      <th class="text-right">Gastado</th>
                      <th class="text-right">% Ejecucion</th>
                      <th class="text-right">Cuentas</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of budgetData; track row.country_name; let i = $index) {
                      <tr>
                        <td>
                          <div class="country-name">
                            <span class="dot" [style.background]="getColor(i)"></span>
                            {{ row.country_name || 'Sin pais' }}
                          </div>
                        </td>
                        <td class="text-right fw-600">{{ formatCurrency(row.assigned_budget) }}</td>
                        <td class="text-right">{{ formatCurrency(row.spent) }}</td>
                        <td class="text-right">
                          <div class="pct-bar-wrap">
                            <div class="pct-bar" [style.width.%]="clampPct(row.execution_pct)"
                                 [style.background]="getColor(i)"></div>
                            <span>{{ row.execution_pct }}%</span>
                          </div>
                        </td>
                        <td class="text-right">{{ row.accounts_count }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    :host { display: block; }

    .page-header { margin-bottom: 28px; }
    .page-header h1 {
      margin: 0 0 4px 0; font-size: 24px; font-weight: var(--weight-bold); color: var(--gray-900);
    }
    .page-subtitle { margin: 0; font-size: 14px; color: var(--gray-500); }

    .filters-bar {
      display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: 16px 20px 4px; margin-bottom: 24px;
    }
    .filter-field { flex: 1; min-width: 150px; max-width: 200px; }
    .filter-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    .apply-btn { margin-top: 4px; height: 40px; }
    .clear-btn {
      margin-top: 4px; height: 40px;
      border-color: var(--gray-200) !important; color: var(--gray-600) !important;
      font-size: 13px;
    }
    .clear-btn mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }

    .tab-content { padding: 24px 0; }

    .toggle-row {
      display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;
    }

    .loading-state {
      display: flex; align-items: center; gap: 14px; justify-content: center;
      padding: 60px 0; color: var(--gray-500); font-size: 14px;
    }

    .chart-panel {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: 20px 24px; margin-bottom: 20px;
    }
    .chart-title {
      font-size: 15px; font-weight: var(--weight-semibold); color: var(--gray-900); margin-bottom: 16px;
    }
    .chart-container { height: 350px; position: relative; }
    .chart-container-doughnut { height: 320px; max-width: 500px; margin: 0 auto; }

    .table-panel {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px;
    }
    .table-header {
      display: flex; align-items: center; gap: 10px; padding: 16px 24px;
      border-bottom: var(--border-subtle); font-size: 15px;
      font-weight: var(--weight-semibold); color: var(--gray-900);
    }
    .table-header mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--gray-500); }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 600px; }
    thead tr { background: var(--gray-50); }
    th {
      padding: 10px 24px; font-size: 11px; font-weight: var(--weight-semibold); color: var(--gray-500);
      text-transform: uppercase; letter-spacing: 0.5px; text-align: left;
      border-bottom: var(--border-subtle); white-space: nowrap;
    }
    td {
      padding: 12px 24px; font-size: 14px; color: var(--gray-700);
      border-bottom: 1px solid var(--gray-100); white-space: nowrap;
    }
    tbody tr:hover { background: var(--gray-50); }
    tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .fw-600 { font-weight: var(--weight-semibold); }

    .account-cell { display: flex; flex-direction: column; }
    .account-name { font-weight: var(--weight-medium); }
    .account-country { font-size: 12px; color: var(--gray-500); }

    .rank-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: var(--radius-full); background: var(--gray-50);
      font-weight: var(--weight-bold); font-size: 13px; color: var(--gray-900);
    }

    .country-name { display: flex; align-items: center; gap: 10px; font-weight: var(--weight-medium); }
    .dot { width: 10px; height: 10px; border-radius: var(--radius-full); flex-shrink: 0; }

    .pct-bar-wrap {
      display: flex; align-items: center; gap: 8px; justify-content: flex-end;
    }
    .pct-bar {
      height: 6px; border-radius: 3px; min-width: 4px; max-width: 80px; opacity: 0.7;
    }
    .pct-bar-wrap span { font-size: 13px; min-width: 40px; text-align: right; }

    @media (max-width: 768px) {
      .filters-bar { flex-direction: column; padding: 12px 16px 4px; }
      .filter-field { max-width: 100%; }
      th, td { padding: 10px 14px; }
    }
  `]
})
export class GoogleAdsAnalysisComponent implements OnInit {
  countries: Country[] = [];
  filterDateFrom: Date | null = null;
  filterDateTo: Date | null = null;
  filterCountryId: number | null = null;

  // Tab 1 - Spending Trend
  granularity = 'daily';
  loadingTrend = false;
  spendingTrendData: any[] = [];
  lineChartData: ChartConfiguration<'line'>['data'] | null = null;
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12,
        titleFont: { size: 13 }, bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        beginAtZero: true, position: 'left',
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
            return String(value);
          },
        },
        title: { display: true, text: 'Costo', font: { size: 11 }, color: '#888' },
      },
      y1: {
        beginAtZero: true, position: 'right',
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
            return String(value);
          },
        },
        title: { display: true, text: 'Presupuesto', font: { size: 11 }, color: '#888' },
      },
      x: { grid: { display: false } },
    },
  };

  // Tab 2 - Performance
  loadingPerformance = false;
  performanceData: any[] = [];
  performanceBarData: ChartConfiguration<'bar'>['data'] | null = null;
  performanceBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12 },
    },
    scales: {
      x: {
        beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'CPC', font: { size: 11 }, color: '#888' },
      },
      y: { grid: { display: false } },
    },
  };

  // Tab 3 - Rankings
  rankingMetric = 'spend';
  rankingSort = 'top';
  loadingRankings = false;
  rankingsData: any[] = [];
  rankingsBarData: ChartConfiguration<'bar'>['data'] | null = null;
  rankingsBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12 },
    },
    scales: {
      x: {
        beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' },
      },
      y: { grid: { display: false } },
    },
  };

  // Tab 4 - Budget Distribution
  loadingBudget = false;
  budgetData: any[] = [];
  doughnutChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } },
      tooltip: { backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12 },
    },
  };

  private activeTab = 0;

  constructor(
    private analysisService: GoogleAdsAnalysisService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });

    // Fetch actual data range from DB to set smart defaults
    this.analysisService.getDataRange().subscribe({
      next: (res) => {
        const data = res.data;
        if (data?.min_date && data?.max_date) {
          this.filterDateFrom = new Date(data.min_date);
          this.filterDateTo = new Date(data.max_date);

          // Auto-select best granularity based on date range
          const diffDays = Math.ceil((this.filterDateTo.getTime() - this.filterDateFrom.getTime()) / 86400000);
          if (diffDays > 90) {
            this.granularity = 'monthly';
          } else if (diffDays > 21) {
            this.granularity = 'weekly';
          } else {
            this.granularity = 'daily';
          }
        } else {
          // Fallback: last 30 days
          const today = new Date();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          this.filterDateFrom = thirtyDaysAgo;
          this.filterDateTo = today;
        }
        this.loadSpendingTrend();
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback: last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        this.filterDateFrom = thirtyDaysAgo;
        this.filterDateTo = today;
        this.loadSpendingTrend();
      },
    });
  }

  applyFilters(): void {
    switch (this.activeTab) {
      case 0: this.loadSpendingTrend(); break;
      case 1: this.loadPerformance(); break;
      case 2: this.loadRankings(); break;
      case 3: this.loadBudgetDistribution(); break;
    }
  }

  clearFilters(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    this.filterDateFrom = thirtyDaysAgo;
    this.filterDateTo = today;
    this.filterCountryId = null;
    this.applyFilters();
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    switch (index) {
      case 0:
        if (this.spendingTrendData.length === 0) this.loadSpendingTrend();
        break;
      case 1:
        if (this.performanceData.length === 0) this.loadPerformance();
        break;
      case 2:
        if (this.rankingsData.length === 0) this.loadRankings();
        break;
      case 3:
        if (this.budgetData.length === 0) this.loadBudgetDistribution();
        break;
    }
  }

  // ---- Tab 1: Spending Trend ----

  loadSpendingTrend(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingTrend = true;
    this.cdr.markForCheck();

    this.analysisService.getSpendingTrend({
      granularity: this.granularity,
      date_from: this.formatDate(this.filterDateFrom),
      date_to: this.formatDate(this.filterDateTo),
      country_id: this.filterCountryId || undefined,
    }).subscribe({
      next: (res) => {
        this.spendingTrendData = res.data || [];
        this.buildSpendingChart();
        this.loadingTrend = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingTrend = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildSpendingChart(): void {
    const data = this.spendingTrendData;
    if (!data.length) { this.lineChartData = null; return; }

    const pointRadius = data.length <= 10 ? 5 : 3;
    const pointHoverRadius = data.length <= 10 ? 7 : 5;

    this.lineChartData = {
      labels: data.map(d => this.formatPeriod(d.period)),
      datasets: [
        {
          label: 'Costo',
          data: data.map(d => Number(d.total_cost)),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(21, 101, 192, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius,
          pointHoverRadius,
          pointBackgroundColor: '#3B82F6',
          borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Presupuesto',
          data: data.map(d => Number(d.total_budget)),
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius,
          pointHoverRadius,
          pointBackgroundColor: '#10B981',
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y1',
        },
      ],
    };
  }

  // ---- Tab 2: Performance ----

  loadPerformance(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingPerformance = true;
    this.cdr.markForCheck();

    this.analysisService.getPerformance({
      date_from: this.formatDate(this.filterDateFrom),
      date_to: this.formatDate(this.filterDateTo),
      country_id: this.filterCountryId || undefined,
    }).subscribe({
      next: (res) => {
        this.performanceData = res.data || [];
        this.buildPerformanceChart();
        this.loadingPerformance = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPerformance = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildPerformanceChart(): void {
    const sorted = [...this.performanceData]
      .sort((a, b) => Number(b.cpc) - Number(a.cpc))
      .slice(0, 10);
    if (!sorted.length) { this.performanceBarData = null; return; }

    this.performanceBarData = {
      labels: sorted.map(d => d.customer_account_name || d.customer_account_id),
      datasets: [{
        label: 'CPC',
        data: sorted.map(d => Number(d.cpc)),
        backgroundColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'DD'),
        borderColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }

  // ---- Tab 3: Rankings ----

  loadRankings(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingRankings = true;
    this.cdr.markForCheck();

    this.analysisService.getRankings({
      metric: this.rankingMetric,
      sort: this.rankingSort,
      limit: 10,
      date_from: this.formatDate(this.filterDateFrom),
      date_to: this.formatDate(this.filterDateTo),
    }).subscribe({
      next: (res) => {
        this.rankingsData = res.data || [];
        this.buildRankingsChart();
        this.loadingRankings = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingRankings = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildRankingsChart(): void {
    if (!this.rankingsData.length) { this.rankingsBarData = null; return; }

    this.rankingsBarData = {
      labels: this.rankingsData.map(d => d.customer_account_name || d.customer_account_id),
      datasets: [{
        label: this.getMetricLabel(),
        data: this.rankingsData.map(d => Number(d.metric_value)),
        backgroundColor: this.rankingsData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'DD'),
        borderColor: this.rankingsData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }

  // ---- Tab 4: Budget Distribution ----

  loadBudgetDistribution(): void {
    this.loadingBudget = true;
    this.cdr.markForCheck();

    this.analysisService.getBudgetDistribution(
      this.filterCountryId || undefined,
    ).subscribe({
      next: (res) => {
        this.budgetData = res.data || [];
        this.buildBudgetChart();
        this.loadingBudget = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingBudget = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildBudgetChart(): void {
    if (!this.budgetData.length) { this.doughnutChartData = null; return; }

    this.doughnutChartData = {
      labels: this.budgetData.map(d => d.country_name || 'Sin pais'),
      datasets: [{
        data: this.budgetData.map(d => Number(d.assigned_budget)),
        backgroundColor: this.budgetData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }

  // ---- Helpers ----

  formatCurrency(value: any): string {
    const num = Number(value) || 0;
    return '$' + Math.round(num).toLocaleString('es-CO');
  }

  formatPeriod(period: string): string {
    if (!period) return '';
    const d = new Date(period);
    if (this.granularity === 'monthly') {
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      return months[d.getMonth()] + ' ' + d.getFullYear();
    }
    if (this.granularity === 'weekly') {
      return 'Sem ' + this.getISOWeek(d) + ' (' + d.getDate() + '/' + (d.getMonth() + 1) + ')';
    }
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  formatMetricValue(value: any): string {
    const num = Number(value) || 0;
    if (this.rankingMetric === 'spend') {
      return this.formatCurrency(num);
    }
    return num.toLocaleString('es-CO');
  }

  getColor(index: number): string {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  clampPct(pct: any): number {
    const num = Number(pct) || 0;
    return Math.min(num, 100);
  }

  private getMetricLabel(): string {
    switch (this.rankingMetric) {
      case 'spend': return 'Gasto';
      case 'conversions': return 'Conversiones';
      case 'clicks': return 'Clicks';
      default: return 'Valor';
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
}
