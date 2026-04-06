import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { GestionService } from '../gestion.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';

@Component({
  selector: 'app-gestion-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatIconModule, MatTableModule,
    MatTabsModule, MatFormFieldModule, MatSelectModule,
  ],
  template: `
    <div class="page-header">
      <h2>Dashboard - Gestión Administrativa</h2>
    </div>

    <div class="kpi-grid">
      @for (kpi of kpis; track kpi.label) {
        <mat-card class="kpi-card">
          <mat-card-content>
            <mat-icon>{{ kpi.icon }}</mat-icon>
            <div class="kpi-info">
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="kpi-label">{{ kpi.label }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <mat-card class="report-card">
      <mat-card-content>
        <mat-tab-group (selectedTabChange)="onReportTabChange($event.index)" animationDuration="200ms">
          <!-- Tab: Por País -->
          <mat-tab label="Por País">
            <ng-template matTabContent>
              <div class="tab-body">
                <table mat-table [dataSource]="countryReport" class="full-width">
                  <ng-container matColumnDef="country_name">
                    <th mat-header-cell *matHeaderCellDef>País</th>
                    <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_users">
                    <th mat-header-cell *matHeaderCellDef>Usuarios</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_users }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_entries">
                    <th mat-header-cell *matHeaderCellDef>Entradas</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_entries }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes">
                    <th mat-header-cell *matHeaderCellDef>Clientes</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes }}</td>
                  </ng-container>
                  <ng-container matColumnDef="effectiveness_rate">
                    <th mat-header-cell *matHeaderCellDef>Efectividad</th>
                    <td mat-cell *matCellDef="let row">{{ (row.effectiveness_rate * 100) | number:'1.1-1' }}%</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="countryColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: countryColumns;"></tr>
                </table>
              </div>
            </ng-template>
          </mat-tab>

          <!-- Tab: Efectividad -->
          <mat-tab label="Efectividad">
            <ng-template matTabContent>
              <div class="tab-body">
                <div class="filter-row">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>País</mat-label>
                    <mat-select [(ngModel)]="effectivenessCountryId" (selectionChange)="loadEffectiveness()">
                      <mat-option [value]="null">Todos</mat-option>
                      @for (c of countries; track c.id) {
                        <mat-option [value]="c.id">{{ c.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <table mat-table [dataSource]="effectivenessReport" class="full-width">
                  <ng-container matColumnDef="user_name">
                    <th mat-header-cell *matHeaderCellDef>Usuario</th>
                    <td mat-cell *matCellDef="let row">{{ row.user_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="campaign_name">
                    <th mat-header-cell *matHeaderCellDef>Campaña</th>
                    <td mat-cell *matCellDef="let row">{{ row.campaign_name || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="country_name">
                    <th mat-header-cell *matHeaderCellDef>País</th>
                    <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes">
                    <th mat-header-cell *matHeaderCellDef>Clientes</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes_efectivos">
                    <th mat-header-cell *matHeaderCellDef>Clientes Efectivos</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes_efectivos }}</td>
                  </ng-container>
                  <ng-container matColumnDef="effectiveness_rate">
                    <th mat-header-cell *matHeaderCellDef>Tasa Efectividad</th>
                    <td mat-cell *matCellDef="let row">{{ (row.effectiveness_rate * 100) | number:'1.1-1' }}%</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="effectivenessColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: effectivenessColumns;"></tr>
                </table>
                @if (effectivenessReport.length === 0) {
                  <div class="empty-state">
                    <mat-icon>bar_chart</mat-icon>
                    <p>No hay datos de efectividad</p>
                  </div>
                }
              </div>
            </ng-template>
          </mat-tab>

          <!-- Tab: Conversiones -->
          <mat-tab label="Conversiones">
            <ng-template matTabContent>
              <div class="tab-body">
                <div class="filter-row">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>País</mat-label>
                    <mat-select [(ngModel)]="conversionsCountryId" (selectionChange)="loadConversions()">
                      <mat-option [value]="null">Todos</mat-option>
                      @for (c of countries; track c.id) {
                        <mat-option [value]="c.id">{{ c.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <table mat-table [dataSource]="conversionReport" class="full-width">
                  <ng-container matColumnDef="campaign_name">
                    <th mat-header-cell *matHeaderCellDef>Campaña</th>
                    <td mat-cell *matCellDef="let row">{{ row.campaign_name || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="country_name">
                    <th mat-header-cell *matHeaderCellDef>País</th>
                    <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes">
                    <th mat-header-cell *matHeaderCellDef>Clientes</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_conversions">
                    <th mat-header-cell *matHeaderCellDef>Conversiones</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_conversions }}</td>
                  </ng-container>
                  <ng-container matColumnDef="conversion_rate">
                    <th mat-header-cell *matHeaderCellDef>Tasa Conversión</th>
                    <td mat-cell *matCellDef="let row">{{ (row.conversion_rate * 100) | number:'1.1-1' }}%</td>
                  </ng-container>
                  <ng-container matColumnDef="total_cost">
                    <th mat-header-cell *matHeaderCellDef>Costo Total</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_cost | number:'1.2-2' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="conversionColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: conversionColumns;"></tr>
                </table>
                @if (conversionReport.length === 0) {
                  <div class="empty-state">
                    <mat-icon>swap_horiz</mat-icon>
                    <p>No hay datos de conversiones</p>
                  </div>
                }
              </div>
            </ng-template>
          </mat-tab>

          <!-- Tab: Tendencia Semanal -->
          <mat-tab label="Tendencia Semanal">
            <ng-template matTabContent>
              <div class="tab-body">
                <div class="filter-row">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>País</mat-label>
                    <mat-select [(ngModel)]="weeklyCountryId" (selectionChange)="loadWeekly()">
                      <mat-option [value]="null">Todos</mat-option>
                      @for (c of countries; track c.id) {
                        <mat-option [value]="c.id">{{ c.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <table mat-table [dataSource]="weeklyReport" class="full-width">
                  <ng-container matColumnDef="week_label">
                    <th mat-header-cell *matHeaderCellDef>Semana</th>
                    <td mat-cell *matCellDef="let row">{{ row.iso_year }}-S{{ row.iso_week }}</td>
                  </ng-container>
                  <ng-container matColumnDef="users_reporting">
                    <th mat-header-cell *matHeaderCellDef>Usuarios</th>
                    <td mat-cell *matCellDef="let row">{{ row.users_reporting }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes">
                    <th mat-header-cell *matHeaderCellDef>Clientes</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_clientes_efectivos">
                    <th mat-header-cell *matHeaderCellDef>Clientes Efectivos</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_clientes_efectivos }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_menores">
                    <th mat-header-cell *matHeaderCellDef>Menores</th>
                    <td mat-cell *matCellDef="let row">{{ row.total_menores }}</td>
                  </ng-container>
                  <ng-container matColumnDef="effectiveness_rate">
                    <th mat-header-cell *matHeaderCellDef>Efectividad</th>
                    <td mat-cell *matCellDef="let row">{{ (row.effectiveness_rate * 100) | number:'1.1-1' }}%</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="weeklyColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: weeklyColumns;"></tr>
                </table>
                @if (weeklyReport.length === 0) {
                  <div class="empty-state">
                    <mat-icon>show_chart</mat-icon>
                    <p>No hay datos de tendencia semanal</p>
                  </div>
                }
              </div>
            </ng-template>
          </mat-tab>
        </mat-tab-group>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h2 {
      margin: 0 0 4px 0;
      color: var(--gray-900);
      position: relative;
      padding-bottom: var(--space-2);
      display: inline-block;
    }
    .page-header h2::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 40px;
      height: 3px;
      background: var(--brand-accent);
      border-radius: var(--radius-full);
    }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { border-left: 3px solid var(--brand-accent) !important; }
    .kpi-card mat-card-content { display: flex; align-items: center; gap: 12px; padding: 16px; }
    .kpi-card mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--brand-accent); }
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-value { font-size: 24px; font-weight: var(--weight-bold); color: var(--gray-900); }
    .kpi-label { font-size: 12px; color: var(--gray-500); }
    .report-card { margin-top: 16px; }
    .full-width { width: 100%; }
    .tab-body { padding-top: 16px; }
    .filter-row { display: flex; gap: 12px; margin-bottom: 8px; }
    .filter-field { min-width: 180px; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 16px;
      color: var(--gray-500);
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    .empty-state p { margin: 0; font-size: 14px; }
  `]
})
export class GestionDashboardComponent implements OnInit {
  kpis: { label: string; value: string; icon: string }[] = [];

