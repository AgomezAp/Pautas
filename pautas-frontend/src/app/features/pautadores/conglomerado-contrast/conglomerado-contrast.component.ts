import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CountryService } from '../../../core/services/country.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface ContrastRow {
  full_name: string;
  member_name: string;
  google_ads_account_id: string | null;
  total_clientes: number;
  total_clientes_efectivos: number;
  total_menores: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_cost: number;
  total_budget: number;
}

@Component({
  selector: 'app-conglomerado-contrast',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule,
    GoogleAdsIdPipe, IconComponent,
  ],
  templateUrl: './conglomerado-contrast.component.html',
  styleUrl: './conglomerado-contrast.component.scss',
})
export class ConglomeradoContrastComponent implements OnInit {
  rows: ContrastRow[] = [];
  countries: Country[] = [];
  selectedCountryId = 0;
  dateFromStr = '';
  dateToStr = '';
  loading = false;

  displayedColumns = [
    'member_name', 'clientes', 'clientes_efectivos', 'menores',
    'clicks', 'impressions', 'conversions', 'cost', 'budget',
  ];

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private authService: AuthService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });

    // Default to today
    const today = new Date();
    const todayStr = this.fmtDate(today);
    this.dateFromStr = todayStr;
    this.dateToStr = todayStr;
    this.loadData();
  }

  loadData(): void {
    if (!this.dateFromStr || !this.dateToStr) return;

    this.loading = true;
    this.cdr.detectChanges();

    let params = new HttpParams()
      .set('date_from', this.dateFromStr)
      .set('date_to', this.dateToStr);

    if (this.selectedCountryId) {
      params = params.set('country_id', this.selectedCountryId);
    }

    this.http.get<ApiResponse<ContrastRow[]>>(API_URLS.pautadores.conglomeradoContrast, { params }).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notification.error('Error al cargar los datos de contraste');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  clearFilters(): void {
    const today = new Date();
    const todayStr = this.fmtDate(today);
    this.dateFromStr = todayStr;
    this.dateToStr = todayStr;
    this.selectedCountryId = 0;
    this.loadData();
  }

  formatMoney(value: number | null): string {
    if (value == null) return '\u2014';
    return '$' + Math.round(value).toLocaleString('es-CO');
  }

  private fmtDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
}
