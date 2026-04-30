import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URLS } from '../../../core/constants/api-urls';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface CampaignReport {
  id: number;
  campaign_name: string;
  country_name: string;
  pautador_name: string;
  description: string;
  sent_at: string;
}

@Component({
  selector: 'app-gestion-campaign-reports',
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-reports.component.html',
  styleUrl: './campaign-reports.component.scss',
})
export class GestionCampaignReportsComponent implements OnInit {
  reports: CampaignReport[] = [];
  loading = false;

  filterCampaign = '';
  filterDateFrom = '';
  filterDateTo = '';

  page = 1;
  totalPages = 1;
  pageSize = 20;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    let params = new HttpParams().set('page', this.page).set('limit', this.pageSize);
    if (this.filterCampaign) params = params.set('campaignSearch', this.filterCampaign);
    if (this.filterDateFrom) params = params.set('dateFrom', this.filterDateFrom);
    if (this.filterDateTo) params = params.set('dateTo', this.filterDateTo);

    this.http.get<any>(API_URLS.campaignReports.list, { params }).subscribe({
      next: res => {
        this.reports = res.data || [];
        this.totalPages = res.meta?.totalPages ?? 1;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadReports();
  }

  clearFilters(): void {
    this.filterCampaign = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.page = 1;
    this.loadReports();
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.loadReports(); }
  }

  nextPage(): void {
    if (this.page < this.totalPages) { this.page++; this.loadReports(); }
  }
}
