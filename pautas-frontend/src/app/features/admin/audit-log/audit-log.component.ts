import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../admin.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-audit-log',
  imports: [
    CommonModule, FormsModule, IconComponent, PaginationComponent,
  ],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent implements OnInit {
  rows: any[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 25;

  filterAction = '';
  filterUsername = '';
  filterDateFrom: string = '';
  filterDateTo: string = '';

  actionOptions = [
    'LOGIN', 'PASSWORD_CHANGED',
    'USER_CREATED', 'USER_UPDATED', 'USER_TOGGLED', 'USER_DELETED',
    'COUNTRY_CREATED', 'COUNTRY_UPDATED',
    'CAMPAIGN_CREATED', 'CAMPAIGN_UPDATED',
    'ENTRY_CREATED', 'CAMPAIGN_ROTATED',
  ];

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const params: any = { page: this.page, limit: this.pageSize };
    if (this.filterAction) params.action = this.filterAction;
    if (this.filterUsername) params.username = this.filterUsername;
    if (this.filterDateFrom) params.date_from = this.filterDateFrom;
    if (this.filterDateTo) params.date_to = this.filterDateTo;

    this.adminService.getAuditLog(params).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.totalItems = res.meta?.total || 0;
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges(),
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadData();
  }

  clearFilters(): void {
    this.filterAction = '';
    this.filterUsername = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.page = 1;
    this.loadData();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.page = event.page;
    this.pageSize = event.pageSize;
    this.loadData();
  }
}
