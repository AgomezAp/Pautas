import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CampaignFormComponent } from '../campaign-form/campaign-form.component';

@Component({
  selector: 'app-campaign-list',
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatButtonModule,
    MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule,
  ],
  template: `
    <div class="header-row">
      <h2>Gestión de Campañas</h2>
      <button mat-raised-button color="primary" (click)="openForm()">
        <mat-icon>add</mat-icon> Nueva Campaña
      </button>
    </div>

    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Buscar campañas</mat-label>
      <input matInput (input)="applyFilter($event)" placeholder="Nombre o ID">
      <mat-icon matSuffix>search</mat-icon>
    </mat-form-field>

    <table mat-table [dataSource]="dataSource" class="mat-elevation-z2 full-width">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Nombre</th>
        <td mat-cell *matCellDef="let row">{{ row.name }}</td>
      </ng-container>
      <ng-container matColumnDef="google_ads_campaign_id">
        <th mat-header-cell *matHeaderCellDef>ID Google Ads</th>
        <td mat-cell *matCellDef="let row">{{ row.google_ads_campaign_id || '-' }}</td>
      </ng-container>
      <ng-container matColumnDef="country_name">
        <th mat-header-cell *matHeaderCellDef>País</th>
        <td mat-cell *matCellDef="let row">{{ row.country_name }}</td>
      </ng-container>
      <ng-container matColumnDef="assigned_user">
        <th mat-header-cell *matHeaderCellDef>Usuario Asignado</th>
        <td mat-cell *matCellDef="let row">{{ row.assigned_user || 'Sin asignar' }}</td>
      </ng-container>
      <ng-container matColumnDef="is_active">
        <th mat-header-cell *matHeaderCellDef>Estado</th>
        <td mat-cell *matCellDef="let row">
          <span [class]="row.is_active ? 'badge-active' : 'badge-inactive'">
            {{ row.is_active ? 'Activa' : 'Inactiva' }}
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>Acciones</th>
        <td mat-cell *matCellDef="let row">
          <button mat-icon-button color="primary" (click)="openForm(row)">
            <mat-icon>edit</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
    </table>

    <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h2 { margin: 0; color: var(--gray-900); }
    .search-field { width: 100%; margin-bottom: 8px; }
    .full-width { width: 100%; }
  `]
})
export class CampaignListComponent implements OnInit {
  displayedColumns = ['name', 'google_ads_campaign_id', 'country_name', 'assigned_user', 'is_active', 'actions'];
  dataSource = new MatTableDataSource<any>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private adminService: AdminService,
    private dialog: MatDialog,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void { this.loadCampaigns(); }

  loadCampaigns(): void {
    this.adminService.getCampaigns().subscribe(res => {
      this.dataSource.data = res.data;
      this.dataSource.paginator = this.paginator;
    });
  }

  applyFilter(event: Event): void {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  openForm(campaign?: any): void {
    const dialogRef = this.dialog.open(CampaignFormComponent, { width: '500px', data: { campaign } });
    dialogRef.afterClosed().subscribe(result => { if (result) this.loadCampaigns(); });
  }
}
