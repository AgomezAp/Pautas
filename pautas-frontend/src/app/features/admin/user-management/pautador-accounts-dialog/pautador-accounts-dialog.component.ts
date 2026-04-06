import { Component, OnInit, Inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../admin.service';
import { GoogleAdsIdPipe } from '../../../../shared/pipes/google-ads-id.pipe';

interface AccountItem {
  customer_account_id: string;
  customer_account_name: string;
  selected: boolean;
}

@Component({
  selector: 'app-pautador-accounts-dialog',
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatCheckboxModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    GoogleAdsIdPipe,
  ],
  template: `
    <div class="dialog-header">
      <div>
        <h2>Cuentas Google Ads</h2>
        <p class="dialog-subtitle">{{ data.user.full_name }}</p>
      </div>
      <button mat-icon-button (click)="onCancel()" class="dialog-close" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Buscar cuenta</mat-label>
        <input matInput [(ngModel)]="searchTerm" (keyup)="filterAccounts()" placeholder="Nombre o ID de cuenta">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Cargando cuentas...</span>
        </div>
      } @else {
        <div class="accounts-list">
          @for (account of filteredAccounts; track account.customer_account_id) {
            <div class="account-row" [class.account-row--selected]="account.selected"
                 (click)="account.selected = !account.selected">
              <mat-checkbox [checked]="account.selected" (change)="account.selected = $event.checked"
                            (click)="$event.stopPropagation()"></mat-checkbox>
              <div class="account-details">
                <span class="account-name">{{ account.customer_account_name }}</span>
                <span class="account-id">{{ account.customer_account_id | googleAdsId }}</span>
              </div>
            </div>
          }
          @if (filteredAccounts.length === 0) {
            <div class="empty-state">
              <mat-icon>search_off</mat-icon>
              <p>No se encontraron cuentas</p>
            </div>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <span class="selected-count">{{ selectedCount }} cuentas seleccionadas</span>
      <button mat-button (click)="onCancel()" class="dialog-btn-cancel">Cancelar</button>
      <button mat-flat-button color="primary" (click)="onSave()" [disabled]="saving" class="dialog-btn-submit">
        @if (saving) {
          <mat-spinner diameter="18"></mat-spinner>
        } @else {
          Guardar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6) var(--space-3);
    }
    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
    }
    .dialog-subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--text-sm);
      color: var(--gray-500);
    }
    .dialog-close { color: var(--gray-400); }

    .search-field { width: 100%; margin-bottom: var(--space-2); }
    .search-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-4);
      color: var(--gray-500);
    }

    .accounts-list {
      max-height: 400px;
      overflow-y: auto;
      border: var(--border-subtle);
      border-radius: var(--radius-md);
    }

    .account-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      border-bottom: var(--border-subtle);
      transition: background var(--duration-fast) var(--ease-out);
    }
    .account-row:last-child { border-bottom: none; }
    .account-row:hover { background: var(--gray-50); }
    .account-row--selected { background: var(--brand-accent-subtle); }
    .account-row--selected:hover { background: var(--brand-accent-light); }

    .account-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .account-name {
      font-weight: var(--weight-medium);
      font-size: var(--text-sm);
      color: var(--gray-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .account-id {
      font-size: var(--text-xs);
      color: var(--gray-500);
      font-family: var(--font-mono);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-8) var(--space-4);
      color: var(--gray-400);
      text-align: center;
    }
    .empty-state mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      opacity: 0.5;
      margin-bottom: var(--space-2);
    }

    .selected-count {
      font-size: var(--text-xs);
      color: var(--gray-500);
      margin-right: auto;
    }

    mat-dialog-content {
      min-width: 550px;
      padding: var(--space-2) var(--space-6) var(--space-4);
    }
    mat-dialog-actions {
      padding: var(--space-3) var(--space-6) var(--space-5) !important;
      border-top: var(--border-subtle);
    }
    .dialog-btn-cancel { color: var(--gray-500); }
    .dialog-btn-submit {
      min-width: 100px;
      font-weight: var(--weight-semibold);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PautadorAccountsDialogComponent implements OnInit {
  allAccounts: AccountItem[] = [];
  filteredAccounts: AccountItem[] = [];
  searchTerm = '';
  loading = true;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: any },
    private dialogRef: MatDialogRef<PautadorAccountsDialogComponent>,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    let allAccountsData: any[] = [];
    let assignedIds: string[] = [];
    let loadedCount = 0;

    const checkDone = () => {
      loadedCount++;
      if (loadedCount === 2) {
        this.allAccounts = allAccountsData.map(a => ({
          customer_account_id: a.customer_account_id,
          customer_account_name: a.customer_account_name,
          selected: assignedIds.includes(a.customer_account_id),
        }));
        this.filterAccounts();
        this.loading = false;
        this.cdr.markForCheck();
      }
    };

    this.adminService.getAllGoogleAdsAccounts().subscribe(res => {
      allAccountsData = res.data;
      checkDone();
    });

    this.adminService.getPautadorAccounts(this.data.user.id).subscribe(res => {
      assignedIds = res.data;
      checkDone();
    });
  }

  filterAccounts(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredAccounts = [...this.allAccounts];
    } else {
      this.filteredAccounts = this.allAccounts.filter(a =>
        (a.customer_account_name || '').toLowerCase().includes(term) ||
        (a.customer_account_id || '').includes(term)
      );
    }
    this.cdr.markForCheck();
  }

  get selectedCount(): number {
    return this.allAccounts.filter(a => a.selected).length;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.saving = true;
    this.cdr.markForCheck();
    const selectedIds = this.allAccounts.filter(a => a.selected).map(a => a.customer_account_id);
    this.adminService.setPautadorAccounts(this.data.user.id, selectedIds).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }
}
