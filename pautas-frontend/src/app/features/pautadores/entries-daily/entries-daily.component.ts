import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-entries-daily',
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
  ],
  templateUrl: './entries-daily.component.html',
  styleUrl: './entries-daily.component.scss',
})
export class EntriesDailyComponent implements OnInit {
  displayedColumns = [
    'entry_date', 'user_name', 'country_name', 'campaign_name',
    'clientes', 'clientes_efectivos', 'menores',
  ];

  data: any[] = [];
  countries: Country[] = [];
  filters: any = { country_id: null, date_from: '', date_to: '' };

  totalItems = 0;
  pageSize = 25;
  pageIndex = 0;

  constructor(
    private pautadoresService: PautadoresService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });
    this.loadData();
  }

  loadData(): void {
    const params = {
      ...this.filters,
      page: this.pageIndex + 1,
      limit: this.pageSize,
    };

    this.pautadoresService.getEntriesDaily(params).subscribe(res => {
      this.data = res.data;
      this.totalItems = res.meta?.total ?? 0;
      this.cdr.detectChanges();
    });
  }

  applyFilters(): void {
    this.pageIndex = 0;
    this.loadData();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.pageIndex = event.page - 1;
    this.pageSize = event.pageSize;
    this.loadData();
  }
}
