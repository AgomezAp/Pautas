import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-consolidated-view',
  imports: [
    CommonModule, FormsModule, IconComponent, PaginationComponent,
  ],
  templateUrl: './consolidated-view.component.html',
  styleUrl: './consolidated-view.component.scss',
})
export class ConsolidatedViewComponent implements OnInit {
  displayedColumns = [
    'entry_date', 'user_name', 'country_name', 'account_name',
    'clientes', 'clientes_efectivos', 'conversions', 'ads_status', 'remaining_budget',
  ];

  allData: any[] = [];
  filteredData: any[] = [];
  pagedData: any[] = [];
  countries: any[] = [];
  filters: any = { country_id: null, date_from: '', date_to: '' };
  loading = true;

  pageSize = 10;
  currentPage = 1;
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

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
    this.loading = true;
    this.pautadoresService.getConsolidated(this.filters).subscribe(res => {
      this.allData = res.data;
      this.currentPage = 1;
      this.applySortAndPage();
      this.loading = false;
    });
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySortAndPage();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.currentPage = event.page;
    this.pageSize = event.pageSize;
    this.updatePagedData();
  }

  private applySortAndPage(): void {
    let data = [...this.allData];
    if (this.sortColumn) {
      data.sort((a, b) => {
        const aVal = a[this.sortColumn] ?? '';
        const bVal = b[this.sortColumn] ?? '';
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return this.sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    this.filteredData = data;
    this.updatePagedData();
  }

  private updatePagedData(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedData = this.filteredData.slice(start, start + this.pageSize);
  }

  translateStatus(status: string): string {
    if (!status) return '\u2014';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'Activa';
    if (s === 'PAUSED') return 'Pausada';
    if (s === 'REMOVED') return 'Eliminada';
    return status;
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'status-badge';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'status-badge status-badge--active';
    if (s === 'PAUSED') return 'status-badge status-badge--paused';
    return 'status-badge status-badge--warning';
  }
}
