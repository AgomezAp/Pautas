import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '../../admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { CampaignFormComponent } from '../campaign-form/campaign-form.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-campaign-list',
  imports: [
    CommonModule, IconComponent, PaginationComponent,
  ],
  templateUrl: './campaign-list.component.html',
  styleUrl: './campaign-list.component.scss',
})
export class CampaignListComponent implements OnInit {
  allData: any[] = [];
  filteredData: any[] = [];
  pagedData: any[] = [];
  pageSize = 10;
  currentPage = 1;
  filterValue = '';

  constructor(
    private adminService: AdminService,
    private modal: NgbModal,
    private notification: NotificationService,
  ) {}

  ngOnInit(): void { this.loadCampaigns(); }

  loadCampaigns(): void {
    this.adminService.getCampaigns().subscribe(res => {
      this.allData = res.data;
      this.filteredData = [...this.allData];
      this.updatePagedData();
    });
  }

  applyFilter(event: Event): void {
    this.filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.filteredData = this.allData.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(this.filterValue))
    );
    this.currentPage = 1;
    this.updatePagedData();
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    this.currentPage = event.page;
    this.pageSize = event.pageSize;
    this.updatePagedData();
  }

  private updatePagedData(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedData = this.filteredData.slice(start, start + this.pageSize);
  }

  openForm(campaign?: any): void {
    const modalRef = this.modal.open(CampaignFormComponent, { size: 'lg', centered: true });
    modalRef.componentInstance.data = { campaign };
    modalRef.closed.subscribe(result => { if (result) this.loadCampaigns(); });
  }
}
