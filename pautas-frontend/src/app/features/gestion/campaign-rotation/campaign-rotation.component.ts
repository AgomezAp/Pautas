import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-campaign-rotation',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTableModule, MatPaginatorModule, MatDatepickerModule,
    MatNativeDateModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <h2>Rotación de Campañas</h2>

    <!-- Current Assignments Table -->
    <mat-card class="assignments-card">
      <mat-card-header>
        <mat-card-title>Asignaciones Actuales</mat-card-title>
        <mat-card-subtitle>Campañas activas y sus usuarios conglomerado asignados</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filtrar por país</mat-label>
            <mat-select [(value)]="selectedCountryId" (selectionChange)="onCountryFilterChange()">
              <mat-option [value]="0">Todos los países</mat-option>
              @for (country of countries; track country.id) {
                <mat-option [value]="country.id">{{ country.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <table mat-table [dataSource]="campaigns" class="full-width">
          <ng-container matColumnDef="country_name">
            <th mat-header-cell *matHeaderCellDef>País</th>
            <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Campaña</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="assigned_user_name">
            <th mat-header-cell *matHeaderCellDef>Usuario Asignado</th>
            <td mat-cell *matCellDef="let row">
              @if (row.assigned_user_name) {
                <span class="user-assigned">{{ row.assigned_user_name }}</span>
              } @else {
                <span class="user-unassigned">Sin asignar</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acción</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary"
                      matTooltip="Rotar esta campaña"
                      (click)="selectCampaignForRotation(row)">
                <mat-icon>swap_horiz</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="campaignColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: campaignColumns;"
              [class.selected-row]="rotationForm.get('campaign_id')?.value === row.id"></tr>
        </table>
      </mat-card-content>
    </mat-card>

    <!-- Rotation Form -->
    <mat-card class="rotation-form-card">
      <mat-card-header>
        <mat-card-title>Registrar Rotación</mat-card-title>
        <mat-card-subtitle>
          @if (selectedCampaign) {
            Reasignar "{{ selectedCampaign.name }}" ({{ selectedCampaign.country_name }})
            @if (selectedCampaign.assigned_user_name) {
              — actualmente asignada a {{ selectedCampaign.assigned_user_name }}
            }
          } @else {
            Seleccione una campaña de la tabla o del selector
          }
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="rotationForm" (ngSubmit)="submitRotation()" class="rotation-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Campaña a rotar</mat-label>
              <mat-select formControlName="campaign_id" (selectionChange)="onCampaignSelected($event.value)">
                @for (camp of campaigns; track camp.id) {
                  <mat-option [value]="camp.id">
                    {{ camp.name }} ({{ camp.country_code }})
                    @if (camp.assigned_user_name) {
                      — {{ camp.assigned_user_name }}
                    }
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Nuevo usuario asignado</mat-label>
              <mat-select formControlName="new_user_id">
                @for (user of availableUsers; track user.id) {
                  <mat-option [value]="user.id">
                    {{ user.full_name }} ({{ user.country_name }})
                    @if (user.current_campaign_name) {
                      <span class="has-campaign"> — tiene: {{ user.current_campaign_name }}</span>
                    } @else {
                      <span class="no-campaign"> — sin campaña</span>
                    }
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          @if (swapWarning) {
            <div class="swap-warning">
              <mat-icon>info</mat-icon>
              <span>{{ swapWarning }}</span>
            </div>
          }

          <div class="form-row">
            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Fecha efectiva</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="effective_date">
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field">
              <mat-label>Razón de la rotación</mat-label>
              <input matInput formControlName="reason"
                     placeholder="Ej: Cambio de turno, reasignación...">
            </mat-form-field>
          </div>

          <button mat-raised-button color="primary" type="submit"
                  [disabled]="rotationForm.invalid || submitting">
            <mat-icon>swap_horiz</mat-icon>
            {{ submitting ? 'Procesando...' : (swapWarning ? 'Intercambiar Campañas' : 'Registrar Rotación') }}
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    <!-- Rotation History -->
    <mat-card class="history-card">
      <mat-card-header>
        <mat-card-title>Historial de Rotaciones</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="rotationHistory" class="full-width">
          <ng-container matColumnDef="effective_date">
            <th mat-header-cell *matHeaderCellDef>Fecha</th>
            <td mat-cell *matCellDef="let row">{{ row.effective_date | date:'dd/MM/yyyy' }}</td>
          </ng-container>
          <ng-container matColumnDef="campaign_name">
            <th mat-header-cell *matHeaderCellDef>Campaña</th>
            <td mat-cell *matCellDef="let row">{{ row.campaign_name }}</td>
          </ng-container>
          <ng-container matColumnDef="country_name">
            <th mat-header-cell *matHeaderCellDef>País</th>
            <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
          </ng-container>
          <ng-container matColumnDef="previous_user_name">
            <th mat-header-cell *matHeaderCellDef>De</th>
            <td mat-cell *matCellDef="let row">{{ row.previous_user_name || '(sin asignar)' }}</td>
          </ng-container>
          <ng-container matColumnDef="new_user_name">
            <th mat-header-cell *matHeaderCellDef>A</th>
            <td mat-cell *matCellDef="let row">{{ row.new_user_name }}</td>
          </ng-container>
          <ng-container matColumnDef="rotated_by_name">
            <th mat-header-cell *matHeaderCellDef>Registrado por</th>
            <td mat-cell *matCellDef="let row">{{ row.rotated_by_name }}</td>
          </ng-container>
          <ng-container matColumnDef="reason">
            <th mat-header-cell *matHeaderCellDef>Razón</th>
            <td mat-cell *matCellDef="let row">{{ row.reason || '—' }}</td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="historyColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: historyColumns;"
              [class.swap-row]="row.reason?.startsWith('[INTERCAMBIO]')"></tr>
        </table>

        <mat-paginator [length]="totalRotations" [pageSize]="10"
                       [pageSizeOptions]="[5, 10, 25]"
                       (page)="onPageChange($event)">
        </mat-paginator>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    h2 { margin: 0 0 24px; color: var(--gray-900); position: relative; padding-bottom: var(--space-2); display: inline-block; }
    h2::after { content: ''; position: absolute; bottom: 0; left: 0; width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full); }
    .assignments-card { margin-bottom: 24px; }
    .filter-row { padding: 12px 0 0; }
    .filter-field { min-width: 250px; }
    .user-assigned { color: var(--gray-900); font-weight: var(--weight-semibold); }
    .user-unassigned { color: var(--gray-500); font-style: italic; }
    .selected-row { background: var(--brand-accent-subtle) !important; }
    .rotation-form-card { margin-bottom: 24px; border-left: 3px solid var(--brand-accent) !important; }
    .rotation-form { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; }
    .form-row { display: flex; gap: 16px; }
    .form-field { flex: 1; }
    .has-campaign { color: var(--warning); font-size: 12px; }
    .no-campaign { color: var(--success); font-size: 12px; }
    .swap-warning {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255, 214, 0, 0.12); color: var(--gray-900);
      padding: 10px 16px; border-radius: var(--radius-md);
      font-size: 13px; margin: 4px 0;
      border-left: 3px solid var(--brand-accent);
    }
    .swap-warning mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--brand-accent-hover); }
    .history-card { margin-top: 16px; }
    .full-width { width: 100%; }
    .swap-row { background: rgba(255, 214, 0, 0.06); }
  `]
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

  campaignColumns = ['country_name', 'name', 'assigned_user_name', 'actions'];
  historyColumns = [
    'effective_date', 'campaign_name', 'country_name',
    'previous_user_name', 'new_user_name', 'rotated_by_name', 'reason'
  ];

  constructor(
    private fb: FormBuilder,
    private gestionService: GestionService,
    private countryService: CountryService,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.rotationForm = this.fb.group({
      campaign_id: [null, Validators.required],
      new_user_id: [null, Validators.required],
      reason: [''],
      effective_date: [new Date()],
    });

    // Watch new_user_id changes to show swap warning
    this.rotationForm.get('new_user_id')?.valueChanges.subscribe(userId => {
      this.updateSwapWarning(userId);
    });

    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
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
      this.swapWarning = `Este usuario ya tiene asignada la campaña "${user.current_campaign_name}". Se realizará un INTERCAMBIO: ambos usuarios cambiarán de campaña.`;
    } else {
      this.swapWarning = '';
    }
  }

  loadCampaigns(countryId?: number): void {
    this.gestionService.getActiveCampaigns(countryId).subscribe(res => {
      this.campaigns = res.data;
    });
  }

  loadAvailableUsers(countryId?: number): void {
    this.gestionService.getAvailableUsers(countryId).subscribe(res => {
      this.availableUsers = res.data;
    });
  }

  loadRotationHistory(): void {
    this.gestionService.getRotationHistory({ page: this.currentPage, limit: 10 }).subscribe(res => {
      this.rotationHistory = res.data;
      this.totalRotations = res.meta?.total || 0;
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
      effective_date: formValue.effective_date
        ? new Date(formValue.effective_date).toISOString().split('T')[0]
        : undefined,
    };

    this.gestionService.rotateCampaign(data).subscribe({
      next: (res) => {
        const result = res.data;
        if (result.swap?.swapped) {
          this.notification.success(
            `Intercambio realizado: "${result.campaign_name}" ahora con ${result.new_user_name}` +
            ` y "${result.swap.swapped_campaign_name}" pasó a ${result.previous_user_name}`
          );
        } else {
          this.notification.success(`Rotación registrada: "${result.campaign_name}" ahora asignada a ${result.new_user_name}`);
        }
        this.rotationForm.reset({ effective_date: new Date() });
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

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.loadRotationHistory();
  }
}
