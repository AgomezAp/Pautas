import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ConglomeradoService } from '../conglomerado.service';

@Component({
  selector: 'app-weekly-summary',
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Resumen Semanal</h1>
        <div class="week-nav">
          <button mat-icon-button (click)="previousWeek()">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="week-label">Semana {{ currentWeek }} - {{ currentYear }}</span>
          <button mat-icon-button (click)="nextWeek()" [disabled]="isCurrentWeek">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </div>

      @if (summary) {
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-icon bg-blue"><mat-icon>calendar_today</mat-icon></div>
            <div class="summary-data">
              <span class="summary-value">{{ summary.days_with_entries || 0 }} <span class="summary-of">/ 7</span></span>
              <span class="summary-label">Días con entradas</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon bg-purple"><mat-icon>people</mat-icon></div>
            <div class="summary-data">
              <span class="summary-value">{{ summary.total_clientes || 0 }}</span>
              <span class="summary-label">Total Clientes</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon bg-green"><mat-icon>verified</mat-icon></div>
            <div class="summary-data">
              <span class="summary-value">{{ summary.total_clientes_efectivos || 0 }}</span>
              <span class="summary-label">Clientes Efectivos</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-icon bg-orange"><mat-icon>child_care</mat-icon></div>
            <div class="summary-data">
              <span class="summary-value">{{ summary.total_menores || 0 }}</span>
              <span class="summary-label">Total Menores</span>
            </div>
          </div>

          <div class="summary-card highlight">
            <div class="summary-icon bg-teal"><mat-icon>trending_up</mat-icon></div>
            <div class="summary-data">
              <span class="summary-value">{{ (summary.effectiveness_rate || 0) * 100 | number:'1.1-1' }}%</span>
              <span class="summary-label">Tasa de Efectividad</span>
            </div>
          </div>
        </div>
      }

      @if (!summary && !loading) {
        <div class="empty-state">
          <mat-icon>event_busy</mat-icon>
          <p>No hay datos para esta semana</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 700px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { margin: 0 0 12px; font-size: 22px; font-weight: var(--weight-bold); color: var(--gray-900); }

    .week-nav { display: flex; align-items: center; gap: 8px; }
    .week-label {
      font-size: 16px;
      font-weight: var(--weight-semibold);
      color: var(--gray-900);
      min-width: 160px;
      text-align: center;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .summary-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--gray-0);
      border: var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 20px;
      transition: box-shadow 0.2s;
    }
    .summary-card:hover { box-shadow: var(--shadow-md); }
    .summary-card.highlight { grid-column: 1 / -1; }

    .summary-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .summary-icon mat-icon { color: var(--gray-0); font-size: 22px; width: 22px; height: 22px; }
    .bg-blue { background: linear-gradient(135deg, var(--info), var(--info-dark)); }
    .bg-purple { background: linear-gradient(135deg, #8B5CF6, #7C3AED); }
    .bg-green { background: linear-gradient(135deg, var(--success), var(--success-dark)); }
    .bg-orange { background: linear-gradient(135deg, var(--warning), var(--warning-dark)); }
    .bg-teal { background: linear-gradient(135deg, #06B6D4, #0891B2); }

    .summary-data { display: flex; flex-direction: column; }
    .summary-value { font-size: 26px; font-weight: var(--weight-bold); color: var(--gray-900); line-height: 1.2; }
    .summary-of { font-size: 16px; font-weight: 400; color: var(--gray-500); }
    .summary-label { font-size: 13px; color: var(--gray-500); margin-top: 2px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 16px;
      color: var(--gray-500);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.4; }
    .empty-state p { margin: 0; font-size: 14px; }
  `]
})
export class WeeklySummaryComponent implements OnInit {
  summary: any = null;
  loading = false;
  currentYear!: number;
  currentWeek!: number;
  isCurrentWeek = true;

  private todayYear!: number;
  private todayWeek!: number;

  constructor(private conglomeradoService: ConglomeradoService) {}

  ngOnInit(): void {
    const now = new Date();
    const { year, week } = this.getISOWeek(now);
    this.todayYear = year;
    this.todayWeek = week;
    this.currentYear = year;
    this.currentWeek = week;
    this.loadSummary();
  }

  previousWeek(): void {
    this.currentWeek--;
    if (this.currentWeek < 1) {
      this.currentYear--;
      this.currentWeek = this.getWeeksInYear(this.currentYear);
    }
    this.isCurrentWeek = false;
    this.loadSummary();
  }

  nextWeek(): void {
    this.currentWeek++;
    const maxWeeks = this.getWeeksInYear(this.currentYear);
    if (this.currentWeek > maxWeeks) {
      this.currentYear++;
      this.currentWeek = 1;
    }
    this.isCurrentWeek = (this.currentYear === this.todayYear && this.currentWeek === this.todayWeek);
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading = true;
    this.summary = null;
    this.conglomeradoService.getWeeklySummary(this.currentYear, this.currentWeek).subscribe({
      next: (res) => {
        this.summary = res.data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private getISOWeek(date: Date): { year: number; week: number } {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week };
  }

  private getWeeksInYear(year: number): number {
    const dec31 = new Date(Date.UTC(year, 11, 31));
    const { week } = this.getISOWeek(dec31);
    return week === 1 ? 52 : week;
  }
}
