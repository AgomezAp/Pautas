import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';

@Component({
  selector: 'app-entries-weekly',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatSelectModule, MatTooltipModule,
  ],
  template: `
    <div class="page-header">
      <h2>Entradas Semanales</h2>
      <div class="week-nav">
        <button mat-icon-button (click)="previousWeek()" matTooltip="Semana anterior">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="week-label">{{ weekRangeLabel }}</span>
        <button mat-icon-button (click)="nextWeek()" [disabled]="isCurrentWeek" matTooltip="Semana siguiente">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    </div>

    <div class="filters-row">
      <mat-form-field appearance="outline">
        <mat-label>Pa\u00eds</mat-label>
        <mat-select [(ngModel)]="selectedCountryId" (selectionChange)="loadData()">
          <mat-option [value]="null">Todos</mat-option>
          @for (c of countries; track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (loading) {
      <div class="loading">Cargando...</div>
    } @else {
      <div class="calendar-wrapper">
        <table class="calendar-table">
          <thead>
            <tr>
              <th class="col-campaign">CUENTA</th>
              <th class="col-day">LUN<br><span class="day-date">{{ dayDates[0] }}</span></th>
              <th class="col-day">MAR<br><span class="day-date">{{ dayDates[1] }}</span></th>
              <th class="col-day">MI\u00c9<br><span class="day-date">{{ dayDates[2] }}</span></th>
              <th class="col-day">JUE<br><span class="day-date">{{ dayDates[3] }}</span></th>
              <th class="col-day">VIE<br><span class="day-date">{{ dayDates[4] }}</span></th>
              <th class="col-day">S\u00c1B<br><span class="day-date">{{ dayDates[5] }}</span></th>
              <th class="col-total">TOTAL</th>
              <th class="col-total">EFECT.</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.user_id) {
              <tr>
                <td class="cell-campaign">
                  <div class="campaign-name">{{ row.user_name }}</div>
                  <div class="campaign-user">{{ row.country_name }}</div>
                </td>
                @for (dayNum of weekDays; track dayNum) {
                  <td class="cell-day" [ngClass]="getCellClass(row, dayNum)">
                    @if (!row.campaign_active) {
                      <span class="paused">PAUSADO</span>
                    } @else if (row.days[dayNum]) {
                      <span class="day-value">{{ row.days[dayNum].clientes }}</span>
                    } @else {
                      <span class="day-empty">-</span>
                    }
                  </td>
                }
                <td class="cell-total">{{ row.total_clientes }}</td>
                <td class="cell-total">{{ row.total_efectivos }}</td>
              </tr>
            }
            @if (rows.length === 0) {
              <tr><td colspan="9" class="no-data">No hay datos para esta semana</td></tr>
            }
          </tbody>
          @if (rows.length > 0) {
            <tfoot>
              <tr class="totals-row">
                <td class="cell-campaign"><strong>TOTALES</strong></td>
                @for (dayNum of weekDays; track dayNum) {
                  <td class="cell-day cell-total-footer">
                    {{ getDayTotal(dayNum) }}
                  </td>
                }
                <td class="cell-total cell-total-footer">{{ grandTotal }}</td>
                <td class="cell-total cell-total-footer">{{ grandTotalEfectivos }}</td>
              </tr>
            </tfoot>
          }
        </table>
      </div>
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .page-header h2 {
      margin: 0; font-size: var(--text-xl); font-weight: var(--weight-bold);
      color: var(--gray-900); letter-spacing: var(--tracking-tight);
      position: relative; padding-bottom: var(--space-2);
    }
    .page-header h2::after {
      content: ''; position: absolute; bottom: 0; left: 0;
      width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full);
    }
    .week-nav {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: var(--gray-0);
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-md);
      padding: var(--space-1) var(--space-3);
    }
    .week-label {
      font-weight: var(--weight-semibold);
      font-size: var(--text-base);
      min-width: 260px;
      text-align: center;
      text-transform: uppercase;
    }
    .filters-row {
      display: flex;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }
    .filters-row mat-form-field { min-width: 160px; }
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--gray-500);
      font-size: var(--text-md);
    }
    .calendar-wrapper {
      overflow-x: auto;
      border-radius: var(--radius-md);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .calendar-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      min-width: 700px;
    }
    .calendar-table thead th {
      background: var(--gray-900);
      color: var(--gray-0);
      padding: 10px 6px;
      text-align: center;
      font-weight: var(--weight-bold);
      font-size: var(--text-xs);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .col-campaign { text-align: left !important; min-width: 200px; }
    .col-day { width: 80px; }
    .col-total { width: 70px; }
    .day-date { font-weight: 400; font-size: 10px; opacity: 0.8; }
    .calendar-table tbody tr { border-bottom: 1px solid var(--gray-200); }
    .calendar-table tbody tr:hover { background: var(--gray-50); }
    .cell-campaign {
      padding: var(--space-2) 10px;
      border-right: 1px solid var(--gray-200);
    }
    .campaign-name {
      font-weight: var(--weight-semibold);
      font-size: var(--text-xs);
      color: var(--gray-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
    .campaign-user {
      font-size: 11px;
      color: var(--gray-500);
    }
    .cell-day {
      text-align: center;
      padding: var(--space-2) var(--space-1);
      border-right: 1px solid var(--gray-200);
      font-weight: var(--weight-bold);
      font-size: var(--text-base);
      transition: background 0.15s;
    }
    .cell-total {
      text-align: center;
      padding: var(--space-2) var(--space-1);
      font-weight: var(--weight-bold);
      font-size: var(--text-base);
      border-right: 1px solid var(--gray-200);
      background: var(--gray-100);
    }
    .day-value { display: block; }
    .day-empty { color: var(--gray-300); }
    .paused {
      font-size: 9px;
      font-weight: var(--weight-semibold);
      color: var(--gray-500);
      letter-spacing: 0.5px;
    }
    .cell-red { background: var(--danger-light); color: var(--danger-dark); }
    .cell-yellow { background: var(--warning-light); color: var(--warning-dark); }
    .cell-green { background: var(--success-light); color: var(--success-dark); }
    .cell-paused { background: var(--gray-150); }
    .cell-empty { background: var(--gray-50); }
    .no-data {
      text-align: center;
      padding: 40px;
      color: var(--gray-400);
      font-size: var(--text-base);
    }
    tfoot tr { border-top: 2px solid var(--brand-primary); }
    .totals-row td { font-weight: var(--weight-extrabold) !important; }
    .cell-total-footer {
      background: var(--info-light) !important;
      color: var(--gray-900) !important;
    }
  `]
})
export class EntriesWeeklyComponent implements OnInit {
  countries: Country[] = [];
  selectedCountryId: number | null = null;
  rows: any[] = [];
  loading = false;
  weekDays = [1, 2, 3, 4, 5, 6];

