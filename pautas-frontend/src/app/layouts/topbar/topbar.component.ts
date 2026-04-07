import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, NgbDropdownModule, IconComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent {
  @Input() userName = '';
  @Input() roleLabel = '';
  @Output() menuToggle = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();

  get userInitials(): string {
    if (!this.userName) return '?';
    const parts = this.userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return this.userName.substring(0, 2).toUpperCase();
  }
}
