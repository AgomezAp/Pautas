import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-campaign-form',
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <h2>{{ isEdit ? 'Editar' : 'Crear' }} Campaña</h2>
      <button mat-icon-button mat-dialog-close class="dialog-close" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Nombre de la campaña</mat-label>
          <input matInput formControlName="name">
          <mat-icon matPrefix>campaign</mat-icon>
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>ID Google Ads</mat-label>
            <input matInput formControlName="google_ads_campaign_id">
            <mat-icon matPrefix>tag</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>País</mat-label>
            <mat-select formControlName="country_id">
              @for (country of countries; track country.id) {
                <mat-option [value]="country.id">{{ country.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>public</mat-icon>
            @if (form.get('country_id')?.hasError('required') && form.get('country_id')?.touched) {
              <mat-error>El país es requerido</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>URL de la campaña</mat-label>
          <input matInput formControlName="campaign_url">
          <mat-icon matPrefix>link</mat-icon>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close class="dialog-btn-cancel">Cancelar</button>
      <button mat-flat-button color="primary" (click)="onSubmit()" [disabled]="form.invalid || saving"
              class="dialog-btn-submit">
        {{ saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6) var(--space-3);
    }
    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
    }
    .dialog-close { color: var(--gray-400); }
    mat-dialog-content {
      padding: var(--space-2) var(--space-6) var(--space-4);
    }
    .form-grid {
      display: flex;
      flex-direction: column;
      min-width: 480px;
      gap: var(--space-1);
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    mat-form-field { width: 100%; }
    mat-dialog-actions {
      padding: var(--space-3) var(--space-6) var(--space-5) !important;
      border-top: var(--border-subtle);
    }
    .dialog-btn-cancel { color: var(--gray-500); }
    .dialog-btn-submit {
      min-width: 120px;
      font-weight: var(--weight-semibold);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignFormComponent implements OnInit {
  form: FormGroup;
  isEdit: boolean;
  saving = false;
  countries: any[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notification: NotificationService,
    private dialogRef: MatDialogRef<CampaignFormComponent>,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { campaign?: any },
  ) {
    this.isEdit = !!data.campaign;
    this.form = this.fb.group({
      name: [data.campaign?.name || '', Validators.required],
      google_ads_campaign_id: [data.campaign?.google_ads_campaign_id || ''],
      country_id: [data.campaign?.country_id || null, Validators.required],
      campaign_url: [data.campaign?.campaign_url || ''],
    });
  }

  ngOnInit(): void {
    this.adminService.getCountries().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const request = this.isEdit
      ? this.adminService.updateCampaign(this.data.campaign.id, this.form.value)
      : this.adminService.createCampaign(this.form.value);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.notification.success(this.isEdit ? 'Campaña actualizada' : 'Campaña creada');
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err.error?.error?.message || 'Error al guardar');
      },
    });
  }
}
