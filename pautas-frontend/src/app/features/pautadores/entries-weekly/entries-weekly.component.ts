import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-entries-weekly',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule, IconComponent,
  ],
  templateUrl: './entries-weekly.component.html',
  styleUrl: './entries-weekly.component.scss',
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
      this.cdr.detectChanges();
    });
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.cdr.detectChanges();

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
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
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
