import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ConglomeradoService } from '../conglomerado.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-daily-entry-form',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="form-container">
      <div class="form-header">
        <h1>Entrada Diaria</h1>
        <p class="form-date">{{ today | date:'EEEE, d MMMM yyyy' }}</p>
      </div>

      <div class="form-panel">
        @if (alreadySubmitted) {
          <div class="success-state">
            <div class="success-icon-wrap">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h3>Entrada enviada</h3>
            <p>Ya registraste tu entrada de hoy. Vuelve mañana.</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="fields-grid">
              <mat-form-field appearance="outline">
                <mat-label>Clientes</mat-label>
                <input matInput type="number" formControlName="clientes" min="0">
                <mat-icon matPrefix>people</mat-icon>
                @if (form.get('clientes')?.hasError('required')) {
                  <mat-error>Campo requerido</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Clientes Efectivos</mat-label>
                <input matInput type="number" formControlName="clientes_efectivos" min="0">
                <mat-icon matPrefix>verified</mat-icon>
                @if (form.get('clientes_efectivos')?.hasError('required')) {
                  <mat-error>Campo requerido</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Menores</mat-label>
                <input matInput type="number" formControlName="menores" min="0">
                <mat-icon matPrefix>child_care</mat-icon>
                @if (form.get('menores')?.hasError('required')) {
                  <mat-error>Campo requerido</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="upload-area" (click)="fileInput.click()"
                 [class.has-file]="selectedFile">
              <input type="file" accept="image/*" (change)="onFileSelected($event)" #fileInput hidden>
              @if (imagePreview) {
                <img [src]="imagePreview" alt="Preview" class="upload-preview">
              } @else {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <span class="upload-text">Subir imagen de soporte</span>
                <span class="upload-hint">JPEG, PNG, WebP, GIF - max 5MB</span>
              }
            </div>

            <button mat-flat-button color="primary" type="submit" class="submit-btn"
                    [disabled]="form.invalid || !selectedFile || submitting">
              @if (submitting) {
                <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                <span>Enviando...</span>
              } @else {
                <span>Enviar Entrada</span>
              }
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .form-container { max-width: 560px; margin: 0 auto; }
    .form-header { margin-bottom: var(--space-5); }
    .form-header h1 {
      margin: 0 0 var(--space-1);
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
      letter-spacing: var(--tracking-tight);
    }
    .form-date {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--gray-500);
      text-transform: capitalize;
    }

    .form-panel {
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-7);
    }

    .fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: var(--space-3);
    }
    .fields-grid mat-form-field { width: 100%; }

    .upload-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px dashed var(--gray-200);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      margin: var(--space-2) 0 var(--space-5);
      cursor: pointer;
      transition: all var(--duration-base) var(--ease-out);
      min-height: 120px;
      background: var(--gray-50);
    }
    .upload-area:hover {
      border-color: var(--brand-accent);
      background: var(--brand-accent-subtle);
    }
    .upload-area.has-file {
      border-color: var(--success);
      border-style: solid;
      padding: var(--space-3);
    }
    .upload-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--gray-400);
      margin-bottom: var(--space-2);
    }
    .upload-text {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--gray-600);
    }
    .upload-hint {
      font-size: var(--text-xs);
      color: var(--gray-400);
      margin-top: var(--space-1);
    }
    .upload-preview {
      max-width: 100%;
      max-height: 180px;
      border-radius: var(--radius-md);
      object-fit: contain;
    }

    .submit-btn {
      width: 100%;
      height: 48px;
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      border-radius: var(--radius-md) !important;
    }
    .btn-spinner { display: inline-block; }

    .success-state {
      text-align: center;
      padding: var(--space-10) var(--space-5);
    }
    .success-icon-wrap {
      width: 72px;
      height: 72px;
      border-radius: var(--radius-full);
      background: var(--success-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto var(--space-4);
      animation: checkBounce 0.5s var(--ease-out);
    }
    .success-icon-wrap mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--success);
    }
    .success-state h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--gray-900);
    }
    .success-state p {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--gray-500);
    }

    @media (max-width: 600px) {
      .fields-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DailyEntryFormComponent implements OnInit {
  form: FormGroup;
  today = new Date();
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  submitting = false;
  alreadySubmitted = false;

  constructor(
    private fb: FormBuilder,
    private conglomeradoService: ConglomeradoService,
    private notification: NotificationService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      clientes: [null, [Validators.required, Validators.min(0)]],
      clientes_efectivos: [null, [Validators.required, Validators.min(0)]],
      menores: [null, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.conglomeradoService.checkToday().subscribe(res => {
      this.alreadySubmitted = res.data.submitted;
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || !this.selectedFile) return;

    this.submitting = true;
    const formData = new FormData();
    formData.append('clientes', this.form.value.clientes.toString());
    formData.append('clientes_efectivos', this.form.value.clientes_efectivos.toString());
    formData.append('menores', this.form.value.menores.toString());
    formData.append('soporte', this.selectedFile);

    this.conglomeradoService.submitEntry(formData).subscribe({
      next: () => {
        this.submitting = false;
        this.notification.success('Entrada enviada exitosamente');
        this.alreadySubmitted = true;
      },
      error: (err) => {
        this.submitting = false;
        this.notification.error(err.error?.error?.message || 'Error al enviar la entrada');
      },
    });
  }
}
