import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="sync-indicator" [class.sync-indicator--active]="syncing">
      <span class="sync-indicator__dot" [class.sync-indicator__dot--active]="syncing"></span>
      <span class="sync-indicator__label">{{ syncing ? 'Sincronizando...' : label }}</span>
    </span>
  `,
  styles: [`
    .sync-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-xs);
      color: var(--gray-500);
    }
    .sync-indicator--active {
      color: var(--info-dark);
    }
    .sync-indicator__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--success);
      flex-shrink: 0;
      position: relative;
    }
    .sync-indicator__dot--active {
      background: var(--info);
    }
    .sync-indicator__dot--active::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: var(--radius-full);
      background: var(--info);
      animation: syncPulse 1.2s ease-out infinite;
    }
    .sync-indicator__label {
      white-space: nowrap;
    }
  `]
})
export class SyncIndicatorComponent {
  @Input() syncing = false;
  @Input() label = 'Sincronizado';
}
