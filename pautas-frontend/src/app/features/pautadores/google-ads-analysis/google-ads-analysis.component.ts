import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { GoogleAdsAnalysisService } from './google-ads-analysis.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

@Component({
  selector: 'app-google-ads-analysis',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule,
    BaseChartDirective, IconComponent,
  ],
  templateUrl: './google-ads-analysis.component.html',
  styleUrl: './google-ads-analysis.component.scss',
})
export class GoogleAdsAnalysisComponent implements OnInit {
  countries: Country[] = [];
  filterDateFrom = '';
  filterDateTo = '';
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
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        bodySpacing: 6,
        usePointStyle: true,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            return items[0].label || '';
          },
          label: (ctx) => {
            const val = Number(ctx.parsed.y) || 0;
            const label = ctx.dataset.label || '';
            const formatted = val >= 1_000_000
              ? `$${(val / 1_000_000).toFixed(2)}M`
              : `$${val.toLocaleString('es-CO')}`;
            return ` ${label}: ${formatted}`;
          },
          afterBody: (items) => {
            if (!items.length || !this.spendingTrendData.length) return '';
            const idx = items[0].dataIndex;
            const row = this.spendingTrendData[idx];
            if (!row) return '';
            const lines: string[] = [];
            if (row.campaigns_count != null) {
              lines.push(`  Campanas activas: ${row.campaigns_count}`);
            }
            const cost = Number(row.total_cost) || 0;
            const budget = Number(row.total_budget) || 0;
            if (budget > 0) {
              const pct = ((cost / budget) * 100).toFixed(1);
              lines.push(`  Ejecucion: ${pct}%`);
            }
            return lines;
          },
        },
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
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          title: (items) => items.length ? String(items[0].label) : '',
          label: (ctx) => {
            const val = Number(ctx.parsed.x) || 0;
            return ` CPC: $${val.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          },
          afterLabel: (ctx) => {
            const row = this.performanceData
              .sort((a: any, b: any) => Number(b.cpc) - Number(a.cpc))[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.total_cost != null) lines.push(` Costo total: $${Number(row.total_cost).toLocaleString('es-CO')}`);
            if (row.total_clicks != null) lines.push(` Clicks: ${Number(row.total_clicks).toLocaleString('es-CO')}`);
            if (row.total_impressions != null) lines.push(` Impresiones: ${Number(row.total_impressions).toLocaleString('es-CO')}`);
            if (row.ctr != null) lines.push(` CTR: ${row.ctr}%`);
            return lines;
          },
        },
      },
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
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          title: (items) => items.length ? String(items[0].label) : '',
          label: (ctx) => {
            const val = Number(ctx.parsed.x) || 0;
            const label = this.getMetricLabel();
            if (this.rankingMetric === 'spend') {
              return ` ${label}: $${val.toLocaleString('es-CO')}`;
            }
            return ` ${label}: ${val.toLocaleString('es-CO')}`;
          },
          afterLabel: (ctx) => {
            const row = this.rankingsData[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.total_cost != null) lines.push(` Costo: $${Number(row.total_cost).toLocaleString('es-CO')}`);
            if (row.total_clicks != null) lines.push(` Clicks: ${Number(row.total_clicks).toLocaleString('es-CO')}`);
            if (row.total_conversions != null) lines.push(` Conversiones: ${Number(row.total_conversions).toLocaleString('es-CO')}`);
            return lines;
          },
        },
      },
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
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.parsed) || 0;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + Number(b), 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            return ` Presupuesto: $${val.toLocaleString('es-CO')} (${pct}%)`;
          },
          afterLabel: (ctx) => {
            const row = this.budgetData[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.spent != null) lines.push(` Gastado: $${Number(row.spent).toLocaleString('es-CO')}`);
            if (row.execution_pct != null) lines.push(` Ejecucion: ${row.execution_pct}%`);
            if (row.accounts_count != null) lines.push(` Cuentas: ${row.accounts_count}`);
            return lines;
          },
        },
      },
    },
  };

  activeTab = 0;

  constructor(
    private analysisService: GoogleAdsAnalysisService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });

    // Fetch actual data range from DB to set smart defaults
    this.analysisService.getDataRange().subscribe({
      next: (res) => {
        const data = res.data;
        if (data?.min_date && data?.max_date) {
          this.filterDateFrom = data.min_date;
          this.filterDateTo = data.max_date;

          // Auto-select best granularity based on date range
          const fromDate = new Date(data.min_date);
          const toDate = new Date(data.max_date);
          const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000);
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
          this.filterDateFrom = this.formatDate(thirtyDaysAgo);
          this.filterDateTo = this.formatDate(today);
        }
        this.loadSpendingTrend();
        this.cdr.detectChanges();
      },
      error: () => {
        // Fallback: last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        this.filterDateFrom = this.formatDate(thirtyDaysAgo);
        this.filterDateTo = this.formatDate(today);
        this.loadSpendingTrend();
      },
    });
  }

  applyFilters(): void {
    // Invalidate cached data for all tabs so they reload with new filters
    this.spendingTrendData = [];
    this.lineChartData = null;
    this.performanceData = [];
    this.performanceBarData = null;
    this.rankingsData = [];
    this.rankingsBarData = null;
    this.budgetData = [];
    this.doughnutChartData = null;

    // Reload current tab
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
    this.filterDateFrom = this.formatDate(thirtyDaysAgo);
    this.filterDateTo = this.formatDate(today);
    this.filterCountryId = null;

    // Invalidate cached data for all tabs
    this.spendingTrendData = [];
    this.lineChartData = null;
    this.performanceData = [];
    this.performanceBarData = null;
    this.rankingsData = [];
    this.rankingsBarData = null;
    this.budgetData = [];
    this.doughnutChartData = null;

    // Reload current tab
    switch (this.activeTab) {
      case 0: this.loadSpendingTrend(); break;
      case 1: this.loadPerformance(); break;
      case 2: this.loadRankings(); break;
      case 3: this.loadBudgetDistribution(); break;
    }
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
    this.cdr.detectChanges();

    this.analysisService.getSpendingTrend({
      granularity: this.granularity,
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
    }).subscribe({
      next: (res) => {
        this.spendingTrendData = res.data || [];
        this.buildSpendingChart();
        this.loadingTrend = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingTrend = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildSpendingChart(): void {
    const data = this.spendingTrendData;
    if (!data.length) { this.lineChartData = null; return; }

    const pointRadius = data.length <= 10 ? 5 : 3;
    const pointHoverRadius = data.length <= 10 ? 7 : 5;

    const chartData: ChartConfiguration<'line'>['data'] = {
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

    // Defer to let Angular render the canvas before Chart.js initializes
    setTimeout(() => {
      this.lineChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 2: Performance ----

  loadPerformance(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingPerformance = true;
    this.cdr.detectChanges();

    this.analysisService.getPerformance({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
    }).subscribe({
      next: (res) => {
        this.performanceData = res.data || [];
        this.buildPerformanceChart();
        this.loadingPerformance = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingPerformance = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildPerformanceChart(): void {
    const sorted = [...this.performanceData]
      .sort((a, b) => Number(b.cpc) - Number(a.cpc))
      .slice(0, 10);
    if (!sorted.length) { this.performanceBarData = null; return; }

    const chartData: ChartConfiguration<'bar'>['data'] = {
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

    setTimeout(() => {
      this.performanceBarData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 3: Rankings ----

  loadRankings(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingRankings = true;
    this.cdr.detectChanges();

    this.analysisService.getRankings({
      metric: this.rankingMetric,
      sort: this.rankingSort,
      limit: 10,
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
    }).subscribe({
      next: (res) => {
        this.rankingsData = res.data || [];
        this.buildRankingsChart();
        this.loadingRankings = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRankings = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildRankingsChart(): void {
    if (!this.rankingsData.length) { this.rankingsBarData = null; return; }

    const chartData: ChartConfiguration<'bar'>['data'] = {
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

    setTimeout(() => {
      this.rankingsBarData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 4: Budget Distribution ----

  loadBudgetDistribution(): void {
    this.loadingBudget = true;
    this.cdr.detectChanges();

    this.analysisService.getBudgetDistribution(
      this.filterCountryId || undefined,
    ).subscribe({
      next: (res) => {
        this.budgetData = res.data || [];
        this.buildBudgetChart();
        this.loadingBudget = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingBudget = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildBudgetChart(): void {
    if (!this.budgetData.length) { this.doughnutChartData = null; return; }

    const chartData: ChartConfiguration<'doughnut'>['data'] = {
      labels: this.budgetData.map(d => d.country_name || 'Sin pais'),
      datasets: [{
        data: this.budgetData.map(d => Number(d.assigned_budget)),
        backgroundColor: this.budgetData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };

    setTimeout(() => {
      this.doughnutChartData = chartData;
      this.cdr.detectChanges();
    });
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
