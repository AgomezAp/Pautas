import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-user-form',
  imports: [
    CommonModule, ReactiveFormsModule, IconComponent,
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent implements OnInit {
  @Input() data: { user?: any } = {};

  form!: FormGroup;
  isEdit = false;
  saving = false;
  roles: any[] = [];
  countries: any[] = [];
  campaigns: any[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notification: NotificationService,
    public activeModal: NgbActiveModal,
  ) {}

  ngOnInit(): void {
    this.isEdit = !!this.data.user;
    this.form = this.fb.group({
      username: [this.data.user?.username || '', Validators.required],
      full_name: [this.data.user?.full_name || '', Validators.required],
      email: [this.data.user?.email || ''],
      password: [''],
      role_id: [this.data.user?.role_id || null, Validators.required],
      country_id: [this.data.user?.country_id || null],
      campaign_id: [this.data.user?.campaign_id || null],
    });

    if (this.isEdit) {
      this.form.get('username')?.disable();
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    }

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
        this.activeModal.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err.error?.error?.message || 'Error al guardar');
      },
    });
  }
}
