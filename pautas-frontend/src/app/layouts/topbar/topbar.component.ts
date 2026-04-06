import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule],
  template: `
    <header class="topbar" role="banner">
      <div class="topbar__left">
        <button class="topbar__menu-btn" (click)="menuToggle.emit()" aria-label="Toggle menú lateral">
          <mat-icon>menu</mat-icon>
        </button>
      </div>

      <div class="topbar__right">
        @if (roleLabel) {
          <span class="topbar__role-badge" role="status">{{ roleLabel }}</span>
        }
        <button class="topbar__avatar-btn" [matMenuTriggerFor]="userMenu"
                [attr.aria-label]="'Menú de usuario: ' + userName">
          <span class="topbar__avatar" aria-hidden="true">{{ userInitials }}</span>
        </button>
        <mat-menu #userMenu="matMenu" class="topbar-menu">
          <div class="topbar-menu__header" mat-menu-item disabled>
            <span class="topbar-menu__name">{{ userName }}</span>
            <span class="topbar-menu__role">{{ roleLabel }}</span>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logoutClick.emit()">
            <mat-icon>logout</mat-icon>
            <span>Cerrar sesión</span>
          </button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--topbar-height);
      padding: 0 var(--space-5);
      background: var(--gray-0);
      border-bottom: var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .topbar__left {
      display: flex;
      align-items: center;
    }
    .topbar__menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--gray-600);
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-out),
                  background-color var(--duration-fast) var(--ease-out);
    }
    .topbar__menu-btn:hover {
      color: var(--gray-900);
      background: var(--gray-100);
    }

    .topbar__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .topbar__role-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 12px;
      border-radius: var(--radius-full);
      background: var(--brand-accent);
      color: var(--brand-primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
    }

    .topbar__avatar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .topbar__avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: var(--radius-full);
      background: var(--brand-primary);
      color: var(--brand-accent);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-tight);
      transition: box-shadow var(--duration-fast) var(--ease-out);
    }
    .topbar__avatar-btn:hover .topbar__avatar {
      box-shadow: 0 0 0 3px var(--brand-accent-light);
    }

    /* Menu styling */
    .topbar-menu__header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-2) var(--space-4);
    }
    .topbar-menu__name {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--gray-900);
    }
    .topbar-menu__role {
      font-size: var(--text-xs);
      color: var(--gray-500);
    }
  `]
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