  isoYear = new Date().getFullYear();
  isoWeek = 1;
  weekStart = '';
  weekEnd = '';
  dayDates: string[] = ['', '', '', '', '', ''];
  weekRangeLabel = '';
  isCurrentWeek = true;

  grandTotal = 0;
  grandTotalEfectivos = 0;

  constructor(
    private pautadoresService: PautadoresService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const now = new Date();
    this.isoYear = now.getFullYear();
    this.isoWeek = this.getISOWeek(now);

    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.markForCheck();
    });
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const params: any = { iso_year: this.isoYear, iso_week: this.isoWeek };
    if (this.selectedCountryId) params.country_id = this.selectedCountryId;

    this.pautadoresService.getEntriesWeeklyCalendar(params).subscribe({
      next: (res) => {
        const data = res.data;
        this.rows = data.rows || [];
        this.weekStart = data.week_start;
        this.weekEnd = data.week_end;
        this.isoYear = data.iso_year;
        this.isoWeek = data.iso_week;
        this.updateWeekLabel();
        this.calculateTotals();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  previousWeek(): void {
    this.isoWeek--;
    if (this.isoWeek < 1) {
      this.isoYear--;
      this.isoWeek = this.getWeeksInYear(this.isoYear);
    }
    this.isCurrentWeek = false;
    this.loadData();
  }

  nextWeek(): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = this.getISOWeek(now);

    this.isoWeek++;
    const maxWeek = this.getWeeksInYear(this.isoYear);
    if (this.isoWeek > maxWeek) {
      this.isoYear++;
      this.isoWeek = 1;
    }

    this.isCurrentWeek = this.isoYear === currentYear && this.isoWeek === currentWeek;
    this.loadData();
  }

  getCellClass(row: any, dayNum: number): string {
    if (!row.campaign_active) return 'cell-paused';
    const day = row.days[dayNum];
    if (!day) return 'cell-empty';
    const val = day.clientes;
    if (val >= 5) return 'cell-green';
    if (val >= 3) return 'cell-yellow';
    return 'cell-red';
  }

  getDayTotal(dayNum: number): number {
    let total = 0;
    for (const row of this.rows) {
      if (row.days[dayNum]) total += row.days[dayNum].clientes;
    }
    return total;
  }

  private calculateTotals(): void {
    this.grandTotal = this.rows.reduce((sum: number, r: any) => sum + (r.total_clientes || 0), 0);
    this.grandTotalEfectivos = this.rows.reduce((sum: number, r: any) => sum + (r.total_efectivos || 0), 0);
  }

  private updateWeekLabel(): void {
    if (this.weekStart && this.weekEnd) {
      const start = new Date(this.weekStart + 'T00:00:00');
      const end = new Date(this.weekEnd + 'T00:00:00');
      const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

      this.weekRangeLabel = `${start.getDate()} al ${end.getDate()} de ${months[end.getMonth()]} ${end.getFullYear()} (S${this.isoWeek})`;

      this.dayDates = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        this.dayDates.push(`${d.getDate()}/${d.getMonth() + 1}`);
      }
    }
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private getWeeksInYear(year: number): number {
    const dec28 = new Date(Date.UTC(year, 11, 28));
    return this.getISOWeek(dec28);
  }
}
