import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PautadoresService } from '../pautadores.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';

@Component({
  selector: 'app-entries-daily',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <h2>Entradas Diarias</h2>

    <div class="filters-row">
      <mat-form-field appearance="outline">
        <mat-label>Pa\u00eds</mat-label>
        <mat-select [(ngModel)]="filters.country_id" (selectionChange)="applyFilters()">
          <mat-option [value]="null">Todos</mat-option>
          @for (c of countries; track c.id) {
            <mat-option [value]="c.id">{{ c.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Desde</mat-label>
        <input matInput type="date" [(ngModel)]="filters.date_from" (change)="applyFilters()">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Hasta</mat-label>
        <input matInput type="date" [(ngModel)]="filters.date_to" (change)="applyFilters()">
      </mat-form-field>
    </div>

    <mat-card>
      <table mat-table [dataSource]="data" class="full-width">
        <ng-container matColumnDef="entry_date">
          <th mat-header-cell *matHeaderCellDef>Fecha</th>
          <td mat-cell *matCellDef="let row">{{ row.entry_date | date:'dd/MM/yyyy' }}</td>
        </ng-container>
        <ng-container matColumnDef="user_name">
          <th mat-header-cell *matHeaderCellDef>Usuario</th>
          <td mat-cell *matCellDef="let row">{{ row.user_name }}</td>
        </ng-container>
        <ng-container matColumnDef="country_name">
          <th mat-header-cell *matHeaderCellDef>Pa\u00eds</th>
          <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
        </ng-container>
        <ng-container matColumnDef="campaign_name">
          <th mat-header-cell *matHeaderCellDef>Campa\u00f1a</th>
          <td mat-cell *matCellDef="let row">{{ row.campaign_name || '\u2014' }}</td>
        </ng-container>
        <ng-container matColumnDef="clientes">
          <th mat-header-cell *matHeaderCellDef>Clientes</th>
          <td mat-cell *matCellDef="let row">{{ row.clientes }}</td>
        </ng-container>
        <ng-container matColumnDef="clientes_efectivos">
          <th mat-header-cell *matHeaderCellDef>Efectivos</th>
          <td mat-cell *matCellDef="let row">{{ row.clientes_efectivos }}</td>
        </ng-container>
        <ng-container matColumnDef="menores">
          <th mat-header-cell *matHeaderCellDef>Menores</th>
          <td mat-cell *matCellDef="let row">{{ row.menores }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      <mat-paginator [length]="totalItems"
                     [pageSize]="pageSize"
                     [pageSizeOptions]="[10, 25, 50]"
                     [pageIndex]="pageIndex"
                     showFirstLastButtons
                     (page)="onPageChange($event)">
      </mat-paginator>
    </mat-card>
  `,
  styles: [`
    h2 { margin: 0 0 16px; color: var(--gray-900); position: relative; padding-bottom: var(--space-2); display: inline-block; }
    h2::after { content: ''; position: absolute; bottom: 0; left: 0; width: 40px; height: 3px; background: var(--brand-accent); border-radius: var(--radius-full); }
    .filters-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters-row mat-form-field { min-width: 160px; }
    .full-width { width: 100%; }
  `]
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
      this.cdr.markForCheck();
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
      this.cdr.markForCheck();
    });
  }

  applyFilters(): void {
    this.pageIndex = 0;
    this.loadData();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }
}
