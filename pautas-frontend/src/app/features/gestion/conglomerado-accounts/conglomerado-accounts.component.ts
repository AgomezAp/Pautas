import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';

interface ConglomeradoUser {
  id: number;
  full_name: string;
  username: string;
  country_name: string;
  campaign_name: string;
  google_ads_account_id: string | null;
  is_active: boolean;
}

@Component({
  selector: 'app-conglomerado-accounts',
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatTooltipModule,
    GoogleAdsIdPipe,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1>Cuentas Conglomerado</h1>
        <p class="page-subtitle">Asignar cuentas de Google Ads a miembros del conglomerado</p>
      </div>
    </div>

    <div class="content-card">
      <div class="tab-toolbar">
        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>País</mat-label>
          <mat-select [(value)]="selectedCountryId" (selectionChange)="loadUsers()">
            <mat-option [value]="0">Todos</mat-option>
            @for (country of countries; track country.id) {
              <mat-option [value]="country.id">{{ country.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span class="record-count">{{ users.length }} miembros</span>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Cargando miembros...</span>
        </div>
      } @else if (users.length === 0) {
        <div class="empty-state">
          <mat-icon>group_off</mat-icon>
          <p>No se encontraron miembros del conglomerado</p>
        </div>
      } @else {
        <div class="data-table-wrap">
          <table mat-table [dataSource]="users">
            <ng-container matColumnDef="full_name">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-primary">{{ row.full_name }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="username">
              <th mat-header-cell *matHeaderCellDef>Usuario</th>
              <td mat-cell *matCellDef="let row">{{ row.username }}</td>
            </ng-container>

            <ng-container matColumnDef="country_name">
              <th mat-header-cell *matHeaderCellDef>País</th>
              <td mat-cell *matCellDef="let row">{{ row.country_name || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="campaign_name">
              <th mat-header-cell *matHeaderCellDef>Campaña</th>
              <td mat-cell *matCellDef="let row">{{ row.campaign_name || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="google_ads_account_id">
              <th mat-header-cell *matHeaderCellDef>Cuenta Google Ads</th>
              <td mat-cell *matCellDef="let row">
                @if (editingUserId === row.id) {
                  <div class="inline-edit">
                    <mat-form-field appearance="outline" class="edit-field">
                      <input matInput [(ngModel)]="editValue" placeholder="1234567890"
                             (keyup.enter)="saveAccountId(row)"
                             (keyup.escape)="cancelEdit()">
                    </mat-form-field>
                    <button mat-icon-button color="primary" (click)="saveAccountId(row)"
                            matTooltip="Guardar" [disabled]="saving">
                      @if (saving) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>check</mat-icon>
                      }
                    </button>
                    <button mat-icon-button (click)="cancelEdit()" matTooltip="Cancelar">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                } @else {
                  <div class="account-display" (click)="startEdit(row)">
                    @if (row.google_ads_account_id) {
                      <span class="mono">{{ row.google_ads_account_id | googleAdsId }}</span>
                    } @else {
                      <span class="text-muted">Sin asignar</span>
                    }
                    <mat-icon class="edit-icon" matTooltip="Editar cuenta">edit</mat-icon>
                  </div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="is_active">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let row">
                <span class="badge" [class]="row.is_active ? 'badge badge-green' : 'badge badge-red'">
                  {{ row.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
    }
    .page-header h1 { margin: 0 0 4px; font-size: 24px; font-weight: var(--weight-bold); color: var(--gray-900); }
    .page-subtitle { margin: 0; font-size: 14px; color: var(--gray-500); }

    .content-card {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); padding: 20px 24px; overflow: hidden;
    }

    .tab-toolbar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .filter-select { min-width: 180px; }
    .filter-select .mat-mdc-form-field-subscript-wrapper { display: none; }
    .record-count { font-size: 13px; color: var(--gray-500); margin-left: auto; white-space: nowrap; }

    .loading-state {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 48px 16px; color: var(--gray-500);
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px 16px; color: var(--gray-500); text-align: center;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; opacity: 0.5; }
    .empty-state p { margin: 0 0 4px; }

    .data-table-wrap { overflow-x: auto; border: var(--border-subtle); border-radius: var(--radius-md); }
    table { width: 100%; }
    .cell-primary { font-weight: var(--weight-semibold); color: var(--gray-900); }
    .mono {
      font-family: var(--font-mono); font-size: 12px;
      background: var(--gray-100); padding: 3px 8px; border-radius: var(--radius-sm); letter-spacing: 0.3px;
    }
    .text-muted { color: var(--gray-500); }

    .account-display {
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      padding: 4px 0; border-radius: var(--radius-sm); transition: background 0.15s;
    }
    .account-display:hover { background: var(--gray-100); }
    .edit-icon {
      font-size: 16px; width: 16px; height: 16px;
      color: var(--gray-500); opacity: 0;
      transition: opacity 0.15s;
    }
    .account-display:hover .edit-icon { opacity: 1; }

    .inline-edit { display: flex; align-items: center; gap: 4px; }
    .edit-field { width: 140px; }
    .edit-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    .badge {
      display: inline-block; padding: 3px 10px; border-radius: var(--radius-full);
      font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase; letter-spacing: 0.3px;
    }
    .badge-green { background: var(--success-light); color: var(--success-dark); }
    .badge-red { background: var(--danger-light); color: var(--danger-dark); }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .content-card { padding: 16px 12px; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConglomeradoAccountsComponent implements OnInit {
  users: ConglomeradoUser[] = [];
  countries: Country[] = [];
  selectedCountryId = 0;
  loading = false;
  saving = false;

  editingUserId: number | null = null;
  editValue = '';

  displayedColumns = ['full_name', 'username', 'country_name', 'campaign_name', 'google_ads_account_id', 'is_active'];

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.cdr.markForCheck();

    let params = new HttpParams();
    if (this.selectedCountryId) {
      params = params.set('country_id', this.selectedCountryId);
    }

    this.http.get<ApiResponse<ConglomeradoUser[]>>(API_URLS.gestion.conglomeradoUsers, { params }).subscribe({
      next: (res) => {
        this.users = res.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Error al cargar los miembros del conglomerado');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  startEdit(user: ConglomeradoUser): void {
    this.editingUserId = user.id;
    this.editValue = user.google_ads_account_id || '';
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.editValue = '';
    this.cdr.markForCheck();
  }

  saveAccountId(user: ConglomeradoUser): void {
    const cleanValue = this.editValue.replace(/\D/g, '');

    if (cleanValue && cleanValue.length !== 10) {
      this.notification.error('El ID de cuenta debe tener 10 digitos');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    const url = API_URLS.gestion.conglomeradoUsers + '/' + user.id + '/google-ads-account';
    this.http.patch<ApiResponse<any>>(url, { google_ads_account_id: cleanValue || null }).subscribe({
      next: () => {
        user.google_ads_account_id = cleanValue || null;
        this.editingUserId = null;
        this.editValue = '';
        this.saving = false;
        this.notification.success('Cuenta de Google Ads actualizada');
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.notification.error('Error al actualizar la cuenta de Google Ads');
        this.cdr.markForCheck();
      },
    });
  }
}
