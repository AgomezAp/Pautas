import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';

@Component({
  selector: 'app-consolidated-view',
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule,
  ],
  template: `
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">Vista Consolidada</h1>
        <p class="page-header__subtitle">Datos consolidados por usuario, cuenta y país</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <mat-form-field appearance="outline">
        <mat-label>País</mat-label>
        <mat-select [(ngModel)]="filters.country_id" (selectionChange)="loadData()">
          <mat-option [value]="null">Todos</mat-option>
          @for (c of countries; track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Desde</mat-label>
        <input matInput type="date" [(ngModel)]="filters.date_from" (change)="loadData()">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Hasta</mat-label>
        <input matInput type="date" [(ngModel)]="filters.date_to" (change)="loadData()">
      </mat-form-field>
    </div>

    <!-- Table -->
    <div class="table-panel">
      @if (loading) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="skeleton-table-row">
            @for (j of [1,2,3,4,5,6]; track j) {
              <div class="skeleton-table-row__cell">
                <div class="skeleton skeleton--text"></div>
              </div>
            }
          </div>
        }
      } @else {
        <table mat-table [dataSource]="dataSource" matSort>
        <ng-container matColumnDef="entry_date">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Fecha</th>
          <td mat-cell *matCellDef="let row">{{ row.entry_date | date:'dd/MM/yyyy' }}</td>
        </ng-container>
        <ng-container matColumnDef="user_name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Usuario</th>
          <td mat-cell *matCellDef="let row">{{ row.user_name }}</td>
        </ng-container>
        <ng-container matColumnDef="country_name">
          <th mat-header-cell *matHeaderCellDef>País</th>
          <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
        </ng-container>
        <ng-container matColumnDef="account_name">
          <th mat-header-cell *matHeaderCellDef>Cuenta</th>
          <td mat-cell *matCellDef="let row">{{ row.customer_account_name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="clientes">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Clientes</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.clientes }}</td>
        </ng-container>
        <ng-container matColumnDef="clientes_efectivos">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Efectivos</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.clientes_efectivos }}</td>
        </ng-container>
        <ng-container matColumnDef="conversions">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Conversiones</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.conversions || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="ads_status">
          <th mat-header-cell *matHeaderCellDef>Estado Ads</th>
          <td mat-cell *matCellDef="let row">
            <span [class]="getStatusBadgeClass(row.ads_status)">
              {{ translateStatus(row.ads_status) }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="remaining_budget">
          <th mat-header-cell *matHeaderCellDef>Presupuesto</th>
          <td mat-cell *matCellDef="let row" class="tabular-nums">{{ row.remaining_budget ? ('$' + row.remaining_budget) : '—' }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
      }
      <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .filters-bar {
      display: flex;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      flex-wrap: wrap;
    }
    .filters-bar mat-form-field { min-width: 160px; }

    .table-panel {
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    table { width: 100%; }
  `]
})
export class ConsolidatedViewComponent implements OnInit {
  displayedColumns = [
    'entry_date', 'user_name', 'country_name', 'account_name',
    'clientes', 'clientes_efectivos', 'conversions', 'ads_status', 'remaining_budget',
  ];
  dataSource = new MatTableDataSource<any>([]);
  countries: any[] = [];
  filters: any = { country_id: null, date_from: '', date_to: '' };
  loading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private pautadoresService: PautadoresService,
    private countryService: CountryService,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => this.countries = res.data);
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.pautadoresService.getConsolidated(this.filters).subscribe(res => {
      this.dataSource.data = res.data;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.loading = false;
    });
  }

  translateStatus(status: string): string {
    if (!status) return '—';
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
