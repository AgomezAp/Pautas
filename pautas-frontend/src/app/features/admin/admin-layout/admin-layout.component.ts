import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AdminService } from '../admin.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-layout',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule, BaseChartDirective, IconComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  stats: { label: string; value: number; icon: string; bg: string }[] = [];

  // Filters
  filterCountry = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterAccount = '';
  filterPaymentProfile = '';
  paymentProfiles: string[] = [];

  countryOptions = [
    { value: 'COLOMBIA', label: 'Colombia' },
    { value: 'CHILE', label: 'Chile' },
    { value: 'PERU', label: 'Peru' },
    { value: 'MEXICO', label: 'Mexico' },
    { value: 'PANAMA', label: 'Panama' },
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
    'Peru': '#10B981',
    'Chile': '#F59E0B',
    'Ecuador': '#8B5CF6',
    'Panama': '#EF4444',
    'Mexico': '#06B6D4',
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
        { label: 'Campanas Activas', value: res.data.totalCampaigns, icon: 'campaign', bg: '#10B981' },
        { label: 'Total Entradas', value: res.data.totalEntries, icon: 'edit_note', bg: '#F59E0B' },
        { label: 'Paises', value: res.data.totalCountries, icon: 'public', bg: '#8B5CF6' },
      ];
      this.cdr.detectChanges();
    });
    this.loadRechargesDashboard();
  }

  loadRechargesDashboard(): void {
    this.loadingRecharges = true;
    this.cdr.detectChanges();

    const filters: any = {};
    if (this.filterCountry) filters.country = this.filterCountry;
    if (this.filterDateFrom) filters.dateFrom = this.filterDateFrom;
    if (this.filterDateTo) filters.dateTo = this.filterDateTo;
    if (this.filterAccount) filters.account = this.filterAccount;
    if (this.filterPaymentProfile) filters.paymentProfile = this.filterPaymentProfile;

    this.adminService.getRechargesDashboard(filters).subscribe({
      next: (res) => {
        this.rechargesData = res.data;
        this.paymentProfiles = res.data.filters?.paymentProfiles || [];
        this.buildCharts(res.data);
        this.loadingRecharges = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRecharges = false;
        this.cdr.detectChanges();
      },
    });
  }

  clearFilters(): void {
    this.filterCountry = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
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
}
