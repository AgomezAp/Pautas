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
