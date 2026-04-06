import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatPaginatorModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  template: `
    <h2>Registro de Auditoría</h2>

    <div class="filter-bar">
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Acción</mat-label>
        <mat-select [(ngModel)]="filterAction" (selectionChange)="applyFilters()">
          <mat-option [value]="''">Todas</mat-option>
          @for (action of actionOptions; track action) {
            <mat-option [value]="action">{{ action }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Usuario</mat-label>
        <input matInput [(ngModel)]="filterUsername" (keyup.enter)="applyFilters()" placeholder="Buscar usuario">
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Desde</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="filterDateFrom" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Hasta</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="filterDateTo" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <button mat-stroked-button (click)="clearFilters()" class="clear-btn">
        <mat-icon>clear</mat-icon> Limpiar
      </button>
    </div>

    <table mat-table [dataSource]="rows" class="full-width mat-elevation-z1">
      <ng-container matColumnDef="created_at">
        <th mat-header-cell *matHeaderCellDef>Fecha</th>
        <td mat-cell *matCellDef="let row">{{ row.created_at | date:'dd/MM/yyyy HH:mm' }}</td>
      </ng-container>
      <ng-container matColumnDef="username">
        <th mat-header-cell *matHeaderCellDef>Usuario</th>
        <td mat-cell *matCellDef="let row">{{ row.username || row.full_name || '—' }}</td>
      </ng-container>
      <ng-container matColumnDef="action">
        <th mat-header-cell *matHeaderCellDef>Acción</th>
        <td mat-cell *matCellDef="let row">
          <span class="action-badge">{{ row.action }}</span>
        </td>
      </ng-container>
      <ng-container matColumnDef="entity_type">
        <th mat-header-cell *matHeaderCellDef>Entidad</th>
        <td mat-cell *matCellDef="let row">{{ row.entity_type || '—' }}</td>
      </ng-container>
      <ng-container matColumnDef="entity_id">
        <th mat-header-cell *matHeaderCellDef>ID</th>
        <td mat-cell *matCellDef="let row">{{ row.entity_id || '—' }}</td>
      </ng-container>
      <ng-container matColumnDef="ip_address">
        <th mat-header-cell *matHeaderCellDef>IP</th>
        <td mat-cell *matCellDef="let row">{{ row.ip_address || '—' }}</td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
    </table>

    <mat-paginator
      [length]="totalItems"
      [pageSize]="pageSize"
      [pageSizeOptions]="[10, 25, 50]"
      [pageIndex]="page - 1"
      (page)="onPageChange($event)"
      showFirstLastButtons>
    </mat-paginator>
  `,
  styles: [`
    h2 { margin: 0 0 24px 0; color: var(--gray-900); position: relative; padding-bottom: var(--space-2); display: inline-block; }
    h2::after { content: ''; position: absolute; bottom: 0; left: 0; width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full); }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
      padding: 16px;
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-md);
    }
    .filter-field { flex: 0 0 180px; }
    .clear-btn { height: 40px; }
    .full-width { width: 100%; }
    .action-badge {
      display: inline-flex;
      padding: 2px 10px;
      border-radius: var(--radius-lg);
      font-size: 12px;
      font-weight: var(--weight-semibold);
      background: var(--brand-accent-subtle);
      color: var(--gray-900);
    }
  `]
})
export class AuditLogComponent implements OnInit {
  displayedColumns = ['created_at', 'username', 'action', 'entity_type', 'entity_id', 'ip_address'];
  rows: any[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 25;

  filterAction = '';
  filterUsername = '';
  filterDateFrom: Date | null = null;
  filterDateTo: Date | null = null;

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
    if (this.filterDateFrom) params.date_from = this.formatDate(this.filterDateFrom);
    if (this.filterDateTo) params.date_to = this.formatDate(this.filterDateTo);

    this.adminService.getAuditLog(params).subscribe({
      next: (res) => {
        this.rows = res.data;
        this.totalItems = res.meta?.total || 0;
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadData();
  }

  clearFilters(): void {
    this.filterAction = '';
    this.filterUsername = '';
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.page = 1;
    this.loadData();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
