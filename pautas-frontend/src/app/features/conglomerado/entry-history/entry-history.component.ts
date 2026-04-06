import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ConglomeradoService } from '../conglomerado.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-entry-history',
  imports: [CommonModule, MatTableModule, MatPaginatorModule, MatIconModule, MatButtonModule],
  template: `
    <div class="page-header">
      <h1>Historial de Entradas</h1>
      <p class="page-subtitle">Registro de todas tus entradas diarias</p>
    </div>

    <div class="table-panel">
      <table mat-table [dataSource]="dataSource">
        <ng-container matColumnDef="entry_date">
          <th mat-header-cell *matHeaderCellDef>Fecha</th>
          <td mat-cell *matCellDef="let row">{{ row.entry_date | date:'dd/MM/yyyy' }}</td>
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
        <ng-container matColumnDef="iso_week">
          <th mat-header-cell *matHeaderCellDef>Semana</th>
          <td mat-cell *matCellDef="let row">
            <span class="week-badge">S{{ row.iso_week }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="soporte">
          <th mat-header-cell *matHeaderCellDef>Soporte</th>
          <td mat-cell *matCellDef="let row">
            @if (row.soporte_image_path) {
              <img [src]="getImageUrl(row.soporte_image_path)"
                   class="thumb"
                   (click)="openImage(row.soporte_image_path)"
                   (error)="onImgError($event)">
            } @else {
              <span class="no-image">—</span>
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
      <mat-paginator [pageSizeOptions]="[10, 25]" showFirstLastButtons></mat-paginator>
    </div>

    @if (fullImageUrl) {
      <div class="lightbox" (click)="closeImage()">
        <div class="lightbox-content" (click)="$event.stopPropagation()">
          <button mat-icon-button class="lightbox-close" (click)="closeImage()">
            <mat-icon>close</mat-icon>
          </button>
          <img [src]="fullImageUrl" class="lightbox-image">
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 20px; }
    .page-header h1 { margin: 0 0 4px; font-size: 22px; font-weight: var(--weight-bold); color: var(--gray-900); }
    .page-subtitle { margin: 0; font-size: 14px; color: var(--gray-500); }

    .table-panel {
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    table { width: 100%; }

    .week-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: var(--radius-lg);
      font-size: 12px;
      font-weight: var(--weight-semibold);
      background: var(--brand-accent-subtle);
      color: var(--gray-900);
    }

    .thumb {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .thumb:hover { transform: scale(1.2); }
    .no-image { color: var(--gray-500); }

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
export class EntryHistoryComponent implements OnInit {
  displayedColumns = ['entry_date', 'clientes', 'clientes_efectivos', 'menores', 'iso_week', 'soporte'];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  fullImageUrl: string | null = null;
  private backendBase: string;

  constructor(
    private conglomeradoService: ConglomeradoService,
    private authService: AuthService,
  ) {
    this.backendBase = environment.apiUrl.replace('/api/v1', '');
  }

  ngOnInit(): void {
    this.conglomeradoService.getEntries().subscribe(res => {
      this.dataSource.data = res.data;
      setTimeout(() => this.dataSource.paginator = this.paginator);
    });
  }

  getImageUrl(imagePath: string): string {
    const token = this.authService.getToken();
    return `${this.backendBase}/${imagePath}?token=${token}`;
  }

  openImage(imagePath: string): void {
    this.fullImageUrl = this.getImageUrl(imagePath);
  }

  closeImage(): void {
    this.fullImageUrl = null;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
