import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatTooltipModule, MatTabsModule,
  ],
  template: `
    <div class="header-row">
      <h2>Gestión de Usuarios</h2>
      <button mat-raised-button color="primary" (click)="openForm()">
        <mat-icon>add</mat-icon> Nuevo Usuario
      </button>
    </div>

    <mat-tab-group (selectedTabChange)="onTabChange($event.index)" animationDuration="200ms">
      <mat-tab label="Todos">
        <ng-template matTabContent>
          <ng-container *ngTemplateOutlet="userTable; context: { $implicit: dataSourceAll, columns: columnsAll, paginator: 'all' }"></ng-container>
        </ng-template>
      </mat-tab>
      <mat-tab label="Pautadores">
        <ng-template matTabContent>
          <ng-container *ngTemplateOutlet="userTable; context: { $implicit: dataSourcePautadores, columns: columnsPautadores, paginator: 'pautadores' }"></ng-container>
        </ng-template>
      </mat-tab>
      <mat-tab label="Conglomerado">
        <ng-template matTabContent>
          <ng-container *ngTemplateOutlet="userTable; context: { $implicit: dataSourceConglomerado, columns: columnsConglomerado, paginator: 'conglomerado' }"></ng-container>
        </ng-template>
      </mat-tab>
    </mat-tab-group>

    <ng-template #userTable let-ds let-columns="columns" let-pag="paginator">
      <div class="tab-content">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Buscar usuarios</mat-label>
          <input matInput (input)="applyFilter($event, ds)" placeholder="Nombre, usuario o email">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <table mat-table [dataSource]="ds" class="mat-elevation-z2 full-width">
          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef>Usuario</th>
            <td mat-cell *matCellDef="let row">{{ row.username }}</td>
          </ng-container>
          <ng-container matColumnDef="full_name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let row">{{ row.full_name }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Rol</th>
            <td mat-cell *matCellDef="let row">{{ row.role }}</td>
          </ng-container>
          <ng-container matColumnDef="country_name">
            <th mat-header-cell *matHeaderCellDef>País</th>
            <td mat-cell *matCellDef="let row">{{ row.country_name || '-' }}</td>
          </ng-container>
          <ng-container matColumnDef="campaign_name">
            <th mat-header-cell *matHeaderCellDef>Campaña</th>
            <td mat-cell *matCellDef="let row">{{ row.campaign_name || '-' }}</td>
          </ng-container>
          <ng-container matColumnDef="is_active">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let row">
              <span [class]="row.is_active ? 'badge-active' : 'badge-inactive'">
                {{ row.is_active ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button color="primary" (click)="openForm(row)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button [color]="row.is_active ? 'warn' : 'accent'"
                      (click)="confirmToggleActive(row)"
                      [matTooltip]="row.is_active ? 'Desactivar usuario' : 'Activar usuario'">
                <mat-icon>{{ row.is_active ? 'block' : 'check_circle' }}</mat-icon>
              </button>
              @if (row.role === 'pautador') {
                <button mat-icon-button color="primary" (click)="openAccountsDialog(row)" matTooltip="Cuentas Google Ads">
                  <mat-icon>link</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>

        @if (pag === 'all') {
          <mat-paginator #paginatorAll [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        }
        @if (pag === 'pautadores') {
          <mat-paginator #paginatorPautadores [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        }
        @if (pag === 'conglomerado') {
          <mat-paginator #paginatorConglomerado [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    h2 { margin: 0; color: var(--gray-900); }
    .tab-content { padding-top: 16px; }
    .search-field { width: 100%; margin-bottom: 8px; }
    .full-width { width: 100%; }
    .badge-active {
      display: inline-block;
      padding: 2px 10px;
      border-radius: var(--radius-lg);
      font-size: 12px;
      font-weight: var(--weight-semibold);
      background: var(--success-light);
      color: var(--success-dark);
    }
    .badge-inactive {
      display: inline-block;
      padding: 2px 10px;
      border-radius: var(--radius-lg);
      font-size: 12px;
      font-weight: var(--weight-semibold);
      background: var(--danger-light);
      color: var(--danger-dark);
    }
  `]
})
export class UserListComponent implements OnInit {
  columnsAll = ['username', 'full_name', 'role', 'country_name', 'is_active', 'actions'];
  columnsPautadores = ['username', 'full_name', 'country_name', 'is_active', 'actions'];
  columnsConglomerado = ['username', 'full_name', 'country_name', 'campaign_name', 'is_active', 'actions'];

  dataSourceAll = new MatTableDataSource<any>([]);
  dataSourcePautadores = new MatTableDataSource<any>([]);
  dataSourceConglomerado = new MatTableDataSource<any>([]);

  @ViewChild('paginatorAll') paginatorAll!: MatPaginator;
  @ViewChild('paginatorPautadores') paginatorPautadores!: MatPaginator;
  @ViewChild('paginatorConglomerado') paginatorConglomerado!: MatPaginator;

  activeTab = 0;

  constructor(
    private adminService: AdminService,
    private dialog: MatDialog,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadAllUsers();
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    if (index === 1 && this.dataSourcePautadores.data.length === 0) {
      this.loadPautadores();
    } else if (index === 2 && this.dataSourceConglomerado.data.length === 0) {
      this.loadConglomerado();
    }
  }

  loadAllUsers(): void {
    this.adminService.getUsers().subscribe(res => {
      this.dataSourceAll.data = res.data;
      setTimeout(() => this.dataSourceAll.paginator = this.paginatorAll);
    });
  }

  loadPautadores(): void {
    this.adminService.getUsers({ role: 'pautador' }).subscribe(res => {
      this.dataSourcePautadores.data = res.data;
      setTimeout(() => this.dataSourcePautadores.paginator = this.paginatorPautadores);
    });
  }

  loadConglomerado(): void {
    this.adminService.getUsers({ role: 'conglomerado' }).subscribe(res => {
      this.dataSourceConglomerado.data = res.data;
      setTimeout(() => this.dataSourceConglomerado.paginator = this.paginatorConglomerado);
    });
  }

  applyFilter(event: Event, ds: MatTableDataSource<any>): void {
    const value = (event.target as HTMLInputElement).value;
    ds.filter = value.trim().toLowerCase();
  }

  openForm(user?: any): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '500px',
      data: { user },
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) this.reloadCurrentTab();
    });
  }

  confirmToggleActive(user: any): void {
    const action = user.is_active ? 'desactivar' : 'activar';
    const confirmed = confirm(`¿Está seguro que desea ${action} al usuario "${user.full_name}"?`);
    if (confirmed) {
      this.toggleActive(user);
    }
  }

  toggleActive(user: any): void {
    this.adminService.toggleUserActive(user.id).subscribe({
      next: () => {
        this.notification.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
        this.reloadCurrentTab();
      },
      error: () => this.notification.error('Error al cambiar estado del usuario'),
    });
  }

  openAccountsDialog(user: any): void {
    import('../pautador-accounts-dialog/pautador-accounts-dialog.component').then(m => {
      this.dialog.open(m.PautadorAccountsDialogComponent, {
        width: '650px',
        data: { user }
      });
    });
  }

  private reloadCurrentTab(): void {
    // Reload all tabs that have data
    this.loadAllUsers();
    if (this.dataSourcePautadores.data.length > 0) this.loadPautadores();
    if (this.dataSourceConglomerado.data.length > 0) this.loadConglomerado();
  }
}
