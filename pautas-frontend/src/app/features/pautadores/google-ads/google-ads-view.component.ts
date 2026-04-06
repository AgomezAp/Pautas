import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { GoogleAdsService } from './google-ads.service';
import { CountryService } from '../../../core/services/country.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleAdsIdPipe } from '../../../shared/pipes/google-ads-id.pipe';

@Component({
  selector: 'app-google-ads-view',
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatTabsModule,
    MatPaginatorModule, MatTooltipModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule,
    GoogleAdsIdPipe,
  ],
  template: `
    <div class="page-header">
      <div>
        <h1>Google Ads</h1>
        <p class="page-subtitle">Cuentas y recargas</p>
      </div>
      @if (isAdmin) {
        <button mat-flat-button class="sync-btn" (click)="syncNow()" [disabled]="syncing">
          @if (syncing) {
            <mat-spinner diameter="18" class="sync-spinner"></mat-spinner>
            <span>Sincronizando...</span>
          } @else {
            <ng-container>
              <mat-icon>sync</mat-icon>
              <span>Sincronizar Ahora</span>
            </ng-container>
          }
        </button>
      }
    </div>

    <div class="tabs-wrapper">
      <mat-tab-group (selectedTabChange)="onTabChange($event)" [selectedIndex]="activeTab">

        <!-- ===== TAB 1: Cuentas (campañas agrupadas por cuenta) ===== -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">account_balance_wallet</mat-icon> Cuentas
          </ng-template>
          <div class="tab-body">
            <div class="tab-toolbar">
              <mat-form-field appearance="outline" class="filter-select">
                <mat-label>País</mat-label>
                <mat-select [(value)]="accountsCountryId" (selectionChange)="loadAccounts()">
                  <mat-option [value]="0">Todos</mat-option>
                  @for (country of countries; track country.id) {
                    <mat-option [value]="country.id">{{ country.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-search">
                <mat-label>Buscar cuenta o campaña</mat-label>
                <input matInput [(ngModel)]="accountSearch" (keyup)="filterAccounts()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              @if (isPautador) {
                <button mat-stroked-button class="toggle-mine-btn" (click)="toggleShowMine()" [class.active]="showOnlyMine">
                  <mat-icon>{{ showOnlyMine ? 'person' : 'groups' }}</mat-icon>
                  {{ showOnlyMine ? 'Mis cuentas' : 'Todas' }}
                </button>
              }
              <span class="record-count">{{ filteredAccounts.length }} cuentas · {{ totalAccountCampaigns }} campañas</span>
            </div>

            @if (!accountsLoaded) {
              <div class="loading-state">
                <mat-spinner diameter="32"></mat-spinner>
                <span>Cargando cuentas...</span>
              </div>
            } @else if (filteredAccounts.length === 0) {
              <div class="empty-state">
                <mat-icon>account_balance</mat-icon>
                <p>No se encontraron cuentas</p>
                @if (!hasAccountData) {
                  <p class="empty-hint">Presiona "Sincronizar Ahora" para asociar campañas con sus cuentas de Google Ads</p>
                }
              </div>
            } @else {
              <div class="accounts-list">
                @for (account of filteredAccounts; track account.customer_account_id) {
                  <div class="account-card" [class.expanded]="expandedAccounts.has(account.customer_account_id || 'unknown')" [class.same-day-recharges]="account.has_same_day_recharges">
                    <!-- Account header (clickable) -->
                    <div class="account-header" (click)="toggleAccount(account.customer_account_id || 'unknown')">
                      <div class="account-expand">
                        <mat-icon>{{ expandedAccounts.has(account.customer_account_id || 'unknown') ? 'expand_less' : 'expand_more' }}</mat-icon>
                      </div>
                      <div class="account-info">
                        <span class="account-name">{{ account.customer_account_name }}</span>
                        @if (account.customer_account_id) {
                          <span class="account-id">ID: {{ account.customer_account_id | googleAdsId }}</span>
                        }
                      </div>
                      <div class="account-badges">
                        <span class="mini-badge total">{{ account.campaigns_count }}</span>
                        <span class="mini-badge enabled">{{ account.enabled_count }}</span>
                        <span class="mini-badge paused">{{ account.paused_count }}</span>
                      </div>
                    </div>

                    <!-- Financial KPIs row -->
                    <div class="account-kpis">
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon budget-icon">account_balance</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value">{{ formatMoney(account.total_daily_budget) }}</span>
                          <span class="kpi-label">Presup. Diario</span>
                        </div>
                      </div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon spent-icon">trending_down</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value spent">{{ formatMoney(account.total_cost_today) }}</span>
                          <span class="kpi-label">Gasto Hoy</span>
                        </div>
                      </div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon remaining-icon">savings</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value" [class.negative]="account.total_remaining < 0">{{ formatMoney(account.total_remaining) }}</span>
                          <span class="kpi-label">Saldo Restante</span>
                        </div>
                      </div>
                      <div class="kpi-divider"></div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon clicks-icon">ads_click</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value">{{ account.total_clicks | number:'1.0-0' }}</span>
                          <span class="kpi-label">Clicks</span>
                        </div>
                      </div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon impressions-icon">visibility</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value">{{ account.total_impressions | number:'1.0-0' }}</span>
                          <span class="kpi-label">Impresiones</span>
                        </div>
                      </div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon conversions-icon">check_circle</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value">{{ account.total_conversions | number:'1.0-1' }}</span>
                          <span class="kpi-label">Conversiones</span>
                        </div>
                      </div>
                      <div class="kpi-divider"></div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon recharges-icon">payments</mat-icon>
                        <div class="kpi-data">
                          <span class="kpi-value recharge">{{ formatMoney(account.total_recharged) }}</span>
                          <span class="kpi-label">Total Recargado ({{ account.recharges_count }} recargas)</span>
                        </div>
                      </div>
                      <div class="kpi-item">
                        <mat-icon class="kpi-icon last-recharge-icon">schedule</mat-icon>
                        <div class="kpi-data">
                          @if (account.last_recharge_date) {
                            <span class="kpi-value">{{ formatMoney(account.last_recharge_amount) }}</span>
                            <span class="kpi-label">Última recarga · {{ account.last_recharge_date | date:'dd/MM/yy':'UTC' }}</span>
                          } @else {
                            <span class="kpi-value text-muted">—</span>
                            <span class="kpi-label">Sin recargas</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Expanded: campaigns table -->
                    @if (expandedAccounts.has(account.customer_account_id || 'unknown')) {
                      <div class="campaigns-panel">
                        <div class="campaigns-panel-header">
                          <mat-icon>list</mat-icon>
                          <span>Campañas de esta cuenta ({{ account.campaigns_count }})</span>
                        </div>
                        <table mat-table [dataSource]="account.campaigns" class="campaigns-table">
                          <ng-container matColumnDef="name">
                            <th mat-header-cell *matHeaderCellDef>Campaña</th>
                            <td mat-cell *matCellDef="let row">
                              <span class="cell-primary">{{ row.name }}</span>
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="country_code">
                            <th mat-header-cell *matHeaderCellDef>País</th>
                            <td mat-cell *matCellDef="let row">{{ row.country_code }}</td>
                          </ng-container>
                          <ng-container matColumnDef="ads_status">
                            <th mat-header-cell *matHeaderCellDef>Estado</th>
                            <td mat-cell *matCellDef="let row">
                              <span class="badge" [class]="getStatusClass(row.ads_status)">{{ translateStatus(row.ads_status) }}</span>
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="daily_budget">
                            <th mat-header-cell *matHeaderCellDef>Presup. Diario</th>
                            <td mat-cell *matCellDef="let row" class="num">{{ row.daily_budget ? formatMoney(row.daily_budget) : '—' }}</td>
                          </ng-container>
                          <ng-container matColumnDef="cost">
                            <th mat-header-cell *matHeaderCellDef>Gasto Hoy</th>
                            <td mat-cell *matCellDef="let row" class="num">{{ row.cost ? formatMoney(row.cost) : '—' }}</td>
                          </ng-container>
                          <ng-container matColumnDef="remaining_budget">
                            <th mat-header-cell *matHeaderCellDef>Restante</th>
                            <td mat-cell *matCellDef="let row" class="num">
                              <span [class.negative]="row.remaining_budget < 0">{{ row.remaining_budget != null ? formatMoney(row.remaining_budget) : '—' }}</span>
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="conversions">
                            <th mat-header-cell *matHeaderCellDef>Conv.</th>
                            <td mat-cell *matCellDef="let row" class="num">{{ row.conversions | number:'1.0-0' }}</td>
                          </ng-container>
                          <ng-container matColumnDef="clicks">
                            <th mat-header-cell *matHeaderCellDef>Clicks</th>
                            <td mat-cell *matCellDef="let row" class="num">{{ row.clicks | number:'1.0-0' }}</td>
                          </ng-container>
                          <tr mat-header-row *matHeaderRowDef="innerCampaignColumns"></tr>
                          <tr mat-row *matRowDef="let row; columns: innerCampaignColumns;"></tr>
                        </table>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- ===== TAB 2: Recargas ===== -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">payments</mat-icon> Recargas
          </ng-template>
          <div class="tab-body">
            <div class="tab-toolbar">
              <mat-form-field appearance="outline" class="filter-date">
                <mat-label>Desde</mat-label>
                <input matInput [matDatepicker]="rFrom" [(ngModel)]="rechargesDateFrom" (dateChange)="applyRechargesFilter()">
                <mat-datepicker-toggle matIconSuffix [for]="rFrom"></mat-datepicker-toggle>
                <mat-datepicker #rFrom></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-date">
                <mat-label>Hasta</mat-label>
                <input matInput [matDatepicker]="rTo" [(ngModel)]="rechargesDateTo" (dateChange)="applyRechargesFilter()">
                <mat-datepicker-toggle matIconSuffix [for]="rTo"></mat-datepicker-toggle>
                <mat-datepicker #rTo></mat-datepicker>
              </mat-form-field>
              <mat-form-field appearance="outline" class="filter-account">
                <mat-label>Buscar cuenta</mat-label>
                <input matInput [(ngModel)]="rechargesAccount" (keyup.enter)="applyRechargesFilter()">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
              <button mat-stroked-button class="action-btn" (click)="clearRechargesFilters()" matTooltip="Limpiar filtros">
                <mat-icon>restart_alt</mat-icon>
              </button>
              <span class="record-count">{{ totalRecharges | number }} recargas</span>
              <button mat-flat-button class="export-btn" (click)="exportCsv()" matTooltip="Exportar datos filtrados a CSV">
                <mat-icon>download</mat-icon>
                Exportar CSV
              </button>
            </div>
            <div class="data-table-wrap">
              <table mat-table [dataSource]="recharges">
                <ng-container matColumnDef="payments_profile_name">
                  <th mat-header-cell *matHeaderCellDef>Perfil MCC</th>
                  <td mat-cell *matCellDef="let row"><span class="cell-primary">{{ row.payments_profile_name || '—' }}</span></td>
                </ng-container>
                <ng-container matColumnDef="customer_account_id">
                  <th mat-header-cell *matHeaderCellDef>ID Cuenta</th>
                  <td mat-cell *matCellDef="let row"><span class="mono">{{ row.customer_account_id | googleAdsId }}</span></td>
                </ng-container>
                <ng-container matColumnDef="customer_account_name">
                  <th mat-header-cell *matHeaderCellDef>Nombre Cuenta</th>
                  <td mat-cell *matCellDef="let row">{{ row.customer_account_name }}</td>
                </ng-container>
                <ng-container matColumnDef="recharge_date">
                  <th mat-header-cell *matHeaderCellDef>Fecha</th>
                  <td mat-cell *matCellDef="let row">{{ row.recharge_date | date:'dd/MM/yyyy':'UTC' }}</td>
                </ng-container>
                <ng-container matColumnDef="recharge_time">
                  <th mat-header-cell *matHeaderCellDef>Hora</th>
                  <td mat-cell *matCellDef="let row" class="text-muted">{{ row.recharge_date | date:'HH:mm':'UTC' }}</td>
                </ng-container>
                <ng-container matColumnDef="recharge_amount">
                  <th mat-header-cell *matHeaderCellDef>Valor Recargado</th>
                  <td mat-cell *matCellDef="let row" class="num amount-cell">
                    {{ formatMoney(row.recharge_amount) }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="total_daily_budget">
                  <th mat-header-cell *matHeaderCellDef>Presup. Diario</th>
                  <td mat-cell *matCellDef="let row" class="num">{{ row.total_daily_budget ? formatMoney(row.total_daily_budget) : '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="total_remaining">
                  <th mat-header-cell *matHeaderCellDef>Saldo Restante</th>
                  <td mat-cell *matCellDef="let row" class="num">
                    <span [class.negative]="row.total_remaining < 0">{{ row.total_remaining != null ? formatMoney(row.total_remaining) : '—' }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="proposal_type">
                  <th mat-header-cell *matHeaderCellDef>Tipo</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="badge" [class]="getProposalTypeClass(row.proposal_type)">
                      {{ getProposalTypeLabel(row.proposal_type) }}
                    </span>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="rechargesColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: rechargesColumns;" [class.same-day-highlight]="row.same_day_count >= 2"></tr>
              </table>
            </div>
            <mat-paginator [length]="totalRecharges" [pageSize]="50"
                           [pageSizeOptions]="[25, 50, 100]"
                           (page)="onRechargesPageChange($event)">
            </mat-paginator>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6);
    }
    .page-header h1 {
      margin: 0 0 4px; font-size: var(--text-2xl); font-weight: var(--weight-bold);
      color: var(--gray-900); letter-spacing: var(--tracking-tight);
      position: relative; padding-bottom: var(--space-3);
    }
    .page-header h1::after {
      content: ''; position: absolute; bottom: 0; left: 0;
      width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full);
    }
    .page-subtitle { margin: var(--space-2) 0 0; font-size: var(--text-base); color: var(--gray-500); }

    .sync-btn {
      display: flex; align-items: center; gap: var(--space-2);
      background: var(--brand-primary) !important; color: var(--gray-0) !important;
      font-weight: var(--weight-semibold); padding: 0 var(--space-5); height: 42px;
      border-radius: var(--radius-md) !important;
    }
    .sync-btn:hover { background: var(--brand-primary-hover) !important; }
    .sync-btn:disabled { opacity: 0.6; }
    .sync-spinner ::ng-deep circle { stroke: white !important; }

    .tabs-wrapper {
      background: var(--gray-0); border: var(--border-subtle);
      border-radius: var(--radius-lg); overflow: hidden;
    }
    .tab-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }
    .tab-body { padding: var(--space-5) var(--space-6); }

    .tab-toolbar {
      display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap;
    }
    .filter-select { min-width: 180px; }
    .filter-select .mat-mdc-form-field-subscript-wrapper { display: none; }
    .filter-search { min-width: 220px; flex: 1; }
    .filter-search .mat-mdc-form-field-subscript-wrapper { display: none; }
    .filter-date { width: 150px; }
    .filter-date .mat-mdc-form-field-subscript-wrapper { display: none; }
    .filter-account { min-width: 180px; flex: 1; }
    .filter-account .mat-mdc-form-field-subscript-wrapper { display: none; }
    .record-count { font-size: var(--text-sm); color: var(--gray-500); margin-left: auto; white-space: nowrap; }
    .toggle-mine-btn {
      display: flex; align-items: center; gap: 6px;
      height: 40px; border-radius: var(--radius-md) !important; font-weight: var(--weight-semibold);
      border-color: var(--gray-200) !important; color: var(--gray-500) !important;
      white-space: nowrap;
    }
    .toggle-mine-btn.active {
      background: var(--info-light) !important; border-color: var(--info-dark) !important;
      color: var(--info-dark) !important;
    }
    .toggle-mine-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-btn {
      height: 40px; min-width: 40px; padding: 0 8px;
      border-color: var(--gray-200) !important; color: var(--gray-500) !important;
    }
    .export-btn {
      display: flex; align-items: center; gap: 6px;
      background: var(--success-dark) !important; color: var(--gray-0) !important;
      font-weight: var(--weight-semibold); height: 40px; border-radius: var(--radius-md) !important; white-space: nowrap;
    }
    .export-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .loading-state {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-3); padding: var(--space-12) var(--space-4); color: var(--gray-500);
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: var(--space-12) var(--space-4); color: var(--gray-500); text-align: center;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: var(--space-2); opacity: 0.4; }
    .empty-state p { margin: 0 0 4px; }
    .empty-hint { font-size: var(--text-sm); }

    /* ===== Account cards ===== */
    .accounts-list { display: flex; flex-direction: column; gap: var(--space-3); }

    .account-card {
      border: var(--border-subtle); border-radius: var(--radius-lg);
      overflow: hidden; transition: box-shadow var(--duration-base) var(--ease-out);
    }
    .account-card:hover { box-shadow: var(--shadow-sm); }
    .account-card.expanded { border-color: var(--brand-accent); box-shadow: var(--shadow-md); }
    .account-card.same-day-recharges { border-left: 4px solid var(--warning); }

    .same-day-highlight { background: var(--warning-light) !important; }
    .same-day-highlight:hover { background: var(--warning-subtle) !important; }

    .account-header {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-4) var(--space-5); cursor: pointer;
      background: var(--gray-50); transition: background var(--duration-fast) var(--ease-out);
    }
    .account-header:hover { background: var(--gray-100); }
    .account-card.expanded .account-header { background: var(--brand-accent-subtle); }

    .account-expand { flex-shrink: 0; color: var(--gray-400); }
    .account-info { flex: 1; min-width: 0; }
    .account-name {
      display: block; font-weight: var(--weight-bold); font-size: var(--text-base); color: var(--gray-900);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .account-id {
      display: block; font-size: var(--text-xs); color: var(--gray-500);
      font-family: var(--font-mono); margin-top: 1px;
    }

    .account-badges { display: flex; gap: 6px; flex-shrink: 0; }
    .mini-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 26px; height: 22px; padding: 0 6px;
      border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: var(--weight-bold);
    }
    .mini-badge.total { background: var(--info-light); color: var(--info-dark); }
    .mini-badge.enabled { background: var(--success-light); color: var(--success-dark); }
    .mini-badge.paused { background: var(--warning-light); color: var(--warning-dark); }

    /* KPIs row */
    .account-kpis {
      display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;
      padding: var(--space-3) var(--space-5); background: var(--gray-50); border-top: var(--border-subtle);
    }
    .kpi-item { display: flex; align-items: center; gap: var(--space-2); }
    .kpi-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .budget-icon { color: var(--info-dark); }
    .spent-icon { color: var(--danger-dark); }
    .remaining-icon { color: var(--success-dark); }
    .clicks-icon { color: #8B5CF6; }
    .impressions-icon { color: var(--mexico); }
    .conversions-icon { color: var(--success-dark); }
    .recharges-icon { color: var(--warning-dark); }
    .last-recharge-icon { color: var(--gray-500); }
    .kpi-data { display: flex; flex-direction: column; }
    .kpi-value { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--gray-900); line-height: 1.2; font-variant-numeric: tabular-nums; }
    .kpi-value.spent { color: var(--danger-dark); }
    .kpi-value.recharge { color: var(--warning-dark); }
    .kpi-value.negative { color: var(--danger-dark) !important; }
    .kpi-value.text-muted { color: var(--gray-400); font-weight: var(--weight-regular); }
    .kpi-label { font-size: 10px; color: var(--gray-500); white-space: nowrap; }
    .kpi-divider {
      width: 1px; height: 28px; background: var(--gray-200); flex-shrink: 0;
    }

    /* Campaigns panel */
    .campaigns-panel { border-top: var(--border-subtle); }
    .campaigns-panel-header {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3) var(--space-5); background: var(--gray-100);
      font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--gray-600);
    }
    .campaigns-panel-header mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .campaigns-table { width: 100%; }
    .campaigns-table th { font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--gray-500); background: var(--gray-50); }
    .campaigns-table td { font-size: var(--text-sm); }

    /* Shared */
    .data-table-wrap { overflow-x: auto; border: var(--border-subtle); border-radius: var(--radius-md); }
    table { width: 100%; }
    .cell-primary { font-weight: var(--weight-semibold); color: var(--gray-900); }
    .mono {
      font-family: var(--font-mono); font-size: var(--text-xs);
      background: var(--gray-100); padding: 3px 8px; border-radius: var(--radius-sm); letter-spacing: 0.3px;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .amount-cell { font-weight: var(--weight-bold); color: var(--gray-900); }
    .text-muted { color: var(--gray-500); }
    .negative { color: var(--danger-dark) !important; }
    .ext-link { vertical-align: middle; margin-left: 4px; color: var(--gray-400); }
    .ext-link mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .badge {
      display: inline-block; padding: 3px 10px; border-radius: var(--radius-full);
      font-size: var(--text-xs); font-weight: var(--weight-bold); text-transform: uppercase; letter-spacing: 0.3px;
    }
    .badge-green { background: var(--success-light); color: var(--success-dark); }
    .badge-yellow { background: var(--warning-light); color: var(--warning-dark); }
    .badge-red { background: var(--danger-light); color: var(--danger-dark); }
    .badge-gray { background: var(--gray-100); color: var(--gray-600); }
    .badge-blue { background: var(--info-light); color: var(--info-dark); }

    mat-paginator { border-top: var(--border-subtle); }

    @media (max-width: 1024px) {
      .account-kpis { gap: var(--space-3); }
      .kpi-divider { display: none; }
    }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
      .tab-body { padding: var(--space-4) var(--space-3); }
      .account-header { padding: var(--space-3) var(--space-4); }
      .account-kpis { padding: var(--space-3) var(--space-4); gap: var(--space-3); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleAdsViewComponent implements OnInit {
  // Tab 1: Cuentas
  countries: any[] = [];
  allAccounts: any[] = [];
  filteredAccounts: any[] = [];
  accountsCountryId = 0;
  accountSearch = '';
  totalAccountCampaigns = 0;
  accountsLoaded = false;
  hasAccountData = false;
  expandedAccounts = new Set<string>();

  // Tab 2: Recargas
  recharges: any[] = [];
  totalRecharges = 0;
  rechargesPage = 1;
  rechargesDateFrom: Date | null = null;
  rechargesDateTo: Date | null = null;
  rechargesAccount = '';

  syncing = false;
  isAdmin = false;
  activeTab = 0;

  // Multi-account filtering
  myAccountIds: string[] = [];
  showOnlyMine = true;
  isPautador = false;

  innerCampaignColumns = [
    'name', 'country_code', 'ads_status',
    'daily_budget', 'cost', 'remaining_budget', 'conversions', 'clicks',
  ];
  rechargesColumns = [
    'payments_profile_name', 'customer_account_id', 'customer_account_name',
    'recharge_date', 'recharge_time', 'recharge_amount',
    'total_daily_budget', 'total_remaining', 'proposal_type',
  ];

  constructor(
    private googleAdsService: GoogleAdsService,
    private countryService: CountryService,
    private authService: AuthService,
    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.userRole() === 'admin';
    this.isPautador = this.authService.userRole() === 'pautador';
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
    if (this.isPautador) {
      this.googleAdsService.getMyAccounts().subscribe(res => {
        this.myAccountIds = res.data;
        this.loadAccounts();
        this.cdr.markForCheck();
      });
    } else {
      this.showOnlyMine = false;
      this.loadAccounts();
    }
  }

  onTabChange(event: any): void {
    this.activeTab = event.index;
    if (event.index === 1 && this.recharges.length === 0) this.loadRecharges();
  }

  // ===== Tab 1: Cuentas =====
  loadAccounts(): void {
    this.accountsLoaded = false;
    this.cdr.markForCheck();
    const countryId = this.accountsCountryId || undefined;
    const accountIds = (this.isPautador && this.showOnlyMine && this.myAccountIds.length > 0) ? this.myAccountIds : undefined;
    this.googleAdsService.getCampaignsByAccount(countryId, accountIds).subscribe(res => {
      this.allAccounts = res.data;
      this.hasAccountData = res.data.some((a: any) => a.customer_account_id);
      this.filterAccounts();
      this.accountsLoaded = true;
      this.cdr.markForCheck();
    });
  }

  filterAccounts(): void {
    const search = this.accountSearch.toLowerCase().trim();
    if (!search) {
      this.filteredAccounts = [...this.allAccounts];
    } else {
      this.filteredAccounts = this.allAccounts.filter(a =>
        (a.customer_account_name || '').toLowerCase().includes(search) ||
        (a.customer_account_id || '').includes(search) ||
        a.campaigns.some((c: any) => (c.name || '').toLowerCase().includes(search))
      );
    }
    this.totalAccountCampaigns = this.filteredAccounts.reduce((sum: number, a: any) => sum + a.campaigns_count, 0);
    this.cdr.markForCheck();
  }

  toggleAccount(accountId: string): void {
    if (this.expandedAccounts.has(accountId)) {
      this.expandedAccounts.delete(accountId);
    } else {
      this.expandedAccounts.add(accountId);
    }
    this.cdr.markForCheck();
  }

  toggleShowMine(): void {
    this.showOnlyMine = !this.showOnlyMine;
    this.allAccounts = [];
    this.loadAccounts();
    if (this.recharges.length > 0) this.loadRecharges();
  }

  // ===== Tab 2: Recargas =====
  loadRecharges(): void {
    const accountIds = (this.isPautador && this.showOnlyMine && this.myAccountIds.length > 0) ? this.myAccountIds : undefined;
    this.googleAdsService.getRecharges(this.rechargesPage, 50, this.getRechargesFilters(), accountIds).subscribe(res => {
      this.recharges = res.data;
      this.totalRecharges = (res as any).meta?.total || 0;
      this.cdr.markForCheck();
    });
  }

  private getRechargesFilters(): any {
    const f: any = {};
    if (this.rechargesDateFrom) f.dateFrom = this.fmtDate(this.rechargesDateFrom);
    if (this.rechargesDateTo) f.dateTo = this.fmtDate(this.rechargesDateTo);
    if (this.rechargesAccount) f.account = this.rechargesAccount;
    return f;
  }

  applyRechargesFilter(): void {
    this.rechargesPage = 1;
    this.loadRecharges();
  }

  clearRechargesFilters(): void {
    this.rechargesDateFrom = null;
    this.rechargesDateTo = null;
    this.rechargesAccount = '';
    this.rechargesPage = 1;
    this.loadRecharges();
  }

  exportCsv(): void {
    this.googleAdsService.exportRechargesCsv(this.getRechargesFilters());
  }

  onRechargesPageChange(event: PageEvent): void {
    this.rechargesPage = event.pageIndex + 1;
    this.loadRecharges();
  }

  // ===== Sync =====
  syncNow(): void {
    this.syncing = true;
    this.cdr.markForCheck();
    this.googleAdsService.triggerSync().subscribe({
      next: () => {
        this.syncing = false;
        this.notification.success('Sincronización completada');
        this.allAccounts = [];
        this.loadAccounts();
        if (this.activeTab === 1) this.loadRecharges();
        this.cdr.markForCheck();
      },
      error: () => {
        this.syncing = false;
        this.notification.error('Error en la sincronización');
        this.cdr.markForCheck();
      },
    });
  }

  // ===== Helpers =====
  formatMoney(value: number | null): string {
    if (value == null) return '—';
    return '$' + Math.round(value).toLocaleString('es-CO');
  }

  getStatusClass(status: string): string {
    if (!status) return 'badge badge-gray';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'badge badge-green';
    if (s === 'PAUSED') return 'badge badge-yellow';
    if (s === 'REMOVED') return 'badge badge-red';
    return 'badge badge-gray';
  }

  translateStatus(status: string): string {
    if (!status) return 'N/A';
    const s = status.toUpperCase();
    if (s === 'ENABLED') return 'Activa';
    if (s === 'PAUSED') return 'Pausada';
    if (s === 'REMOVED') return 'Eliminada';
    return status;
  }

  getProposalTypeLabel(type: number): string {
    const labels: Record<number, string> = { 2: 'Inicial', 3: 'Recarga', 4: 'Cierre' };
    return labels[type] || 'Tipo ' + type;
  }

  getProposalTypeClass(type: number): string {
    if (type === 2) return 'badge badge-blue';
    if (type === 3) return 'badge badge-green';
    if (type === 4) return 'badge badge-red';
    return 'badge badge-gray';
  }

  private fmtDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
}
