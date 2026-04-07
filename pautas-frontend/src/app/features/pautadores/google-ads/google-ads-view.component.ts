import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { GoogleAdsService } from './google-ads.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-google-ads-view',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule,
    GoogleAdsIdPipe, IconComponent, PaginationComponent,
  ],
  templateUrl: './google-ads-view.component.html',
  styleUrl: './google-ads-view.component.scss',
})
export class GoogleAdsViewComponent implements OnInit {
  // Tab 1: Cuentas
  countries: any[] = [];
  allAccounts: any[] = [];
  filteredAccounts: any[] = [];
  accountsCountryId = 0;
  accountSearch = '';
  totalAccountCampaigns = 0;
  accountsLoaded = false;
  hasAccountData = false;
  expandedAccounts = new Set<string>();

  // Tab 2: Recargas
  recharges: any[] = [];
  totalRecharges = 0;
  rechargesPage = 1;
  rechargesDateFrom = '';
  rechargesDateTo = '';
  rechargesAccount = '';

  syncing = false;
  isAdmin = false;
  activeTab = 0;

  // Multi-account filtering
  myAccountIds: string[] = [];
  showOnlyMine = true;
  isPautador = false;

  innerCampaignColumns = [
    'name', 'country_code', 'ads_status',
    'daily_budget', 'cost', 'remaining_budget', 'conversions', 'clicks',
  ];
  rechargesColumns = [
    'payments_profile_name', 'customer_account_id', 'customer_account_name',
    'recharge_date', 'recharge_time', 'recharge_amount',
    'total_daily_budget', 'total_remaining', 'proposal_type',
  ];

  constructor(
    private googleAdsService: GoogleAdsService,
    private countryService: CountryService,
    private authService: AuthService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.userRole() === 'admin';
    this.isPautador = this.authService.userRole() === 'pautador';
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });
    if (this.isPautador) {
      this.googleAdsService.getMyAccounts().subscribe(res => {
        this.myAccountIds = res.data;
        this.loadAccounts();
        this.cdr.detectChanges();
      });
    } else {
      this.showOnlyMine = false;
      this.loadAccounts();
    }
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    if (index === 1 && this.recharges.length === 0) this.loadRecharges();
  }

  // ===== Tab 1: Cuentas =====
  loadAccounts(): void {
    this.accountsLoaded = false;
    this.cdr.detectChanges();
    const countryId = this.accountsCountryId || undefined;
    const accountIds = (this.isPautador && this.showOnlyMine && this.myAccountIds.length > 0) ? this.myAccountIds : undefined;
    this.googleAdsService.getCampaignsByAccount(countryId, accountIds).subscribe(res => {
      this.allAccounts = res.data;
      this.hasAccountData = res.data.some((a: any) => a.customer_account_id);
      this.filterAccounts();
      this.accountsLoaded = true;
      this.cdr.detectChanges();
    });
  }

  filterAccounts(): void {
    const search = this.accountSearch.toLowerCase().trim();
    if (!search) {
      this.filteredAccounts = [...this.allAccounts];
    } else {
      this.filteredAccounts = this.allAccounts.filter(a =>
        (a.customer_account_name || '').toLowerCase().includes(search) ||
        (a.customer_account_id || '').includes(search) ||
        a.campaigns.some((c: any) => (c.name || '').toLowerCase().includes(search))
      );
    }
    this.totalAccountCampaigns = this.filteredAccounts.reduce((sum: number, a: any) => sum + a.campaigns_count, 0);
    this.cdr.detectChanges();
  }

  toggleAccount(accountId: string): void {
    if (this.expandedAccounts.has(accountId)) {
      this.expandedAccounts.delete(accountId);
    } else {
      this.expandedAccounts.add(accountId);
    }
    this.cdr.detectChanges();
  }

  toggleShowMine(): void {
    this.showOnlyMine = !this.showOnlyMine;
    this.allAccounts = [];
    this.loadAccounts();
    if (this.recharges.length > 0) this.loadRecharges();
  }

  // ===== Tab 2: Recargas =====
  loadRecharges(): void {
    const accountIds = (this.isPautador && this.showOnlyMine && this.myAccountIds.length > 0) ? this.myAccountIds : undefined;
    this.googleAdsService.getRecharges(this.rechargesPage, 50, this.getRechargesFilters(), accountIds).subscribe(res => {
      this.recharges = res.data;
      this.totalRecharges = (res as any).meta?.total || 0;
      this.cdr.detectChanges();
    });
  }

  private getRechargesFilters(): any {
    const f: any = {};
    if (this.rechargesDateFrom) f.dateFrom = this.rechargesDateFrom;
    if (this.rechargesDateTo) f.dateTo = this.rechargesDateTo;
    if (this.rechargesAccount) f.account = this.rechargesAccount;
    return f;
  }

  applyRechargesFilter(): void {
    this.rechargesPage = 1;
    this.loadRecharges();
  }

  clearRechargesFilters(): void {
    this.rechargesDateFrom = '';
    this.rechargesDateTo = '';
    this.rechargesAccount = '';
    this.rechargesPage = 1;
    this.loadRecharges();
  }

  exportCsv(): void {
    this.googleAdsService.exportRechargesCsv(this.getRechargesFilters());
  }

  onRechargesPageChange(event: { page: number; pageSize: number }): void {
    this.rechargesPage = event.page;
    this.loadRecharges();
  }

  // ===== Sync =====
  syncNow(): void {
    this.syncing = true;
    this.cdr.detectChanges();
    this.googleAdsService.triggerSync().subscribe({
      next: () => {
        this.syncing = false;
        this.notification.success('Sincronizaci\u00f3n completada');
        this.allAccounts = [];
        this.loadAccounts();
        if (this.activeTab === 1) this.loadRecharges();
        this.cdr.detectChanges();
      },
      error: () => {
        this.syncing = false;
        this.notification.error('Error en la sincronizaci\u00f3n');
        this.cdr.detectChanges();
      },
    });
  }

  // ===== Helpers =====
  formatMoney(value: number | null): string {
    if (value == null) return '\u2014';
    return '$' + Math.round(value).toLocaleString('es-CO');
  }

  getStatusClass(status: string): string {
    if (!status) return 'badge badge-gray';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'badge badge-green';
    if (s === 'PAUSED') return 'badge badge-yellow';
    if (s === 'REMOVED') return 'badge badge-red';
    return 'badge badge-gray';
  }

  translateStatus(status: string): string {
    if (!status) return 'N/A';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'Activa';
    if (s === 'PAUSED') return 'Pausada';
    if (s === 'REMOVED') return 'Eliminada';
    return status;
  }

  getProposalTypeLabel(type: number): string {
    const labels: Record<number, string> = { 2: 'Inicial', 3: 'Recarga', 4: 'Cierre' };
    return labels[type] || 'Tipo ' + type;
  }

  getProposalTypeClass(type: number): string {
    if (type === 2) return 'badge badge-blue';
    if (type === 3) return 'badge badge-green';
    if (type === 4) return 'badge badge-red';
    return 'badge badge-gray';
  }
}
