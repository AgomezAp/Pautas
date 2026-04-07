import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';
import { CountryService } from '../../../core/services/country.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

interface ConglomeradoEntry {
  id: number;
  entry_date: string;
  clientes: number;
  clientes_efectivos: number;
  menores: number;
  soporte_image_path: string | null;
  created_at: string;
  user_id: number;
  full_name: string;
  username: string;
  google_ads_account_id: string | null;
  country_name: string;
  country_code: string;
  campaign_name: string | null;
}

@Component({
  selector: 'app-conglomerado-entries',
  imports: [
    CommonModule,
    FormsModule,
    GoogleAdsIdPipe,
    IconComponent,
    PaginationComponent,
  ],
  templateUrl: './conglomerado-entries.component.html',
  styleUrl: './conglomerado-entries.component.scss',
})
export class ConglomeradoEntriesComponent implements OnInit {
  entries: ConglomeradoEntry[] = [];
  countries: Country[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 25;
  loading = false;

  countryId: number | null = null;
  dateFrom: string = '';
  dateTo: string = '';
  search = '';

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading = true;
    const params: any = { page: this.page, limit: this.pageSize };
    if (this.countryId) params.country_id = this.countryId;
    if (this.dateFrom) params.date_from = this.dateFrom;
    if (this.dateTo) params.date_to = this.dateTo;
    if (this.search) params.search = this.search;

    this.http.get<ApiResponse<ConglomeradoEntry[]>>(
      API_URLS.admin.conglomeradoEntries, { params }
    ).subscribe({
      next: (res) => {
        this.entries = res.data;
        this.totalItems = res.meta?.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadEntries();
  }

  clearFilters(): void {
    this.countryId = null;
    this.dateFrom = '';
    this.dateTo = '';
    this.search = '';
    this.page = 1;
    this.loadEntries();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page = event.page;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }
}
