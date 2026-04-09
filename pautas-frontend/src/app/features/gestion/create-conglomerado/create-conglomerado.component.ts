import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-create-conglomerado',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, IconComponent,
  ],
  templateUrl: './create-conglomerado.component.html',
  styleUrl: './create-conglomerado.component.scss',
})
export class CreateConglomeradoComponent implements OnInit {
  form!: FormGroup;
  countries: any[] = [];
  campaigns: any[] = [];
  filteredCampaigns: any[] = [];
  users: any[] = [];
  submitting = false;
  loadingUsers = false;
  filterCountryId: number | undefined;

  constructor(
    private fb: FormBuilder,
    private gestionService: GestionService,
    private countryService: CountryService,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      full_name: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', Validators.email],
      password: ['', Validators.minLength(8)],
      country_id: [null, Validators.required],
      campaign_id: [null],
    });

    this.loadCountries();
    this.loadCampaigns();
    this.loadUsers();
  }

  loadCountries(): void {
    this.countryService.getAll().subscribe({
      next: (res: any) => {
        this.countries = res.data || [];
      },
    });
  }

  loadCampaigns(): void {
    this.gestionService.getActiveCampaigns().subscribe({
      next: (res: any) => this.campaigns = res.data || [],
    });
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.gestionService.getConglomeradoUsers(this.filterCountryId).subscribe({
      next: (res: any) => {
        this.users = res.data || [];
        this.loadingUsers = false;
      },
      error: () => { this.loadingUsers = false; },
    });
  }

  onCountryChange(): void {
    const countryId = this.form.get('country_id')?.value;
    this.filteredCampaigns = countryId
      ? this.campaigns.filter(c => c.country_id === countryId)
      : this.campaigns;
    this.form.get('campaign_id')?.setValue(null);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting = true;

    const data = { ...this.form.value };
    if (!data.email) delete data.email;
    if (!data.password) delete data.password;
    if (!data.campaign_id) delete data.campaign_id;

    this.gestionService.createConglomeradoUser(data).subscribe({
      next: () => {
        this.notification.success('Conglomerado registrado exitosamente');
        this.form.reset();
        this.submitting = false;
        this.loadUsers();
      },
      error: (err: any) => {
        this.notification.error(err.error?.error?.message || 'Error al registrar conglomerado');
        this.submitting = false;
      },
    });
  }
}
