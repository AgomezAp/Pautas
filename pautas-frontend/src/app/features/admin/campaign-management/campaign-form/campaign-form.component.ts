import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-campaign-form',
  imports: [
    CommonModule, ReactiveFormsModule, IconComponent,
  ],
  templateUrl: './campaign-form.component.html',
  styleUrl: './campaign-form.component.scss',
})
export class CampaignFormComponent implements OnInit {
  @Input() data: { campaign?: any } = {};

  form!: FormGroup;
  isEdit = false;
  saving = false;
  countries: any[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private notification: NotificationService,
    public activeModal: NgbActiveModal,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isEdit = !!this.data.campaign;
    this.form = this.fb.group({
      name: [this.data.campaign?.name || '', Validators.required],
      google_ads_campaign_id: [this.data.campaign?.google_ads_campaign_id || ''],
      country_id: [this.data.campaign?.country_id || null, Validators.required],
      campaign_url: [this.data.campaign?.campaign_url || ''],
    });

    this.adminService.getCountries().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
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
        this.notification.success(this.isEdit ? 'Campa\u00f1a actualizada' : 'Campa\u00f1a creada');
        this.activeModal.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err.error?.error?.message || 'Error al guardar');
        this.cdr.detectChanges();
      },
    });
  }
}
