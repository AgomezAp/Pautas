import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AdminService } from '../../admin.service';

@Component({
  selector: 'app-country-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule, MatSlideToggleModule,
  ],
  template: `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">Gestión de Países</h1>
        <p class="page-header__subtitle">Administración de países y zonas horarias</p>
      </div>
      <div class="page-header__actions">
        <button mat-flat-button color="primary" (click)="openForm()">
          <mat-icon>add</mat-icon> Nuevo País
        </button>
      </div>
    </div>

    <div class="table-panel">
      <table mat-table [dataSource]="dataSource" class="full-width">
        <ng-container matColumnDef="code">
          <th mat-header-cell *matHeaderCellDef>Código</th>
          <td mat-cell *matCellDef="let row">
            <span class="code-badge">{{ row.code }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>País</th>
          <td mat-cell *matCellDef="let row">{{ row.name }}</td>
        </ng-container>
        <ng-container matColumnDef="timezone">
          <th mat-header-cell *matHeaderCellDef>Zona Horaria</th>
          <td mat-cell *matCellDef="let row">
            <span class="tz-label">{{ row.timezone }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="is_active">
          <th mat-header-cell *matHeaderCellDef>Estado</th>
          <td mat-cell *matCellDef="let row">
            <span [class]="row.is_active ? 'status-badge status-badge--active' : 'status-badge status-badge--paused'">
              {{ row.is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Acciones</th>
          <td mat-cell *matCellDef="let row">
            <button mat-icon-button (click)="openForm(row)" matTooltip="Editar" class="action-btn">
              <mat-icon>edit</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </div>

    @if (showForm) {
      <div class="overlay" (click)="closeForm()">
        <div class="form-dialog" (click)="$event.stopPropagation()">
          <div class="form-dialog__header">
            <h3>{{ editingCountry ? 'Editar País' : 'Nuevo País' }}</h3>
            <button mat-icon-button (click)="closeForm()" class="dialog-close" aria-label="Cerrar">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <form (ngSubmit)="save()">
            <div class="form-dialog__body">
              <div class="form-row">
                <mat-form-field appearance="outline" class="form-full">
                  <mat-label>Nombre</mat-label>
                  <input matInput [(ngModel)]="formData.name" name="name" required>
                  <mat-icon matPrefix>public</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="form-full">
                  <mat-label>Código (ej: CO, MX)</mat-label>
                  <input matInput [(ngModel)]="formData.code" name="code" required maxlength="5">
                  <mat-icon matPrefix>tag</mat-icon>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="form-full">
                <mat-label>Zona Horaria</mat-label>
                <mat-select [(ngModel)]="formData.timezone" name="timezone">
                  @for (tz of timezones; track tz) {
                    <mat-option [value]="tz">{{ tz }}</mat-option>
                  }
                </mat-select>
                <mat-icon matPrefix>schedule</mat-icon>
              </mat-form-field>

              <div class="form-toggle">
                <mat-slide-toggle [(ngModel)]="formData.is_active" name="is_active">
                  Activo
                </mat-slide-toggle>
              </div>

              @if (formError) {
                <div class="form-error">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ formError }}</span>
                </div>
              }
            </div>

            <div class="form-dialog__footer">
              <button mat-button type="button" (click)="closeForm()" class="dialog-btn-cancel">Cancelar</button>
              <button mat-flat-button color="primary" type="submit" [disabled]="saving" class="dialog-btn-submit">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .full-width { width: 100%; }

    .table-panel {
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .code-badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      font-family: var(--font-mono);
      background: var(--gray-100);
      color: var(--gray-700);
      letter-spacing: 0.05em;
    }
    .tz-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--gray-600);
    }
    .action-btn { color: var(--gray-400); }
    .action-btn:hover { color: var(--gray-700); }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: dialogEnter 0.2s var(--ease-out);
    }
    .form-dialog {
      background: var(--gray-0);
      border-radius: var(--radius-xl);
      width: 100%;
      max-width: 500px;
      box-shadow: var(--shadow-xl);
      overflow: hidden;
    }
    .form-dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6);
      border-bottom: var(--border-subtle);
    }
    .form-dialog__header h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
    }
    .dialog-close { color: var(--gray-400); }
    .form-dialog__body {
      padding: var(--space-5) var(--space-6);
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    .form-full { width: 100%; }
    .form-toggle { margin: var(--space-1) 0 var(--space-3); }
    .form-error {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--danger-dark);
      font-size: var(--text-sm);
      margin: 0 0 var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--danger-subtle);
      border-radius: var(--radius-md);
    }
    .form-error mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .form-dialog__footer {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
      padding: var(--space-3) var(--space-6) var(--space-5);
      border-top: var(--border-subtle);
    }
    .dialog-btn-cancel { color: var(--gray-500); }
    .dialog-btn-submit {
      min-width: 100px;
      font-weight: var(--weight-semibold);
    }
  `]
})
export class CountryListComponent implements OnInit {
  displayedColumns = ['code', 'name', 'timezone', 'is_active', 'actions'];
  dataSource = new MatTableDataSource<any>([]);

  showForm = false;
  editingCountry: any = null;
  saving = false;
  formError = '';
  formData = { name: '', code: '', timezone: 'America/Bogota', is_active: true };

  timezones = [
    'America/Bogota', 'America/Mexico_City', 'America/Lima',
    'America/Santiago', 'America/Guayaquil', 'America/Panama', 'America/Costa_Rica',
  ];

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCountries();
  }

  loadCountries(): void {
    this.adminService.getCountries().subscribe(res => {
      this.dataSource.data = res.data;
      this.cdr.markForCheck();
    });
  }

  openForm(country?: any): void {
    this.formError = '';
    if (country) {
      this.editingCountry = country;
      this.formData = {
        name: country.name,
        code: country.code,
        timezone: country.timezone || 'America/Bogota',
        is_active: country.is_active,
      };
    } else {
      this.editingCountry = null;
      this.formData = { name: '', code: '', timezone: 'America/Bogota', is_active: true };
    }
    this.showForm = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingCountry = null;
    this.cdr.markForCheck();
  }

  save(): void {
    if (!this.formData.name.trim() || !this.formData.code.trim()) {
      this.formError = 'Nombre y código son requeridos';
      return;
    }

    this.saving = true;
    this.formError = '';

    const payload = { ...this.formData, code: this.formData.code.toUpperCase() };
    const obs = this.editingCountry
      ? this.adminService.updateCountry(this.editingCountry.id, payload)
      : this.adminService.createCountry(payload);

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.closeForm();
        this.loadCountries();
      },
      error: (err) => {
        this.saving = false;
        this.formError = err.error?.message || 'Error al guardar';
        this.cdr.markForCheck();
      },
    });
  }
}
