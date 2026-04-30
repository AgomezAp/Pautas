import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { InAppNotificationsService } from '../../core/services/in-app-notifications.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, NgbDropdownModule, IconComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Input() userName = '';
  @Input() roleLabel = '';
  @Output() menuToggle = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();

  unreadCount = 0;
  private sub?: Subscription;

  constructor(private notifService: InAppNotificationsService) {}

  ngOnInit(): void {
    this.sub = this.notifService.unreadCount$.subscribe(c => this.unreadCount = c);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  markAllNotificationsRead(): void {
    this.notifService.markAllAsRead().subscribe();
  }

  get userInitials(): string {
    if (!this.userName) return '?';
    const parts = this.userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return this.userName.substring(0, 2).toUpperCase();
  }
}
