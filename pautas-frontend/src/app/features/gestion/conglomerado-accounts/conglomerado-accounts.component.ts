import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { GestionService } from '../gestion.service';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Country } from '../../../core/models/country.model';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';

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
    CommonModule, FormsModule, NgbTooltipModule,
    GoogleAdsIdPipe, IconComponent,
  ],
  templateUrl: './conglomerado-accounts.component.html',
  styleUrl: './conglomerado-accounts.component.scss',
})
export class ConglomeradoAccountsComponent implements OnInit {
  users: ConglomeradoUser[] = [];
  countries: Country[] = [];
  selectedCountryId = 0;
  loading = false;
  saving = false;

  editingUserId: number | null = null;
  editValue = '';

  // Password reset
  resettingPasswordUserId: number | null = null;
  newPassword = '';
  resettingPassword = false;

  constructor(
    private http: HttpClient,
    private countryService: CountryService,
    private gestionService: GestionService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.cdr.detectChanges();

    let params = new HttpParams();
    if (this.selectedCountryId) {
      params = params.set('country_id', this.selectedCountryId);
    }

    this.http.get<ApiResponse<ConglomeradoUser[]>>(API_URLS.gestion.conglomeradoUsers, { params }).subscribe({
      next: (res) => {
        this.users = res.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notification.error('Error al cargar los miembros del conglomerado');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  startEdit(user: ConglomeradoUser): void {
    this.editingUserId = user.id;
    this.editValue = user.google_ads_account_id || '';
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.editValue = '';
    this.cdr.detectChanges();
  }

  saveAccountId(user: ConglomeradoUser): void {
    const cleanValue = this.editValue.replace(/\D/g, '');

    if (cleanValue && cleanValue.length !== 10) {
      this.notification.error('El ID de cuenta debe tener 10 digitos');
      return;
    }

    this.saving = true;
    this.cdr.detectChanges();

    const url = API_URLS.gestion.conglomeradoUsers + '/' + user.id + '/google-ads-account';
    this.http.patch<ApiResponse<any>>(url, { google_ads_account_id: cleanValue || null }).subscribe({
      next: () => {
        user.google_ads_account_id = cleanValue || null;
        this.editingUserId = null;
        this.editValue = '';
        this.saving = false;
        this.notification.success('Cuenta de Google Ads actualizada');
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.notification.error('Error al actualizar la cuenta de Google Ads');
        this.cdr.detectChanges();
      },
    });
  }

  // ===== Password Reset =====
  startPasswordReset(user: ConglomeradoUser): void {
    this.resettingPasswordUserId = user.id;
    this.newPassword = '';
    this.cdr.detectChanges();
  }

  cancelPasswordReset(): void {
    this.resettingPasswordUserId = null;
    this.newPassword = '';
    this.cdr.detectChanges();
  }

  confirmResetPassword(user: ConglomeradoUser): void {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.notification.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.resettingPassword = true;
    this.cdr.detectChanges();

    this.gestionService.resetPassword(user.id, this.newPassword).subscribe({
      next: () => {
        this.notification.success(`Contraseña de "${user.full_name}" restablecida exitosamente`);
        this.resettingPasswordUserId = null;
        this.newPassword = '';
        this.resettingPassword = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.notification.error(err.error?.error?.message || 'Error al restablecer la contraseña');
        this.resettingPassword = false;
        this.cdr.detectChanges();
      },
    });
  }
}
