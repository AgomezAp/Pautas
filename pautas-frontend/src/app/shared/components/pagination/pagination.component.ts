import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div
      class="pagination-wrapper d-flex align-items-center justify-content-between flex-wrap gap-2"
    >
      <div class="pagination-info text-muted small">
        Mostrando {{ startItem }}-{{ endItem }} de {{ totalItems }}
      </div>

      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2">
          <label class="text-muted small mb-0" for="pageSizeSelect">Filas:</label>
          <select
            id="pageSizeSelect"
            class="form-select form-select-sm page-size-select"
            [(ngModel)]="pageSize"
            (ngModelChange)="onPageSizeChange()"
          >
            <option *ngFor="let opt of pageSizeOptions" [ngValue]="opt">{{ opt }}</option>
          </select>
        </div>

        <nav aria-label="Table pagination">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="currentPage === 1">
              <button
                class="page-link"
                (click)="goToPage(1)"
                [disabled]="currentPage === 1"
                aria-label="First page"
              >
                <app-icon name="first_page" size="sm"></app-icon>
              </button>
            </li>
            <li class="page-item" [class.disabled]="currentPage === 1">
              <button
                class="page-link"
                (click)="goToPage(currentPage - 1)"
                [disabled]="currentPage === 1"
                aria-label="Previous page"
              >
                <app-icon name="chevron_left" size="sm"></app-icon>
              </button>
            </li>
            <li class="page-item active" aria-current="page">
              <span class="page-link page-indicator"> {{ currentPage }} / {{ totalPages }} </span>
            </li>
            <li class="page-item" [class.disabled]="currentPage === totalPages">
              <button
                class="page-link"
                (click)="goToPage(currentPage + 1)"
                [disabled]="currentPage === totalPages"
                aria-label="Next page"
              >
                <app-icon name="chevron_right" size="sm"></app-icon>
              </button>
            </li>
            <li class="page-item" [class.disabled]="currentPage === totalPages">
              <button
                class="page-link"
                (click)="goToPage(totalPages)"
                [disabled]="currentPage === totalPages"
                aria-label="Last page"
              >
                <app-icon name="last_page" size="sm"></app-icon>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  `,
  styles: [
    `
      // ============================================
      // MÓDULOS SASS MODERNOS
      // ============================================
      @use 'sass:color';

      // ============================================
      // VARIABLES (Identidad de Marca)
      // ============================================
      $color-primary: #141414;
      $color-secondary: #ffd600;
      $font-primary: 'Fira Sans', sans-serif;

      // Variantes de texto
      $color-text-dark: #141414;
      $color-text-muted: #6c757d;
      $color-text-light: #ffffff;

      // Fondos
      $color-bg-white: #ffffff;
      $color-bg-light: #f8f9fa;

      // Bordes
      $color-border: #dee2e6;
      $color-border-light: #e9ecef;

      // Estados
      $color-danger: #dc3545;
      $color-success: #10b981;

      // Espaciado
      $spacing-sm: 0.5rem;
      $spacing-md: 1rem;
      $spacing-lg: 1.5rem;
      $spacing-xl: 2rem;

      // Border radius
      $radius-sm: 0.375rem;
      $radius-md: 0.5rem;
      $radius-lg: 0.75rem;
      $radius-xl: 1rem;

      // Sombras
      $shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
      $shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);

      // Transiciones
      $transition-base: all 0.25s ease;

      // ============================================
      // HOST
      // ============================================
      :host {
        display: block;
        font-family: $font-primary;
        color: $color-text-dark;
      }

      // ============================================
      // PAGINATION WRAPPER
      // ============================================
      .pagination-wrapper {
        padding: $spacing-md $spacing-lg;
        background-color: $color-bg-white;
        border-top: 1px solid $color-border-light;

        // Utilidades layout
        &.d-flex {
          display: flex;
        }

        &.align-items-center {
          align-items: center;
        }

        &.justify-content-between {
          justify-content: space-between;
        }

        &.flex-wrap {
          flex-wrap: wrap;
        }

        &.gap-2 {
          gap: $spacing-sm;
        }
      }

      // ============================================
      // PAGINATION INFO (Mostrando X-Y de Z)
      // ============================================
      .pagination-info {
        font-family: $font-primary;
        font-size: 0.82rem;
        font-weight: 500;
        color: $color-text-muted;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;

        &.text-muted {
          color: $color-text-muted;
        }

        &.small {
          font-size: 0.82rem;
        }
      }

      // ============================================
      // UTILIDADES D-FLEX INTERNAS
      // ============================================
      .d-flex {
        display: flex;
      }

      .align-items-center {
        align-items: center;
      }

      .gap-2 {
        gap: $spacing-sm;
      }

      .gap-3 {
        gap: $spacing-md;
      }

      // ============================================
      // LABEL "Filas"
      // ============================================
      label.text-muted.small {
        font-family: $font-primary;
        font-size: 0.8rem;
        font-weight: 500;
        color: $color-text-muted;
        white-space: nowrap;
        user-select: none;

        &.mb-0 {
          margin-bottom: 0;
        }
      }

      // ============================================
      // PAGE SIZE SELECT
      // ============================================
      .page-size-select {
        font-family: $font-primary;
        font-size: 0.82rem;
        font-weight: 500;
        color: $color-text-dark;
        background-color: $color-bg-white;
        border: 1px solid $color-border;
        border-radius: $radius-sm;
        padding: 0.3rem 1.8rem 0.3rem 0.5rem;
        height: 32px;
        cursor: pointer;
        appearance: none;
        transition: $transition-base;
        min-width: 60px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23141414' d='M6 8.825a.7.7 0 0 1-.5-.206L1.705 4.824a.71.71 0 0 1 1.003-1.003L6 7.113l3.293-3.292a.71.71 0 0 1 1.003 1.003L6.5 8.619a.7.7 0 0 1-.5.206Z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.5rem center;
        background-size: 10px;

        // Focus amarillo (regla obligatoria)
        &:focus {
          outline: none;
          border-color: $color-secondary;
          box-shadow: 0 0 0 3px rgba($color-secondary, 0.25);
        }

        &:hover {
          border-color: color.adjust($color-border, $lightness: -10%);
        }

        // Variante sm
        &.form-select-sm {
          font-size: 0.82rem;
          height: 32px;
          padding: 0.3rem 1.8rem 0.3rem 0.5rem;
        }
      }

      // ============================================
      // PAGINATION NAV
      // ============================================
      .pagination {
        display: flex;
        align-items: center;
        list-style: none;
        margin: 0;
        padding: 0;
        gap: 0.2rem;

        &.pagination-sm {
          gap: 0.15rem;
        }

        &.mb-0 {
          margin-bottom: 0;
        }
      }

      // ============================================
      // PAGE ITEM
      // ============================================
      .page-item {
        // Estado deshabilitado
        &.disabled {
          .page-link {
            opacity: 0.35;
            cursor: not-allowed;
            pointer-events: none;

            &:hover {
              background-color: transparent;
              border-color: $color-border;
            }
          }
        }

        // Estado activo — indicador de página actual
        &.active {
          .page-link {
            background-color: $color-secondary; // Fondo amarillo (regla obligatoria)
            border-color: $color-secondary;
            color: $color-text-dark;
            font-weight: 700;
            cursor: default;
            pointer-events: none;

            &:hover {
              background-color: $color-secondary;
            }
          }
        }
      }

      // ============================================
      // PAGE LINK (Botones de paginación)
      // ============================================
      .page-link {
        font-family: $font-primary;
        font-size: 0.82rem;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        padding: 0 $spacing-sm;
        border-radius: $radius-sm;
        border: 1px solid $color-border;
        background-color: $color-bg-white;
        color: $color-text-dark;
        cursor: pointer;
        transition: $transition-base;
        text-decoration: none;
        line-height: 1;

        app-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        // Hover
        &:hover:not(:disabled) {
          background-color: $color-bg-light;
          border-color: color.adjust($color-border, $lightness: -10%);
          color: $color-text-dark;
        }

        // Active (click)
        &:active:not(:disabled) {
          background-color: color.adjust($color-bg-light, $lightness: -3%);
          transform: scale(0.95);
        }

        // Focus
        &:focus-visible {
          outline: none;
          border-color: $color-secondary;
          box-shadow: 0 0 0 3px rgba($color-secondary, 0.25);
          z-index: 1;
        }

        // Disabled nativo
        &:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      }

      // ============================================
      // PAGE INDICATOR (X / Y — página actual)
      // ============================================
      .page-indicator {
        font-family: $font-primary;
        font-size: 0.8rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.3px;
        white-space: nowrap;
        padding: 0 $spacing-md;
        min-width: auto;
        user-select: none;

        // Heredará los estilos de .page-item.active .page-link:
        // fondo amarillo, borde amarillo, color oscuro
      }

      // ============================================
      // RESPONSIVE
      // ============================================

      // Tablet
      @media (max-width: 768px) {
        .pagination-wrapper {
          padding: $spacing-sm $spacing-md;
          gap: $spacing-sm;
        }

        .pagination-info {
          font-size: 0.78rem;
        }

        .page-size-select,
        .page-size-select.form-select-sm {
          height: 30px;
          font-size: 0.78rem;
          min-width: 55px;
        }

        .page-link {
          min-width: 30px;
          height: 30px;
          font-size: 0.78rem;
        }

        .page-indicator {
          font-size: 0.76rem;
          padding: 0 $spacing-sm;
        }

        label.text-muted.small {
          font-size: 0.76rem;
        }
      }

      // Mobile
      @media (max-width: 540px) {
        .pagination-wrapper {
          flex-direction: column;
          align-items: center !important;
          justify-content: center !important;
          gap: $spacing-sm;
          padding: $spacing-sm;
        }

        .pagination-info {
          order: 2;
          font-size: 0.75rem;
          text-align: center;
        }

        // Selector de filas + paginación en una fila
        .pagination-wrapper > .d-flex {
          flex-direction: column;
          align-items: center;
          gap: $spacing-sm;
          order: 1;
          width: 100%;
        }

        // Selector de filas centrado
        .pagination-wrapper > .d-flex > .d-flex:first-child {
          justify-content: center;
        }

        // Paginación centrada
        .pagination {
          justify-content: center;
        }

        .page-link {
          min-width: 28px;
          height: 28px;
          font-size: 0.75rem;
          padding: 0 0.3rem;
        }

        .page-indicator {
          font-size: 0.72rem;
          padding: 0 0.4rem;
        }

        .page-size-select,
        .page-size-select.form-select-sm {
          height: 28px;
          font-size: 0.75rem;
          min-width: 50px;
          padding: 0.2rem 1.5rem 0.2rem 0.4rem;
        }

        label.text-muted.small {
          font-size: 0.72rem;
        }
      }
    `,
  ],
})
export class PaginationComponent {
  @Input() totalItems: number = 0;
  @Input() pageSize: number = 10;
  @Input() currentPage: number = 1;
  @Input() pageSizeOptions: number[] = [10, 25, 50];

  @Output() pageChange = new EventEmitter<{ page: number; pageSize: number }>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItem(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.pageChange.emit({ page: this.currentPage, pageSize: this.pageSize });
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.pageChange.emit({ page: this.currentPage, pageSize: this.pageSize });
  }
}
