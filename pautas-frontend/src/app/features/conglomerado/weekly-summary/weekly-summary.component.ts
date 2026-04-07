import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ConglomeradoService } from '../conglomerado.service';

@Component({
  selector: 'app-weekly-summary',
  imports: [CommonModule, IconComponent],
  templateUrl: './weekly-summary.component.html',
  styleUrl: './weekly-summary.component.scss',
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
