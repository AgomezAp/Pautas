import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { API_URLS } from '../../../core/constants/api-urls';

interface Master {
  id: number;
  full_name: string;
  email: string;
  country_name: string;
  avg_rating: number | null;
  total_records: number;
}

interface Evaluation {
  id: number;
  type: 'evaluation' | 'incident' | 'campaign_change' | 'phone_history';
  title: string;
  description: string;
  numeric_rating: number | null;
  phone_number: string | null;
  campaign_change_date: string | null;
  created_by_name: string;
  created_at: string;
}

type EvalType = 'evaluation' | 'incident' | 'campaign_change' | 'phone_history';

@Component({
  selector: 'app-master-profiles',
  imports: [CommonModule, FormsModule],
  templateUrl: './master-profiles.component.html',
  styleUrl: './master-profiles.component.scss',
})
export class MasterProfilesComponent implements OnInit {
  masters: Master[] = [];
  selectedMaster: Master | null = null;
  evaluations: Evaluation[] = [];

  loadingMasters = false;
  loadingEvals = false;

  /** New evaluation form */
  showForm = false;
  formType: EvalType = 'evaluation';
  formTitle = '';
  formDescription = '';
  formRating: number | null = null;
  formPhone = '';
  formChangeDate = '';
  formSubmitting = false;
  formError = '';

  readonly TYPE_LABELS: Record<EvalType, string> = {
    evaluation: 'Evaluación',
    incident: 'Incidente',
    campaign_change: 'Cambio de Campaña',
    phone_history: 'Historial Telefónico',
  };

  readonly TYPE_ICONS: Record<string, string> = {
    evaluation: 'star',
    incident: 'warning',
    campaign_change: 'campaign',
    phone_history: 'phone',
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadMasters();
  }

  loadMasters(): void {
    this.loadingMasters = true;
    this.http.get<any>(API_URLS.gestion.masters).subscribe({
      next: res => {
        this.masters = res.data || [];
        this.loadingMasters = false;
      },
      error: () => { this.loadingMasters = false; }
    });
  }

  selectMaster(master: Master): void {
    this.selectedMaster = master;
    this.showForm = false;
    this.loadEvaluations(master.id);
  }

  loadEvaluations(masterId: number): void {
    this.loadingEvals = true;
    this.http.get<any>(API_URLS.gestion.masterEvaluations(masterId)).subscribe({
      next: res => {
        this.evaluations = res.data || [];
        this.loadingEvals = false;
      },
      error: () => { this.loadingEvals = false; }
    });
  }

  openForm(): void {
    this.showForm = true;
    this.formType = 'evaluation';
    this.formTitle = '';
    this.formDescription = '';
    this.formRating = null;
    this.formPhone = '';
    this.formChangeDate = '';
    this.formError = '';
  }

  cancelForm(): void {
    this.showForm = false;
  }

  submitEvaluation(): void {
    if (!this.selectedMaster) return;
    if (!this.formTitle.trim() || !this.formDescription.trim()) {
      this.formError = 'El título y la descripción son obligatorios.';
      return;
    }
    this.formSubmitting = true;
    this.formError = '';

    const payload: any = {
      type: this.formType,
      title: this.formTitle,
      description: this.formDescription,
    };
    if (this.formType === 'evaluation' && this.formRating !== null) {
      payload.numericRating = this.formRating;
    }
    if (this.formType === 'phone_history' && this.formPhone) {
      payload.phoneNumber = this.formPhone;
    }
    if (this.formType === 'campaign_change' && this.formChangeDate) {
      payload.campaignChangeDate = this.formChangeDate;
    }

    this.http.post<any>(API_URLS.gestion.masterEvaluations(this.selectedMaster.id), payload).subscribe({
      next: () => {
        this.formSubmitting = false;
        this.showForm = false;
        this.loadEvaluations(this.selectedMaster!.id);
        // Refresh avg rating
        const idx = this.masters.findIndex(m => m.id === this.selectedMaster!.id);
        if (idx >= 0) this.masters[idx].total_records++;
      },
      error: err => {
        this.formSubmitting = false;
        this.formError = err?.error?.message || 'Error al guardar el registro.';
      }
    });
  }

  deleteEvaluation(evalId: number): void {
    if (!confirm('¿Eliminar este registro de la hoja de vida?')) return;
    this.http.delete<any>(API_URLS.gestion.deleteEvaluation(evalId)).subscribe({
      next: () => {
        this.evaluations = this.evaluations.filter(e => e.id !== evalId);
        if (this.selectedMaster) {
          const idx = this.masters.findIndex(m => m.id === this.selectedMaster!.id);
          if (idx >= 0 && this.masters[idx].total_records > 0) this.masters[idx].total_records--;
        }
      },
      error: () => {}
    });
  }

  ratingStars(rating: number | null): string {
    if (!rating) return '—';
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(Math.max(0, 10 - Math.round(rating)));
  }
}
