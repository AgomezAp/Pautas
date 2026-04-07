import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { UserFormComponent } from '../user-form/user-form.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

interface TabData {
  allData: any[];
  filteredData: any[];
  pagedData: any[];
  pageSize: number;
  currentPage: number;
  filterValue: string;
  loaded: boolean;
}

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule, IconComponent, PaginationComponent, NgbTooltipModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  columnsAll = ['username', 'full_name', 'role', 'country_name', 'is_active', 'actions'];
  columnsPautadores = ['username', 'full_name', 'country_name', 'is_active', 'actions'];
  columnsConglomerado = ['username', 'full_name', 'country_name', 'campaign_name', 'is_active', 'actions'];

  tabs: TabData[] = [
    { allData: [], filteredData: [], pagedData: [], pageSize: 10, currentPage: 1, filterValue: '', loaded: false },
    { allData: [], filteredData: [], pagedData: [], pageSize: 10, currentPage: 1, filterValue: '', loaded: false },
    { allData: [], filteredData: [], pagedData: [], pageSize: 10, currentPage: 1, filterValue: '', loaded: false },
  ];

  activeTab = 0;

  constructor(
    private adminService: AdminService,
    private modal: NgbModal,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadAllUsers();
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    if (index === 1 && !this.tabs[1].loaded) {
      this.loadPautadores();
    } else if (index === 2 && !this.tabs[2].loaded) {
      this.loadConglomerado();
    }
  }

  loadAllUsers(): void {
    this.adminService.getUsers().subscribe(res => {
      this.tabs[0].allData = res.data;
      this.tabs[0].filteredData = [...res.data];
      this.tabs[0].loaded = true;
      this.updatePagedData(0);
    });
  }

  loadPautadores(): void {
    this.adminService.getUsers({ role: 'pautador' }).subscribe(res => {
      this.tabs[1].allData = res.data;
      this.tabs[1].filteredData = [...res.data];
      this.tabs[1].loaded = true;
      this.updatePagedData(1);
    });
  }

  loadConglomerado(): void {
    this.adminService.getUsers({ role: 'conglomerado' }).subscribe(res => {
      this.tabs[2].allData = res.data;
      this.tabs[2].filteredData = [...res.data];
      this.tabs[2].loaded = true;
      this.updatePagedData(2);
    });
  }

  applyFilter(event: Event, tabIndex: number): void {
    const tab = this.tabs[tabIndex];
    tab.filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    tab.filteredData = tab.allData.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(tab.filterValue))
    );
    tab.currentPage = 1;
    this.updatePagedData(tabIndex);
  }

  onPageChange(event: { page: number; pageSize: number }, tabIndex: number): void {
    const tab = this.tabs[tabIndex];
    tab.currentPage = event.page;
    tab.pageSize = event.pageSize;
    this.updatePagedData(tabIndex);
  }

  private updatePagedData(tabIndex: number): void {
    const tab = this.tabs[tabIndex];
    const start = (tab.currentPage - 1) * tab.pageSize;
    tab.pagedData = tab.filteredData.slice(start, start + tab.pageSize);
  }

  openForm(user?: any): void {
    const modalRef = this.modal.open(UserFormComponent, { size: 'lg', centered: true });
    modalRef.componentInstance.data = { user };
    modalRef.closed.subscribe(result => {
      if (result) this.reloadCurrentTab();
    });
  }

  confirmToggleActive(user: any): void {
    const action = user.is_active ? 'desactivar' : 'activar';
    const confirmed = confirm(`\u00bfEst\u00e1 seguro que desea ${action} al usuario "${user.full_name}"?`);
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
      const modalRef = this.modal.open(m.PautadorAccountsDialogComponent, { size: 'lg', centered: true });
      modalRef.componentInstance.data = { user };
    });
  }

  private reloadCurrentTab(): void {
    this.loadAllUsers();
    if (this.tabs[1].loaded) this.loadPautadores();
    if (this.tabs[2].loaded) this.loadConglomerado();
  }
}
