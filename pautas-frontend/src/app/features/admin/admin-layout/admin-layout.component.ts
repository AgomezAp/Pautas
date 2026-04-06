import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatTooltipModule, BaseChartDirective,
  ],
  template: `
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1>Panel de Administración</h1>
        <p class="page-subtitle">Resumen general del sistema y métricas de recargas</p>
      </div>
    </div>

    <!-- System Stats -->
    <div class="stats-row">
      @for (stat of stats; track stat.label) {
        <div class="stat-chip">
          <div class="stat-chip-icon" [style.background]="stat.bg">
            <mat-icon>{{ stat.icon }}</mat-icon>
          </div>
          <div class="stat-chip-info">
            <span class="stat-chip-value">{{ stat.value }}</span>
            <span class="stat-chip-label">{{ stat.label }}</span>
          </div>
        </div>
      }
    </div>

    <!-- Recharges Section Header -->
    <div class="section-header">
      <div class="section-header-left">
        <mat-icon class="section-icon">payments</mat-icon>
        <h2>Recargas Google Ads</h2>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-bar">
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>País</mat-label>
        <mat-select [(ngModel)]="filterCountry" (selectionChange)="loadRechargesDashboard()">
          <mat-option [value]="''">Todos los países</mat-option>
          @for (c of countryOptions; track c.value) {
            <mat-option [value]="c.value">{{ c.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Desde</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filterDateFrom"
               (dateChange)="loadRechargesDashboard()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Hasta</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filterDateTo"
               (dateChange)="loadRechargesDashboard()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Buscar cuenta</mat-label>
        <input matInput [(ngModel)]="filterAccount" (keyup.enter)="loadRechargesDashboard()">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Perfil de pago</mat-label>
        <mat-select [(ngModel)]="filterPaymentProfile" (selectionChange)="loadRechargesDashboard()">
          <mat-option [value]="''">Todos</mat-option>
          @for (p of paymentProfiles; track p) {
            <mat-option [value]="p">{{ p }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <button mat-stroked-button class="clear-btn" (click)="clearFilters()" matTooltip="Restablecer filtros">
        <mat-icon>restart_alt</mat-icon>
        Limpiar
      </button>
    </div>

    @if (loadingRecharges) {
      <div class="loading-state">
        <mat-spinner diameter="36"></mat-spinner>
        <span>Cargando métricas de recargas...</span>
      </div>
    }

    @if (rechargesData) {
      <!-- Main KPIs Row -->
      <div class="kpi-row">
        <div class="kpi-box kpi-total">
          <div class="kpi-box-inner">
            <div class="kpi-icon-wrap bg-blue"><mat-icon>account_balance_wallet</mat-icon></div>
            <div class="kpi-data">
              <span class="kpi-label">Total Recargado</span>
              <span class="kpi-amount">{{ formatCurrency(rechargesData.kpis.totalAmount) }}</span>
              <span class="kpi-meta">{{ rechargesData.kpis.totalCount | number }} recargas en total</span>
            </div>
          </div>
        </div>

        <div class="kpi-box">
          <div class="kpi-box-inner">
            <div class="kpi-icon-wrap bg-green"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-data">
              <span class="kpi-label">Total Recargas</span>
              <span class="kpi-amount">{{ rechargesData.kpis.totalCount | number }}</span>
              <span class="kpi-meta">Operaciones registradas</span>
            </div>
          </div>
        </div>

        <div class="kpi-box">
          <div class="kpi-box-inner">
            <div class="kpi-icon-wrap bg-orange"><mat-icon>analytics</mat-icon></div>
            <div class="kpi-data">
              <span class="kpi-label">Promedio por Recarga</span>
              <span class="kpi-amount">{{ formatCurrency(rechargesData.kpis.avgAmount) }}</span>
              <span class="kpi-meta">Valor promedio</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Period Comparison Cards -->
      <div class="period-row">
        <div class="period-card">
          <div class="period-top">
            <span class="period-label">
              <mat-icon>today</mat-icon> Hoy
            </span>
            <span class="period-badge" [class]="'period-badge ' + getChangeType(rechargesData.kpis.todayChange)">
              <mat-icon>{{ getChangeIcon(rechargesData.kpis.todayChange) }}</mat-icon>
              {{ formatChange(rechargesData.kpis.todayChange) }}
            </span>
          </div>
          <span class="period-amount">{{ formatCurrency(rechargesData.kpis.todayTotal) }}</span>
          <span class="period-meta">{{ rechargesData.kpis.todayCount }} recargas &middot; vs ayer</span>
        </div>

        <div class="period-card">
          <div class="period-top">
            <span class="period-label">
              <mat-icon>date_range</mat-icon> Esta Semana
            </span>
            <span class="period-badge" [class]="'period-badge ' + getChangeType(rechargesData.kpis.weekChange)">
              <mat-icon>{{ getChangeIcon(rechargesData.kpis.weekChange) }}</mat-icon>
              {{ formatChange(rechargesData.kpis.weekChange) }}
            </span>
          </div>
          <span class="period-amount">{{ formatCurrency(rechargesData.kpis.thisWeekTotal) }}</span>
          <span class="period-meta">{{ rechargesData.kpis.thisWeekCount }} recargas &middot; vs sem. anterior</span>
        </div>

        <div class="period-card">
          <div class="period-top">
            <span class="period-label">
              <mat-icon>calendar_month</mat-icon> Este Mes
            </span>
            <span class="period-badge" [class]="'period-badge ' + getChangeType(rechargesData.kpis.monthChange)">
              <mat-icon>{{ getChangeIcon(rechargesData.kpis.monthChange) }}</mat-icon>
              {{ formatChange(rechargesData.kpis.monthChange) }}
            </span>
          </div>
          <span class="period-amount">{{ formatCurrency(rechargesData.kpis.thisMonthTotal) }}</span>
          <span class="period-meta">{{ rechargesData.kpis.thisMonthCount }} recargas &middot; vs mes anterior</span>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="charts-layout">
        <div class="chart-panel chart-full">
          <div class="chart-title">Tendencia Diaria <span class="chart-subtitle">(últimos 30 días)</span></div>
          @if (lineChartData) {
            <canvas baseChart [data]="lineChartData" [options]="lineChartOptions" type="line"></canvas>
          }
        </div>

        <div class="chart-panel">
          <div class="chart-title">Monto por País</div>
          @if (barChartData) {
            <canvas baseChart [data]="barChartData" [options]="barChartOptions" type="bar"></canvas>
          }
        </div>

        <div class="chart-panel">
          <div class="chart-title">Distribución por País</div>
          @if (pieChartData) {
            <canvas baseChart [data]="pieChartData" [options]="pieChartOptions" type="doughnut"></canvas>
          }
        </div>
      </div>

      <!-- Country Breakdown Table -->
      <div class="table-panel">
        <div class="table-header">
          <mat-icon>public</mat-icon>
          <span>Desglose por País</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>País</th>
              <th class="text-right">Recargas</th>
              <th class="text-right">Total Recargado</th>
              <th class="text-right">Promedio</th>
              <th class="text-right">Participación</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rechargesData.byCountry; track row.country) {
              <tr>
                <td>
                  <div class="country-name">
                    <span class="dot" [style.background]="getCountryColor(row.country)"></span>
                    {{ row.country }}
                  </div>
                </td>
                <td class="text-right">{{ row.count | number }}</td>
                <td class="text-right fw-600">{{ formatCurrency(row.total) }}</td>
                <td class="text-right">{{ formatCurrency(row.count > 0 ? row.total / row.count : 0) }}</td>
                <td class="text-right">
                  <div class="pct-bar-wrap">
                    <div class="pct-bar" [style.width.%]="(row.total / rechargesData.kpis.totalAmount) * 100"
                         [style.background]="getCountryColor(row.country)"></div>
                    <span>{{ ((row.total / rechargesData.kpis.totalAmount) * 100).toFixed(1) }}%</span>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    /* Page Header */
    .page-header { margin-bottom: var(--space-6); }
    .page-header h1 {
      margin: 0 0 4px 0; font-size: var(--text-2xl); font-weight: var(--weight-bold);
      color: var(--gray-900); letter-spacing: var(--tracking-tight);
      position: relative; padding-bottom: var(--space-3);
    }
    .page-header h1::after {
      content: ''; position: absolute; bottom: 0; left: 0;
      width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full);
    }
    .page-subtitle { margin: 0; font-size: var(--text-base); color: var(--gray-500); }

    /* Stats Row */
    .stats-row { display: flex; gap: var(--space-4); margin-bottom: var(--space-8); flex-wrap: wrap; }
    .stat-chip {
      display: flex; align-items: center; gap: var(--space-3);
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);
      flex: 1; min-width: 200px; transition: box-shadow var(--duration-base) var(--ease-out);
    }
    .stat-chip:hover { box-shadow: var(--shadow-card-hover); }
    .stat-chip-icon {
      width: 40px; height: 40px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stat-chip-icon mat-icon { color: var(--gray-0); font-size: 20px; width: 20px; height: 20px; }
    .stat-chip-info { display: flex; flex-direction: column; }
    .stat-chip-value { font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--gray-900); line-height: 1.2; }
    .stat-chip-label { font-size: var(--text-xs); color: var(--gray-500); margin-top: 2px; }

    /* Section Header */
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
    .section-header-left { display: flex; align-items: center; gap: var(--space-3); }
    .section-icon { color: var(--brand-accent); font-size: 28px; width: 28px; height: 28px; }
    .section-header h2 { margin: 0; font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--gray-900); }

    /* Filters Bar */
    .filters-bar {
      display: flex; gap: var(--space-3); align-items: flex-start; flex-wrap: wrap;
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5) var(--space-1);
      margin-bottom: var(--space-5);
    }
    .filter-field { flex: 1; min-width: 150px; max-width: 200px; }
    .filter-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    .clear-btn {
      margin-top: 4px; height: 40px;
      border-color: var(--gray-200) !important; color: var(--gray-500) !important; font-size: var(--text-sm);
    }
    .clear-btn mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }

    /* Loading */
    .loading-state {
      display: flex; align-items: center; gap: var(--space-3); justify-content: center;
      padding: var(--space-14) 0; color: var(--gray-500); font-size: var(--text-base);
    }

    /* KPI Row */
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); }
    .kpi-box {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); overflow: hidden;
      transition: box-shadow var(--duration-base) var(--ease-out);
    }
    .kpi-box:hover { box-shadow: var(--shadow-card-hover); }
    .kpi-box-inner { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-5) var(--space-6); }
    .kpi-icon-wrap {
      width: 48px; height: 48px; border-radius: var(--radius-lg);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kpi-icon-wrap mat-icon { color: var(--gray-0); font-size: 24px; width: 24px; height: 24px; }
    .bg-blue { background: var(--info); }
    .bg-green { background: var(--success); }
    .bg-orange { background: var(--warning); }
    .kpi-data { display: flex; flex-direction: column; min-width: 0; }
    .kpi-label { font-size: var(--text-xs); color: var(--gray-500); font-weight: var(--weight-medium); text-transform: uppercase; letter-spacing: var(--tracking-wider); }
    .kpi-amount { font-size: var(--text-kpi-sm); font-weight: var(--weight-bold); color: var(--gray-900); line-height: 1.3; word-break: break-word; }
    .kpi-meta { font-size: var(--text-xs); color: var(--gray-500); margin-top: 2px; }

    /* Period Cards */
    .period-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); }
    .period-card {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6);
      display: flex; flex-direction: column;
      transition: box-shadow var(--duration-base) var(--ease-out);
    }
    .period-card:hover { box-shadow: var(--shadow-card-hover); }
    .period-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
    .period-label {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--gray-600);
    }
    .period-label mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--gray-400); }
    .period-badge {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      padding: 3px 10px; border-radius: var(--radius-full);
    }
    .period-badge mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    .up { background: var(--success-light); color: var(--success-dark); }
    .down { background: var(--danger-light); color: var(--danger-dark); }
    .neutral { background: var(--gray-100); color: var(--gray-600); }
    .period-amount { font-size: var(--text-kpi-sm); font-weight: var(--weight-bold); color: var(--gray-900); line-height: 1.2; }
    .period-meta { font-size: var(--text-xs); color: var(--gray-500); margin-top: var(--space-2); }

    /* Charts Layout */
    .charts-layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); }
    .chart-panel {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6);
    }
    .chart-full { grid-column: 1 / -1; }
    .chart-title { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--gray-900); margin-bottom: var(--space-4); }
    .chart-subtitle { font-weight: var(--weight-regular); color: var(--gray-500); font-size: var(--text-sm); }

    /* Breakdown Table */
    .table-panel {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); overflow: hidden; margin-bottom: var(--space-8);
    }
    .table-header {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-4) var(--space-6); border-bottom: var(--border-subtle);
      font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--gray-900);
    }
    .table-header mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--gray-400); }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: var(--gray-50); }
    th {
      padding: var(--space-3) var(--space-6); font-size: var(--text-xs); font-weight: var(--weight-semibold);
      color: var(--gray-500); text-transform: uppercase; letter-spacing: var(--tracking-wider);
      text-align: left; border-bottom: var(--border-subtle);
    }
    td {
      padding: var(--space-3) var(--space-6); font-size: var(--text-base);
      color: var(--gray-700); border-bottom: 1px solid var(--gray-100);
    }
    tbody tr:hover { background: var(--gray-50); }
    tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .fw-600 { font-weight: var(--weight-semibold); }
    .country-name { display: flex; align-items: center; gap: var(--space-3); font-weight: var(--weight-medium); }
    .dot { width: 10px; height: 10px; border-radius: var(--radius-full); flex-shrink: 0; }
    .pct-bar-wrap { display: flex; align-items: center; gap: var(--space-2); justify-content: flex-end; }
    .pct-bar { height: 6px; border-radius: 3px; min-width: 4px; max-width: 80px; opacity: 0.7; }
    .pct-bar-wrap span { font-size: var(--text-sm); min-width: 40px; text-align: right; }

    /* Responsive */
    @media (max-width: 1024px) {
      .kpi-row, .period-row { grid-template-columns: 1fr; }
      .charts-layout { grid-template-columns: 1fr; }
      .chart-full { grid-column: auto; }
    }
    @media (max-width: 768px) {
      .stats-row { flex-direction: column; }
      .filters-bar { flex-direction: column; padding: var(--space-3) var(--space-4) var(--space-1); }
      .filter-field { max-width: 100%; }
      th, td { padding: var(--space-3) var(--space-4); }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats: { label: string; value: number; icon: string; bg: string }[] = [];

  // Filters
  filterCountry = '';
  filterDateFrom: Date | null = null;
  filterDateTo: Date | null = null;
  filterAccount = '';
  filterPaymentProfile = '';
  paymentProfiles: string[] = [];

  countryOptions = [
    { value: 'COLOMBIA', label: 'Colombia' },
    { value: 'CHILE', label: 'Chile' },
    { value: 'PERU', label: 'Perú' },
    { value: 'MEXICO', label: 'México' },
    { value: 'PANAMA', label: 'Panamá' },
    { value: 'ECUADOR', label: 'Ecuador' },
    { value: 'COSTA RICA', label: 'Costa Rica' },
  ];

  loadingRecharges = false;
  rechargesData: any = null;

  // Charts
  lineChartData: ChartConfiguration<'line'>['data'] | null = null;
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: 'rgba(20,20,20,0.9)',
        cornerRadius: 8,
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        position: 'left',
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
            return String(value);
          },
        },
        title: { display: true, text: 'Monto (COP)', font: { size: 11 }, color: '#888' },
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Cantidad', font: { size: 11 }, color: '#888' },
      },
      x: { grid: { display: false } },
    },
  };

  barChartData: ChartConfiguration<'bar'>['data'] | null = null;
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12 },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            return String(value);
          },
        },
      },
      y: { grid: { display: false } },
    },
  };

  pieChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    cutout: '55%',
    plugins: {
      legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } },
      tooltip: { backgroundColor: 'rgba(20,20,20,0.9)', cornerRadius: 8, padding: 12 },
    },
  };

  private countryColors: Record<string, string> = {
    'Colombia': '#3B82F6',
    'Perú': '#10B981',
    'Chile': '#F59E0B',
    'Ecuador': '#8B5CF6',
    'Panamá': '#EF4444',
    'México': '#06B6D4',
    'Costa Rica': '#F97316',
    'Otros': '#9CA3AF',
  };

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.adminService.getStats().subscribe(res => {
      this.stats = [
        { label: 'Usuarios Activos', value: res.data.totalUsers, icon: 'people', bg: '#3B82F6' },
        { label: 'Campañas Activas', value: res.data.totalCampaigns, icon: 'campaign', bg: '#10B981' },
        { label: 'Total Entradas', value: res.data.totalEntries, icon: 'edit_note', bg: '#F59E0B' },
        { label: 'Países', value: res.data.totalCountries, icon: 'public', bg: '#8B5CF6' },
      ];
      this.cdr.markForCheck();
    });
    this.loadRechargesDashboard();
  }

  loadRechargesDashboard(): void {
    this.loadingRecharges = true;
    this.cdr.markForCheck();

    const filters: any = {};
    if (this.filterCountry) filters.country = this.filterCountry;
    if (this.filterDateFrom) filters.dateFrom = this.formatDate(this.filterDateFrom);
    if (this.filterDateTo) filters.dateTo = this.formatDate(this.filterDateTo);
    if (this.filterAccount) filters.account = this.filterAccount;
    if (this.filterPaymentProfile) filters.paymentProfile = this.filterPaymentProfile;

    this.adminService.getRechargesDashboard(filters).subscribe({
      next: (res) => {
        this.rechargesData = res.data;
        this.paymentProfiles = res.data.filters?.paymentProfiles || [];
        this.buildCharts(res.data);
        this.loadingRecharges = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingRecharges = false;
        this.cdr.markForCheck();
      },
    });
  }

  clearFilters(): void {
    this.filterCountry = '';
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.filterAccount = '';
    this.filterPaymentProfile = '';
    this.loadRechargesDashboard();
  }

  private buildCharts(data: any): void {
    const dailyTrend = data.dailyTrend || [];
    this.lineChartData = {
      labels: dailyTrend.map((d: any) => {
        const date = new Date(d.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }),
      datasets: [
        {
          label: 'Monto Recargado',
          data: dailyTrend.map((d: any) => d.total),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#3B82F6',
          borderWidth: 2,
        },
        {
          label: 'Cantidad',
          data: dailyTrend.map((d: any) => d.count),
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#10B981',
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y1',
        },
      ],
    };

    const byCountry = data.byCountry || [];
    const colors = byCountry.map((c: any) => this.getCountryColor(c.country));
    this.barChartData = {
      labels: byCountry.map((c: any) => c.country),
      datasets: [{
        label: 'Total Recargado',
        data: byCountry.map((c: any) => c.total),
        backgroundColor: colors.map((c: string) => c + 'DD'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      }],
    };

    this.pieChartData = {
      labels: byCountry.map((c: any) => c.country),
      datasets: [{
        data: byCountry.map((c: any) => c.total),
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }

  formatCurrency(value: number): string {
    return '$' + Math.round(value).toLocaleString('es-CO');
  }

  formatChange(change: number): string {
    const abs = Math.abs(change);
    if (abs >= 1000) return (abs / 1000).toFixed(1) + 'K%';
    return abs.toFixed(1) + '%';
  }

  getChangeType(change: number): string {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'neutral';
  }

  getChangeIcon(change: number): string {
    if (change > 0) return 'trending_up';
    if (change < 0) return 'trending_down';
    return 'trending_flat';
  }

  getCountryColor(country: string): string {
    return this.countryColors[country] || '#78909c';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
