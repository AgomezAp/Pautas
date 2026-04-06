import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { chartTokens, countryColors, barChartDefaults, lineChartDefaults, doughnutChartDefaults } from '../../../config/chart-theme';

@Component({
  selector: 'app-pautadores-dashboard',
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, FormsModule, BaseChartDirective,
  ],
  template: `
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">Dashboard</h1>
        <p class="page-header__subtitle">Resumen de actividad de pautadores</p>
      </div>
      <div class="page-header__actions">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>País</mat-label>
          <mat-select [(ngModel)]="selectedCountry" (selectionChange)="loadData()">
            <mat-option [value]="null">Todos</mat-option>
            @for (c of countries; track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      @if (kpis.length === 0) {
        @for (i of [1,2,3,4,5,6]; track i) {
          <div class="kpi">
            <div class="skeleton skeleton--icon"></div>
            <div class="kpi__body">
              <div class="skeleton skeleton--text-sm" style="margin-bottom:6px"></div>
              <div class="skeleton skeleton--kpi-value"></div>
            </div>
          </div>
        }
      } @else {
        @for (kpi of kpis; track kpi.label) {
          <div class="kpi">
            <div class="kpi__icon-wrap" [style.background]="kpi.bgColor">
              <mat-icon>{{ kpi.icon }}</mat-icon>
            </div>
            <div class="kpi__body">
              <span class="kpi__label">{{ kpi.label }}</span>
              <span class="kpi__value">{{ kpi.value }}</span>
            </div>
          </div>
        }
      }
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-panel chart-panel--wide">
        <h3 class="chart-panel__title">Clientes por Día</h3>
        <div class="chart-panel__canvas">
          @if (barChartData) {
            <canvas baseChart [data]="barChartData" [options]="barChartOptions" type="bar"></canvas>
          } @else {
            <div class="skeleton skeleton--chart"></div>
          }
        </div>
      </div>

      <div class="chart-panel">
        <h3 class="chart-panel__title">Tendencia Semanal</h3>
        <div class="chart-panel__canvas">
          @if (lineChartData) {
            <canvas baseChart [data]="lineChartData" [options]="lineChartOptions" type="line"></canvas>
          } @else {
            <div class="skeleton skeleton--chart"></div>
          }
        </div>
      </div>

      <div class="chart-panel">
        <h3 class="chart-panel__title">Distribución por País</h3>
        <div class="chart-panel__canvas chart-panel__canvas--donut">
          @if (pieChartData) {
            <canvas baseChart [data]="pieChartData" [options]="pieChartOptions" type="doughnut"></canvas>
          } @else {
            <div class="skeleton skeleton--chart"></div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .filter-field { width: 180px; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .kpi {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      transition: box-shadow var(--duration-base) var(--ease-out);
    }
    .kpi:hover {
      box-shadow: var(--shadow-card-hover);
    }
    .kpi__icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }
    .kpi__icon-wrap mat-icon {
      color: var(--gray-0);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .kpi__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .kpi__label {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--gray-500);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
    }
    .kpi__value {
      font-size: var(--text-kpi-sm);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
      letter-spacing: var(--tracking-tight);
      font-variant-numeric: tabular-nums;
    }

    /* Charts */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-4);
    }
    .chart-panel {
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
    }
    .chart-panel--wide {
      grid-column: 1 / -1;
    }
    .chart-panel__title {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--gray-900);
      margin: 0 0 var(--space-4);
    }
    .chart-panel__canvas {
      position: relative;
      height: 280px;
    }
    .chart-panel__canvas--donut {
      height: 260px;
    }

    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PautadoresDashboardComponent implements OnInit {
  countries: any[] = [];
  selectedCountry: number | null = null;
  kpis: { label: string; value: string; icon: string; bgColor: string }[] = [];

  barChartData: ChartConfiguration<'bar'>['data'] | null = null;
  barChartOptions: ChartConfiguration<'bar'>['options'] = barChartDefaults({ showLegend: true });
  lineChartData: ChartConfiguration<'line'>['data'] | null = null;
  lineChartOptions: ChartConfiguration<'line'>['options'] = lineChartDefaults();
  pieChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] = doughnutChartDefaults();

  constructor(
    private pautadoresService: PautadoresService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
    this.loadData();
  }

  loadData(): void {
    const params = this.selectedCountry ? { country_id: this.selectedCountry } : {};

    this.pautadoresService.getDashboardKpis(params).subscribe(res => {
      const d = res.data;
      this.kpis = [
        { label: 'Total Clientes', value: d.totalClientes?.toLocaleString() || '0', icon: 'people', bgColor: chartTokens.colombia },
        { label: 'Clientes Efectivos', value: d.totalClientesEfectivos?.toLocaleString() || '0', icon: 'verified', bgColor: chartTokens.success },
        { label: 'Tasa Efectividad', value: ((d.effectivenessRate || 0) * 100).toFixed(1) + '%', icon: 'trending_up', bgColor: chartTokens.warningDark },
        { label: 'Conversiones', value: d.totalConversions?.toLocaleString() || '0', icon: 'swap_horiz', bgColor: chartTokens.ecuador },
        { label: 'Tasa Conversión', value: ((d.conversionRate || 0) * 100).toFixed(1) + '%', icon: 'analytics', bgColor: chartTokens.dangerDark },
        { label: 'Campañas Activas', value: d.activeCampaigns?.toString() || '0', icon: 'campaign', bgColor: chartTokens.mexico },
      ];
      this.cdr.markForCheck();
    });

    this.pautadoresService.getDashboardCharts(params).subscribe(res => {
      const c = res.data;
      this.barChartData = {
        labels: c.barChart.labels,
        datasets: c.barChart.datasets.map((ds: any, i: number) => ({
          ...ds,
          backgroundColor: i === 0 ? chartTokens.colombia : chartTokens.success,
          borderRadius: 4,
        })),
      };
      this.lineChartData = {
        labels: c.lineChart.labels,
        datasets: c.lineChart.datasets.map((ds: any, i: number) => ({
          ...ds,
          borderColor: i === 0 ? chartTokens.colombia : chartTokens.success,
          backgroundColor: i === 0 ? chartTokens.colombia + '18' : chartTokens.success + '18',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
        })),
      };
      this.pieChartData = {
        labels: c.pieChart.labels,
        datasets: [{
          data: c.pieChart.datasets[0].data,
          backgroundColor: countryColors,
          borderWidth: 0,
        }],
      };
      this.cdr.markForCheck();
    });
  }
}