  // Por País
  countryReport: any[] = [];
  countryColumns = ['country_name', 'total_users', 'total_entries', 'total_clientes', 'effectiveness_rate'];

  // Efectividad
  effectivenessReport: any[] = [];
  effectivenessColumns = ['user_name', 'campaign_name', 'country_name', 'total_clientes', 'total_clientes_efectivos', 'effectiveness_rate'];
  effectivenessCountryId: number | null = null;

  // Conversiones
  conversionReport: any[] = [];
  conversionColumns = ['campaign_name', 'country_name', 'total_clientes', 'total_conversions', 'conversion_rate', 'total_cost'];
  conversionsCountryId: number | null = null;

  // Tendencia Semanal
  weeklyReport: any[] = [];
  weeklyColumns = ['week_label', 'users_reporting', 'total_clientes', 'total_clientes_efectivos', 'total_menores', 'effectiveness_rate'];
  weeklyCountryId: number | null = null;

  countries: Country[] = [];

  constructor(
    private gestionService: GestionService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });

    this.gestionService.getDashboardKpis().subscribe(res => {
      const d = res.data;
      this.kpis = [
        { label: 'Total Clientes', value: d.total_clientes?.toLocaleString() || '0', icon: 'people' },
        { label: 'Clientes Efectivos', value: d.total_clientes_efectivos?.toLocaleString() || '0', icon: 'verified' },
        { label: 'Tasa Efectividad', value: ((d.effectiveness_rate || 0) * 100).toFixed(1) + '%', icon: 'trending_up' },
        { label: 'Usuarios Reportando', value: d.users_reporting?.toString() || '0', icon: 'group' },
      ];
      this.cdr.markForCheck();
    });

    this.gestionService.getByCountryReport().subscribe(res => {
      this.countryReport = res.data;
      this.cdr.markForCheck();
    });
  }

  onReportTabChange(index: number): void {
    if (index === 1 && this.effectivenessReport.length === 0) this.loadEffectiveness();
    if (index === 2 && this.conversionReport.length === 0) this.loadConversions();
    if (index === 3 && this.weeklyReport.length === 0) this.loadWeekly();
  }

  loadEffectiveness(): void {
    const params: any = {};
    if (this.effectivenessCountryId) params.country_id = this.effectivenessCountryId;
    this.gestionService.getEffectivenessReport(params).subscribe(res => {
      this.effectivenessReport = res.data;
      this.cdr.markForCheck();
    });
  }

  loadConversions(): void {
    const params: any = {};
    if (this.conversionsCountryId) params.country_id = this.conversionsCountryId;
    this.gestionService.getConversionReport(params).subscribe(res => {
      this.conversionReport = res.data;
      this.cdr.markForCheck();
    });
  }

  loadWeekly(): void {
    const params: any = {};
    if (this.weeklyCountryId) params.country_id = this.weeklyCountryId;
    this.gestionService.getByWeekReport(params).subscribe(res => {
      this.weeklyReport = res.data;
      this.cdr.markForCheck();
    });
  }
}
