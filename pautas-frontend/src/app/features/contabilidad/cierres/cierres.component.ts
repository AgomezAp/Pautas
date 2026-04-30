import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URLS } from '../../../core/constants/api-urls';

interface CierreEntry {
  id: number;
  entry_date: string;
  user_name: string;
  country_name: string;
  cierre: number;
  voucher_count: number;
  pending_vouchers: number;
}

interface Voucher {
  id: number;
  image_path: string;
  original_name: string;
  is_approved: boolean | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approval_comment: string | null;
}

@Component({
  selector: 'app-cierres',
  imports: [CommonModule, FormsModule],
  templateUrl: './cierres.component.html',
  styleUrl: './cierres.component.scss',
})
export class CierresComponent implements OnInit {
  entries: CierreEntry[] = [];
  loading = false;

  filterCountry = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterApproval: '' | 'pending' | 'approved' | 'rejected' = '';

  page = 1;
  totalPages = 1;
  pageSize = 25;

  // Voucher modal state
  selectedEntry: CierreEntry | null = null;
  vouchers: Voucher[] = [];
  loadingVouchers = false;
  reviewVoucherId: number | null = null;
  reviewApproved: boolean = true;
  reviewComment = '';
  reviewSubmitting = false;
  reviewError = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading = true;
    let params = new HttpParams().set('page', this.page).set('limit', this.pageSize);
    if (this.filterCountry) params = params.set('countryId', this.filterCountry);
    if (this.filterDateFrom) params = params.set('dateFrom', this.filterDateFrom);
    if (this.filterDateTo) params = params.set('dateTo', this.filterDateTo);
    if (this.filterApproval) params = params.set('approvalStatus', this.filterApproval);

    this.http.get<any>(API_URLS.contabilidad.cierres, { params }).subscribe({
      next: res => {
        this.entries = res.data || [];
        this.totalPages = res.meta?.totalPages ?? 1;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void { this.page = 1; this.loadEntries(); }

  clearFilters(): void {
    this.filterCountry = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterApproval = '';
    this.page = 1;
    this.loadEntries();
  }

  prevPage(): void { if (this.page > 1) { this.page--; this.loadEntries(); } }
  nextPage(): void { if (this.page < this.totalPages) { this.page++; this.loadEntries(); } }

  openVouchers(entry: CierreEntry): void {
    this.selectedEntry = entry;
    this.loadingVouchers = true;
    this.vouchers = [];
    this.reviewVoucherId = null;
    this.reviewComment = '';
    this.reviewError = '';

    this.http.get<any>(API_URLS.contabilidad.vouchers(entry.id)).subscribe({
      next: res => { this.vouchers = res.data || []; this.loadingVouchers = false; },
      error: () => { this.loadingVouchers = false; }
    });
  }

  closeModal(): void { this.selectedEntry = null; }

  startReview(voucherId: number, currentApproval: boolean | null): void {
    this.reviewVoucherId = voucherId;
    this.reviewApproved = currentApproval !== false; // default approve unless was rejected
    this.reviewComment = '';
    this.reviewError = '';
  }

  cancelReview(): void { this.reviewVoucherId = null; }

  submitReview(): void {
    if (!this.reviewVoucherId) return;
    this.reviewSubmitting = true;
    this.reviewError = '';

    this.http.patch<any>(API_URLS.contabilidad.reviewVoucher(this.reviewVoucherId), {
      isApproved: this.reviewApproved,
      comment: this.reviewComment || undefined,
    }).subscribe({
      next: res => {
        this.reviewSubmitting = false;
        // Update local voucher
        const idx = this.vouchers.findIndex(v => v.id === this.reviewVoucherId!);
        if (idx >= 0) {
          this.vouchers[idx].is_approved = this.reviewApproved;
          this.vouchers[idx].approval_comment = this.reviewComment || null;
        }
        this.reviewVoucherId = null;
        // Refresh the entry row pending count
        if (this.selectedEntry) {
          const entryIdx = this.entries.findIndex(e => e.id === this.selectedEntry!.id);
          if (entryIdx >= 0) {
            this.entries[entryIdx].pending_vouchers = this.vouchers.filter(v => v.is_approved === null).length;
          }
        }
      },
      error: err => {
        this.reviewSubmitting = false;
        this.reviewError = err?.error?.message || 'Error al guardar la revisión.';
      }
    });
  }

  voucherImageUrl(path: string): string {
    // The path is stored relative to uploads, backend serves at /uploads/:path
    return `/uploads/${path}`;
  }

  approvalLabel(v: Voucher): string {
    if (v.is_approved === null) return 'Pendiente';
    return v.is_approved ? 'Aprobado' : 'Rechazado';
  }

  approvalClass(v: Voucher): string {
    if (v.is_approved === null) return 'badge-pending';
    return v.is_approved ? 'badge-approved' : 'badge-rejected';
  }
}
