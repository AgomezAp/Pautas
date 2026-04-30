import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConglomeradoService } from '../conglomerado.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-daily-entry-form',
  imports: [
    CommonModule, ReactiveFormsModule,
    IconComponent,
  ],
  templateUrl: './daily-entry-form.component.html',
  styleUrl: './daily-entry-form.component.scss',
})
export class DailyEntryFormComponent implements OnInit {
  form: FormGroup;
  today = new Date();
  // Soporte images
  selectedFiles: File[] = [];
  imagePreviews: string[] = [];
  // Comprobantes de pago (vouchers)
  selectedVouchers: File[] = [];
  voucherPreviews: string[] = [];
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
      cierre: [null, [Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.conglomeradoService.checkToday().subscribe(res => {
      this.alreadySubmitted = res.data.submitted;
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      for (const file of newFiles) {
        if (this.selectedFiles.length >= 10) break;
        this.selectedFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => { this.imagePreviews.push(e.target?.result as string); };
        reader.readAsDataURL(file);
      }
      input.value = '';
    }
  }

  onVouchersSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      for (const file of newFiles) {
        if (this.selectedVouchers.length >= 10) break;
        this.selectedVouchers.push(file);
        const reader = new FileReader();
        reader.onload = (e) => { this.voucherPreviews.push(e.target?.result as string); };
        reader.readAsDataURL(file);
      }
      input.value = '';
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.imagePreviews.splice(index, 1);
  }

  removeVoucher(index: number): void {
    this.selectedVouchers.splice(index, 1);
    this.voucherPreviews.splice(index, 1);
  }

  onSubmit(): void {
    if (this.form.invalid || this.selectedFiles.length === 0) return;

    this.submitting = true;
    const formData = new FormData();
    formData.append('clientes', this.form.value.clientes.toString());
    formData.append('clientes_efectivos', this.form.value.clientes_efectivos.toString());
    formData.append('menores', this.form.value.menores.toString());
    if (this.form.value.cierre !== null && this.form.value.cierre !== '') {
      formData.append('cierre', this.form.value.cierre.toString());
    }
    for (const file of this.selectedFiles) {
      formData.append('soporte', file);
    }
    for (const voucher of this.selectedVouchers) {
      formData.append('vouchers', voucher);
    }

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
