import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../admin.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-country-list',
  imports: [
    CommonModule, FormsModule, IconComponent,
  ],
  templateUrl: './country-list.component.html',
  styleUrl: './country-list.component.scss',
})
export class CountryListComponent implements OnInit {
  allData: any[] = [];

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
      this.allData = res.data;
      this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingCountry = null;
    this.cdr.detectChanges();
  }

  save(): void {
    if (!this.formData.name.trim() || !this.formData.code.trim()) {
      this.formError = 'Nombre y c\u00f3digo son requeridos';
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
        this.cdr.detectChanges();
      },
    });
  }
}
