import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertsService } from '../alerts.service';
import { CountryService } from '../../../core/services/country.service';
import { ConglomerateRanking } from '../../../core/models/alert.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-conglomerate-ranking',
  imports: [
    CommonModule, FormsModule, IconComponent,
  ],
  templateUrl: './conglomerate-ranking.component.html',
  styleUrl: './conglomerate-ranking.component.scss',
})
export class ConglomerateRankingComponent implements OnInit {
  rankings: ConglomerateRanking[] = [];
  countries: any[] = [];
  selectedCountry: number | undefined;
  loading = false;

  constructor(
    private alertsService: AlertsService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCountries();
    this.loadRanking();
  }

  loadCountries(): void {
    this.countryService.getAll().subscribe({
      next: (res:any) => {
        this.countries = res.data || [];
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  loadRanking(): void {
    this.loading = true;
    this.alertsService.getRanking(this.selectedCountry).subscribe({
      next: (res) => {
        this.rankings = res.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  }

  getRateClass(rate: number): string {
    if (rate >= 60) return 'rate-high';
    if (rate >= 30) return 'rate-medium';
    return 'rate-low';
  }
}
