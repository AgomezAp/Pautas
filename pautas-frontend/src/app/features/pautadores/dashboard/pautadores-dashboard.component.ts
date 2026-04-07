import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { chartTokens, countryColors, barChartDefaults, lineChartDefaults, doughnutChartDefaults } from '../../../config/chart-theme';

@Component({
  selector: 'app-pautadores-dashboard',
  imports: [
    CommonModule, FormsModule, BaseChartDirective, IconComponent,
  ],
  templateUrl: './pautadores-dashboard.component.html',
  styleUrl: './pautadores-dashboard.component.scss',
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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
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
      this.cdr.detectChanges();
    });
  }
}
