import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <aside class="sidebar" [class.sidebar--collapsed]="collapsed" role="navigation" aria-label="Menú principal">
      <!-- Logo -->
      <div class="sidebar__logo">
        <span class="sidebar__logo-mark" aria-hidden="true">P</span>
        @if (!collapsed) {
          <span class="sidebar__logo-text">Pautas</span>
        }
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav" aria-label="Navegación">
        @for (item of navItems; track item.route) {
          <a
            class="sidebar__link"
            [routerLink]="item.route"
            routerLinkActive="sidebar__link--active"
            [routerLinkActiveOptions]="{ exact: item.route === '/admin' || item.route === '/pautadores' || item.route === '/conglomerado' || item.route === '/gestion' }"
            [attr.aria-label]="collapsed ? item.label : null"
            [attr.title]="collapsed ? item.label : null"
          >
            <mat-icon class="sidebar__link-icon" aria-hidden="true">{{ item.icon }}</mat-icon>
            @if (!collapsed) {
              <span class="sidebar__link-label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <!-- Footer: collapse toggle -->
      <div class="sidebar__footer">
        <button class="sidebar__toggle" (click)="toggleCollapse()"
                [attr.aria-label]="collapsed ? 'Expandir menú' : 'Colapsar menú'">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .sidebar {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width);
      height: 100%;
      background: var(--brand-primary);
      color: var(--gray-0);
      transition: width var(--duration-base) var(--ease-out);
      overflow: hidden;
    }
    .sidebar--collapsed {
      width: var(--sidebar-collapsed);
    }

    /* Logo */
    .sidebar__logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-5);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      min-height: var(--topbar-height);
    }
    .sidebar__logo-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--brand-accent);
      color: var(--brand-primary);
      font-weight: var(--weight-bold);
      font-size: var(--text-lg);
      border-radius: var(--radius-md);
      flex-shrink: 0;
    }
    .sidebar__logo-text {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--brand-accent);
      letter-spacing: var(--tracking-tight);
      white-space: nowrap;
    }

    /* Nav */
    .sidebar__nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-3) var(--space-2);
      overflow-y: auto;
    }
    .sidebar__link {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: rgba(255,255,255,0.55);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      text-decoration: none;
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-out),
                  background-color var(--duration-fast) var(--ease-out);
      white-space: nowrap;
    }
    .sidebar__link:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.06);
    }
    .sidebar__link--active {
      color: var(--brand-primary) !important;
      background: var(--brand-accent) !important;
      font-weight: var(--weight-semibold);
    }
    .sidebar__link--active .sidebar__link-icon {
      color: var(--brand-primary);
    }
    .sidebar__link-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: rgba(255,255,255,0.45);
      transition: color var(--duration-fast) var(--ease-out);
    }
    .sidebar__link:hover .sidebar__link-icon {
      color: rgba(255,255,255,0.8);
    }
    .sidebar__link-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Collapsed tooltip style handled by parent layout if needed */
    .sidebar--collapsed .sidebar__link {
      justify-content: center;
      padding: var(--space-2);
    }
    .sidebar--collapsed .sidebar__logo {
      justify-content: center;
      padding: var(--space-3);
    }

    /* Footer */
    .sidebar__footer {
      padding: var(--space-3) var(--space-2);
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .sidebar__toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 36px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-out),
                  background-color var(--duration-fast) var(--ease-out);
    }
    .sidebar__toggle:hover {
      color: rgba(255,255,255,0.8);
      background: rgba(255,255,255,0.06);
    }
  `]
})
export class SidebarComponent {
  @Input() navItems: NavItem[] = [];
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }
}
