import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { API_URLS } from '../../../core/constants/api-urls';

interface KpiData {
  total_cierres: number;
  total_amount: number;
  pending_vouchers: number;
  approved_vouchers: number;
  rejected_vouchers: number;
}

@Component({
  selector: 'app-contabilidad-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './contabilidad-dashboard.component.html',
  styleUrl: './contabilidad-dashboard.component.scss',
})
export class ContabilidadDashboardComponent implements OnInit {
  kpis: KpiData | null = null;
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>(API_URLS.contabilidad.kpis).subscribe({
      next: res => { this.kpis = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
