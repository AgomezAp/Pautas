import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AdminService } from '../../admin.service';
import { GoogleAdsIdPipe } from '../../../../shared/pipes/google-ads-id.pipe';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

interface AccountItem {
  customer_account_id: string;
  customer_account_name: string;
  selected: boolean;
}

@Component({
  selector: 'app-pautador-accounts-dialog',
  imports: [
    CommonModule, FormsModule,
    GoogleAdsIdPipe, IconComponent,
  ],
  templateUrl: './pautador-accounts-dialog.component.html',
  styleUrl: './pautador-accounts-dialog.component.scss',
})
export class PautadorAccountsDialogComponent implements OnInit {
  @Input() data: { user: any } = { user: null };

  allAccounts: AccountItem[] = [];
  filteredAccounts: AccountItem[] = [];
  searchTerm = '';
  loading = true;
  saving = false;

  constructor(
    public activeModal: NgbActiveModal,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    let allAccountsData: any[] = [];
    let assignedIds: string[] = [];
    let loadedCount = 0;

    const checkDone = () => {
      loadedCount++;
      if (loadedCount === 2) {
        this.allAccounts = allAccountsData.map(a => ({
          customer_account_id: a.customer_account_id,
          customer_account_name: a.customer_account_name,
          selected: assignedIds.includes(a.customer_account_id),
        }));
        this.filterAccounts();
        this.loading = false;
        this.cdr.detectChanges();
      }
    };

    this.adminService.getAllGoogleAdsAccounts().subscribe(res => {
      allAccountsData = res.data;
      checkDone();
    });

    this.adminService.getPautadorAccounts(this.data.user.id).subscribe(res => {
      assignedIds = res.data;
      checkDone();
    });
  }

  filterAccounts(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredAccounts = [...this.allAccounts];
    } else {
      this.filteredAccounts = this.allAccounts.filter(a =>
        (a.customer_account_name || '').toLowerCase().includes(term) ||
        (a.customer_account_id || '').includes(term)
      );
    }
    this.cdr.detectChanges();
  }

  get selectedCount(): number {
    return this.allAccounts.filter(a => a.selected).length;
  }

  onCancel(): void {
    this.activeModal.dismiss();
  }

  onSave(): void {
    this.saving = true;
    this.cdr.detectChanges();
    const selectedIds = this.allAccounts.filter(a => a.selected).map(a => a.customer_account_id);
    this.adminService.setPautadorAccounts(this.data.user.id, selectedIds).subscribe({
      next: () => {
        this.activeModal.close(true);
      },
      error: () => {
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }
}
