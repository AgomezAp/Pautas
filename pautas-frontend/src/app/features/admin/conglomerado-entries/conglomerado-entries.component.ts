import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';
import { CountryService } from '../../../core/services/country.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';

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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatButtonModule,
    GoogleAdsIdPipe,
  ],
  template: `
    <div class="page-header">
      <h2>Entradas del Conglomerado</h2>
      <p class="subtitle">Vista administrativa de todas las entradas diarias del conglomerado</p>
    </div>

    <div class="filter-bar">
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>País</mat-label>
        <mat-select [(ngModel)]="countryId" (selectionChange)="applyFilters()">
          <mat-option [value]="null">Todos</mat-option>
          @for (country of countries; track country.id) {
            <mat-option [value]="country.id">{{ country.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Desde</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="dateFrom" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Hasta</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="dateTo" (dateChange)="applyFilters()">
        <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="filter-field search-field">
        <mat-label>Buscar por nombre</mat-label>
        <input matInput [(ngModel)]="search" (keyup.enter)="applyFilters()" placeholder="Nombre o usuario">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <button mat-stroked-button (click)="clearFilters()" class="clear-btn">
        <mat-icon>clear</mat-icon>
        Limpiar
      </button>
    </div>

    <div class="table-container mat-elevation-z1">
      <table mat-table [dataSource]="entries" class="full-width">
        <ng-container matColumnDef="entry_date">
          <th mat-header-cell *matHeaderCellDef>Fecha</th>
          <td mat-cell *matCellDef="let row">{{ row.entry_date | date:'dd/MM/yyyy' }}</td>
        </ng-container>

        <ng-container matColumnDef="full_name">
          <th mat-header-cell *matHeaderCellDef>Usuario</th>
          <td mat-cell *matCellDef="let row">
            <div class="user-cell">
              <span class="user-name">{{ row.full_name }}</span>
              <span class="user-username">{{ row.username }}</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="country_name">
          <th mat-header-cell *matHeaderCellDef>País</th>
          <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
        </ng-container>

        <ng-container matColumnDef="campaign_name">
          <th mat-header-cell *matHeaderCellDef>Campaña</th>
          <td mat-cell *matCellDef="let row">{{ row.campaign_name || '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="clientes">
          <th mat-header-cell *matHeaderCellDef>Clientes</th>
          <td mat-cell *matCellDef="let row">{{ row.clientes }}</td>
        </ng-container>

        <ng-container matColumnDef="clientes_efectivos">
          <th mat-header-cell *matHeaderCellDef>Clientes Efectivos</th>
          <td mat-cell *matCellDef="let row">{{ row.clientes_efectivos }}</td>
        </ng-container>

        <ng-container matColumnDef="menores">
          <th mat-header-cell *matHeaderCellDef>Menores</th>
          <td mat-cell *matCellDef="let row">{{ row.menores }}</td>
        </ng-container>

        <ng-container matColumnDef="google_ads_account_id">
          <th mat-header-cell *matHeaderCellDef>Google Ads ID</th>
          <td mat-cell *matCellDef="let row">{{ row.google_ads_account_id | googleAdsId }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      @if (entries.length === 0 && !loading) {
        <div class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>No se encontraron entradas</p>
        </div>
      }

      <mat-paginator
        [length]="totalItems"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 25, 50]"
        [pageIndex]="page - 1"
        (page)="onPageChange($event)"
        showFirstLastButtons>
      </mat-paginator>
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h2 {
      margin: 0 0 4px 0;
      color: var(--gray-900);
      position: relative;
      padding-bottom: var(--space-2);
      display: inline-block;
    }
    .page-header h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 40px;
      height: 3px;
      background: var(--brand-accent);
      border-radius: var(--radius-full);
    }
    .subtitle {
      margin: 8px 0 0 0;
      color: var(--gray-500);
      font-size: 14px;
    }
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
    .filter-field {
      flex: 0 0 180px;
    }
    .search-field {
      flex: 1 1 200px;
    }
    .clear-btn {
      height: 40px;
    }
    .table-container {
      background: var(--gray-0);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .full-width {
      width: 100%;
    }
    .user-cell {
      display: flex;
      flex-direction: column;
    }
    .user-name {
      font-weight: var(--weight-medium);
    }
    .user-username {
      font-size: 12px;
      color: var(--gray-500);
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 16px;
      color: var(--gray-500);
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    .empty-state p {
      margin: 0;
      font-size: 14px;
    }
  `]
})
export class ConglomeradoEntriesComponent implements OnInit {
  displayedColumns = [
    'entry_date', 'full_name', 'country_name', 'campaign_name',
    'clientes', 'clientes_efectivos', 'menores', 'google_ads_account_id'
  ];

  entries: ConglomeradoEntry[] = [];
  countries: Country[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 25;
  loading = false;

  countryId: number | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  search = '';

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
    this.loadEntries();
  }

  loadEntries(): void {
    this.loading = true;
    const params: any = { page: this.page, limit: this.pageSize };
    if (this.countryId) params.country_id = this.countryId;
    if (this.dateFrom) params.date_from = this.formatDate(this.dateFrom);
    if (this.dateTo) params.date_to = this.formatDate(this.dateTo);
    if (this.search) params.search = this.search;

    this.http.get<ApiResponse<ConglomeradoEntry[]>>(
      API_URLS.admin.conglomeradoEntries, { params }
    ).subscribe({
      next: (res) => {
        this.entries = res.data;
        this.totalItems = res.meta?.total || 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadEntries();
  }

  clearFilters(): void {
    this.countryId = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.search = '';
    this.page = 1;
    this.loadEntries();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
}
