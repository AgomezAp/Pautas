import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-alert-dashboard',
  imports: [
    CommonModule, FormsModule,
    BaseChartDirective, IconComponent, PaginationComponent,
  ],
  templateUrl: './alert-dashboard.component.html',
  styleUrl: './alert-dashboard.component.scss',
})
export class AlertDashboardComponent implements OnInit {
  summary: AlertSummary | null = null;
  alerts: Alert[] = [];
  topAlerted: TopAlertedUser[] = [];
  countries: any[] = [];
  loading = false;
  totalAlerts = 0;
  pageSize = 10;
  currentPage = 1;

  filters: AlertFilters = {};
  dateFrom = '';
  dateTo = '';

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
    private cdr: ChangeDetectorRef,
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
      next: (res:any) => {
        this.countries = res.data || [];
        this.cdr.detectChanges();
      },
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
      page: this.currentPage,
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
      next: (res) => {
        this.buildTrendChart(res.data || []);
        this.cdr.detectChanges();
      },
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
    this.currentPage = 1;
    this.loadAlerts();
  }

  onDateChange(): void {
    this.filters.date_from = this.dateFrom || undefined;
    this.filters.date_to = this.dateTo || undefined;
    this.currentPage = 1;
    this.loadAlerts();
  }

  clearFilters(): void {
    this.filters = {};
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
    this.loadAlerts();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.currentPage = event.page;
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
      CONVERSION_DROP: 'Conversion',
      ZERO_EFFECTIVE: 'Cero Efectivos',
      TRAFFIC_DROP: 'Trafico',
      HIGH_MINORS_RATIO: 'Menores',
      NO_REPORT: 'Sin Reporte',
      CONVERSION_SPIKE: 'Pico',
      RECORD_DAY: 'Record',
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
        { label: 'Criticas', data: getSeverityData('CRITICAL'), backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#ef4444', borderWidth: 1 },
        { label: 'Advertencias', data: getSeverityData('WARNING'), backgroundColor: 'rgba(245,158,11,0.4)', borderColor: '#f59e0b', borderWidth: 1 },
        { label: 'Info', data: getSeverityData('INFO'), backgroundColor: 'rgba(59,130,246,0.4)', borderColor: '#3b82f6', borderWidth: 1 },
      ],
    };
  }
}
