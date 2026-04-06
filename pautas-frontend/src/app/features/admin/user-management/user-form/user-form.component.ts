import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-user-form',
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatCheckboxModule, MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <h2>{{ isEdit ? 'Editar' : 'Crear' }} Usuario</h2>
      <button mat-icon-button mat-dialog-close class="dialog-close" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="username">
            <mat-icon matPrefix>person</mat-icon>
            @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
              <mat-error>El usuario es requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombre completo</mat-label>
            <input matInput formControlName="full_name" autocomplete="name">
            <mat-icon matPrefix>badge</mat-icon>
            @if (form.get('full_name')?.hasError('required') && form.get('full_name')?.touched) {
              <mat-error>El nombre es requerido</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" autocomplete="email">
          <mat-icon matPrefix>email</mat-icon>
        </mat-form-field>

        @if (!isEdit) {
          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput formControlName="password" type="password" autocomplete="new-password">
            <mat-icon matPrefix>lock</mat-icon>
            @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
              <mat-error>La contraseña es requerida</mat-error>
            }
            @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
              <mat-error>Mínimo 8 caracteres</mat-error>
            }
          </mat-form-field>
        }

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <mat-select formControlName="role_id">
              @for (role of roles; track role.id) {
                <mat-option [value]="role.id">{{ role.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>shield</mat-icon>
            @if (form.get('role_id')?.hasError('required') && form.get('role_id')?.touched) {
              <mat-error>El rol es requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>País</mat-label>
            <mat-select formControlName="country_id">
              <mat-option [value]="null">Ninguno</mat-option>
              @for (country of countries; track country.id) {
                <mat-option [value]="country.id">{{ country.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>public</mat-icon>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Campaña</mat-label>
          <mat-select formControlName="campaign_id">
            <mat-option [value]="null">Ninguna</mat-option>
            @for (campaign of campaigns; track campaign.id) {
              <mat-option [value]="campaign.id">{{ campaign.name }} ({{ campaign.country_name }})</mat-option>
            }
          </mat-select>
          <mat-icon matPrefix>campaign</mat-icon>
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
    .dialog-close {
      color: var(--gray-400);
    }
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
    .dialog-btn-cancel {
      color: var(--gray-500);
    }
    .dialog-btn-submit {
      min-width: 120px;
      font-weight: var(--weight-semibold);
    }
  `]
})
export class UserFormComponent implements OnInit {
  form: FormGroup;
  isEdit: boolean;
  saving = false;
  roles: any[] = [];
  countries: any[] = [];
  campaigns: any[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notification: NotificationService,
    private dialogRef: MatDialogRef<UserFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user?: any },
  ) {
    this.isEdit = !!data.user;
    this.form = this.fb.group({
      username: [data.user?.username || '', Validators.required],
      full_name: [data.user?.full_name || '', Validators.required],
      email: [data.user?.email || ''],
      password: [''],
      role_id: [data.user?.role_id || null, Validators.required],
      country_id: [data.user?.country_id || null],
      campaign_id: [data.user?.campaign_id || null],
    });

    if (this.isEdit) {
      this.form.get('username')?.disable();
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }
  }

  ngOnInit(): void {
    this.adminService.getRoles().subscribe(res => this.roles = res.data);
    this.adminService.getCountries().subscribe(res => this.countries = res.data);
    this.adminService.getCampaigns().subscribe(res => this.campaigns = res.data);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const formData = this.form.getRawValue();
    // Remove empty password for edit
    if (this.isEdit && !formData.password) delete formData.password;

    const request = this.isEdit
      ? this.adminService.updateUser(this.data.user.id, formData)
      : this.adminService.createUser(formData);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.notification.success(this.isEdit ? 'Usuario actualizado' : 'Usuario creado');
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err.error?.error?.message || 'Error al guardar');
      },
    });
  }
}
