import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-gestion-dashboard',
  imports: [
    CommonModule, FormsModule, IconComponent,
  ],
  templateUrl: './gestion-dashboard.component.html',
  styleUrl: './gestion-dashboard.component.scss',
})
export class GestionDashboardComponent implements OnInit {
  kpis: { label: string; value: string; icon: string }[] = [];
  activeTab = 0;

  // Por Pais
  countryReport: any[] = [];

  // Efectividad
  effectivenessReport: any[] = [];
  effectivenessCountryId: number | null = null;

  // Conversiones
  conversionReport: any[] = [];
  conversionsCountryId: number | null = null;

  // Tendencia Semanal
  weeklyReport: any[] = [];
  weeklyCountryId: number | null = null;

  countries: Country[] = [];

  constructor(
    private gestionService: GestionService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });

    this.gestionService.getDashboardKpis().subscribe(res => {
      const d = res.data;
      this.kpis = [
        { label: 'Total Clientes', value: d.total_clientes?.toLocaleString() || '0', icon: 'people' },
        { label: 'Clientes Efectivos', value: d.total_clientes_efectivos?.toLocaleString() || '0', icon: 'verified' },
        { label: 'Tasa Efectividad', value: ((d.effectiveness_rate || 0) * 100).toFixed(1) + '%', icon: 'trending_up' },
        { label: 'Usuarios Reportando', value: d.users_reporting?.toString() || '0', icon: 'group' },
      ];
      this.cdr.detectChanges();
    });

    this.gestionService.getByCountryReport().subscribe(res => {
      this.countryReport = res.data;
      this.cdr.detectChanges();
    });
  }

  onReportTabChange(index: number): void {
    if (index === 1 && this.effectivenessReport.length === 0) this.loadEffectiveness();
    if (index === 2 && this.conversionReport.length === 0) this.loadConversions();
    if (index === 3 && this.weeklyReport.length === 0) this.loadWeekly();
  }

  loadEffectiveness(): void {
    const params: any = {};
    if (this.effectivenessCountryId) params.country_id = this.effectivenessCountryId;
    this.gestionService.getEffectivenessReport(params).subscribe(res => {
      this.effectivenessReport = res.data;
      this.cdr.detectChanges();
    });
  }

  loadConversions(): void {
    const params: any = {};
    if (this.conversionsCountryId) params.country_id = this.conversionsCountryId;
    this.gestionService.getConversionReport(params).subscribe(res => {
      this.conversionReport = res.data;
      this.cdr.detectChanges();
    });
  }

  loadWeekly(): void {
    const params: any = {};
    if (this.weeklyCountryId) params.country_id = this.weeklyCountryId;
    this.gestionService.getByWeekReport(params).subscribe(res => {
      this.weeklyReport = res.data;
      this.cdr.detectChanges();
    });
  }
}
