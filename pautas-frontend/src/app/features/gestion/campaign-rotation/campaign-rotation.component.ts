import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-campaign-rotation',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    NgbTooltipModule, IconComponent, PaginationComponent,
  ],
  templateUrl: './campaign-rotation.component.html',
  styleUrl: './campaign-rotation.component.scss',
})
export class CampaignRotationComponent implements OnInit {
  rotationForm!: FormGroup;
  countries: any[] = [];
  campaigns: any[] = [];
  availableUsers: any[] = [];
  rotationHistory: any[] = [];
  totalRotations = 0;
  currentPage = 1;
  submitting = false;
  selectedCountryId = 0;
  selectedCampaign: any = null;
  swapWarning = '';

  constructor(
    private fb: FormBuilder,
    private gestionService: GestionService,
    private countryService: CountryService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.rotationForm = this.fb.group({
      campaign_id: [null, Validators.required],
      new_user_id: [null, Validators.required],
      reason: [''],
      effective_date: [new Date().toISOString().split('T')[0]],
    });

    // Watch new_user_id changes to show swap warning
    this.rotationForm.get('new_user_id')?.valueChanges.subscribe(userId => {
      this.updateSwapWarning(userId);
    });

    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });

    this.loadCampaigns();
    this.loadAvailableUsers();
    this.loadRotationHistory();
  }

  onCountryFilterChange(): void {
    const id = this.selectedCountryId || undefined;
    this.loadCampaigns(id);
    this.loadAvailableUsers(id);
  }

  selectCampaignForRotation(campaign: any): void {
    this.selectedCampaign = campaign;
    this.rotationForm.patchValue({ campaign_id: campaign.id });
    // Load users for the same country as the campaign
    this.loadAvailableUsers(campaign.country_id);
  }

  onCampaignSelected(campaignId: number): void {
    const camp = this.campaigns.find((c: any) => c.id === campaignId);
    this.selectedCampaign = camp || null;
    if (camp) {
      this.loadAvailableUsers(camp.country_id);
    }
  }

  updateSwapWarning(userId: number): void {
    if (!userId) {
      this.swapWarning = '';
      return;
    }
    const user = this.availableUsers.find((u: any) => u.id === userId);
    if (user?.current_campaign_name) {
      this.swapWarning = `Este usuario ya tiene asignada la campana "${user.current_campaign_name}". Se realizara un INTERCAMBIO: ambos usuarios cambiaran de campana.`;
    } else {
      this.swapWarning = '';
    }
  }

  loadCampaigns(countryId?: number): void {
    this.gestionService.getActiveCampaigns(countryId).subscribe(res => {
      this.campaigns = res.data;
      this.cdr.detectChanges();
    });
  }

  loadAvailableUsers(countryId?: number): void {
    this.gestionService.getAvailableUsers(countryId).subscribe(res => {
      this.availableUsers = res.data;
      this.cdr.detectChanges();
    });
  }

  loadRotationHistory(): void {
    this.gestionService.getRotationHistory({ page: this.currentPage, limit: 10 }).subscribe(res => {
      this.rotationHistory = res.data;
      this.totalRotations = res.meta?.total || 0;
      this.cdr.detectChanges();
    });
  }

  submitRotation(): void {
    if (this.rotationForm.invalid) return;
    this.submitting = true;

    const formValue = this.rotationForm.value;
    const data = {
      campaign_id: formValue.campaign_id,
      new_user_id: formValue.new_user_id,
      reason: formValue.reason || undefined,
      effective_date: formValue.effective_date || undefined,
    };

    this.gestionService.rotateCampaign(data).subscribe({
      next: (res) => {
        const result = res.data;
        if (result.swap?.swapped) {
          this.notification.success(
            `Intercambio realizado: "${result.campaign_name}" ahora con ${result.new_user_name}` +
            ` y "${result.swap.swapped_campaign_name}" paso a ${result.previous_user_name}`
          );
        } else {
          this.notification.success(`Rotacion registrada: "${result.campaign_name}" ahora asignada a ${result.new_user_name}`);
        }
        this.rotationForm.reset({ effective_date: new Date().toISOString().split('T')[0] });
        this.selectedCampaign = null;
        this.swapWarning = '';
        this.loadCampaigns(this.selectedCountryId || undefined);
        this.loadAvailableUsers(this.selectedCountryId || undefined);
        this.loadRotationHistory();
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.currentPage = event.page;
    this.loadRotationHistory();
  }
}
