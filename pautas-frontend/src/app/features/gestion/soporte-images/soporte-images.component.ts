import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { AuthService } from '../../../core/services/auth.service';
import { Country } from '../../../core/models/country.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-soporte-images',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule, MatIconModule,
    MatButtonModule, MatPaginatorModule,
  ],
  template: `
    <div class="page-header">
      <h2>Imágenes de Soporte</h2>
      <p class="subtitle">Imágenes subidas por los usuarios del conglomerado</p>
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
        <mat-icon>clear</mat-icon> Limpiar
      </button>
    </div>

    <div class="image-grid">
      @for (entry of entries; track entry.id) {
        <mat-card class="image-card">
          <img [src]="getImageUrl(entry.soporte_image_path)"
               [alt]="'Soporte de ' + entry.full_name"
               class="image-preview"
               (click)="openFullImage(entry.soporte_image_path)"
               (error)="onImageError($event)">
          <mat-card-content>
            <div class="entry-info">
              <span class="entry-user">{{ entry.full_name }}</span>
              <span class="entry-detail">{{ entry.username }}</span>
              <span class="entry-detail">{{ entry.entry_date | date:'dd/MM/yyyy' }} · {{ entry.country_name }}</span>
              <div class="entry-stats">
                <span>Clientes: {{ entry.clientes }}</span>
                <span>Efectivos: {{ entry.clientes_efectivos }}</span>
                <span>Menores: {{ entry.menores }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    @if (entries.length === 0 && !loading) {
      <div class="empty-state">
        <mat-icon>photo_library</mat-icon>
        <p>No se encontraron imágenes de soporte</p>
      </div>
    }

    <mat-paginator
      [length]="totalItems"
      [pageSize]="pageSize"
      [pageSizeOptions]="[12, 24, 48]"
      [pageIndex]="page - 1"
      (page)="onPageChange($event)"
      showFirstLastButtons>
    </mat-paginator>

    @if (fullImageUrl) {
      <div class="lightbox" (click)="closeFullImage()">
        <div class="lightbox-content" (click)="$event.stopPropagation()">
          <button mat-icon-button class="lightbox-close" (click)="closeFullImage()">
            <mat-icon>close</mat-icon>
          </button>
          <img [src]="fullImageUrl" class="lightbox-image">
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
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
    .filter-field { flex: 0 0 180px; }
    .search-field { flex: 1 1 200px; }
    .clear-btn { height: 40px; }
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .image-card {
      overflow: hidden;
      border-radius: var(--radius-md);
    }
    .image-preview {
      width: 100%;
      height: 200px;
      object-fit: cover;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .image-preview:hover {
      transform: scale(1.02);
    }
    .entry-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 0;
    }
    .entry-user {
      font-weight: var(--weight-semibold);
      font-size: 14px;
      color: var(--gray-900);
    }
    .entry-detail {
      font-size: 12px;
      color: var(--gray-500);
    }
    .entry-stats {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      font-size: 12px;
      color: var(--gray-700);
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 16px;
      color: var(--gray-500);
    }
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }
    .empty-state p { margin: 0; font-size: 16px; }
    .lightbox {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
    }
    .lightbox-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
    }
    .lightbox-image {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: var(--radius-sm);
    }
    .lightbox-close {
      position: absolute;
      top: -40px;
      right: 0;
      color: var(--gray-0);
    }
  `]
})
export class SoporteImagesComponent implements OnInit {
  entries: any[] = [];
  countries: Country[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 12;
  loading = false;

  countryId: number | null = null;
  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  search = '';

  fullImageUrl: string | null = null;

  private backendBase: string;

  constructor(
    private gestionService: GestionService,
    private countryService: CountryService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    // Derive backend base from API URL (remove /api/v1 suffix)
    this.backendBase = environment.apiUrl.replace('/api/v1', '');
  }

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

    this.gestionService.getEntriesWithImages(params).subscribe({
      next: (res) => {
        this.entries = res.data;
        this.totalItems = res.meta?.total || 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    const token = this.authService.getToken();
    return `${this.backendBase}/${imagePath}?token=${token}`;
  }

  openFullImage(imagePath: string): void {
    this.fullImageUrl = this.getImageUrl(imagePath);
    this.cdr.markForCheck();
  }

  closeFullImage(): void {
    this.fullImageUrl = null;
    this.cdr.markForCheck();
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=';
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
    return `${year}-${month}-${day}`;
  }
}
