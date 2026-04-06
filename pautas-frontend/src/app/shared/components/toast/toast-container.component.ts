import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="toast-container">
      @for (toast of toasts; track toast.id) {
        <div class="toast toast--{{ toast.type }}" [class.toast--leaving]="toast._leaving">
          <mat-icon class="toast__icon">{{ iconFor(toast.type) }}</mat-icon>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close" (click)="remove(toast)">
            <mat-icon>close</mat-icon>
          </button>
          <div class="toast__progress" [style.animation-duration.ms]="toast.duration"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: var(--space-5);
      right: var(--space-5);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-width: 380px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--gray-0);
      border: var(--border-subtle);
      box-shadow: var(--shadow-lg);
      animation: toastSlideIn var(--duration-moderate) var(--ease-spring) forwards;
      pointer-events: auto;
      position: relative;
      overflow: hidden;
    }
    .toast--leaving {
      animation: toastSlideOut var(--duration-fast) var(--ease-out) forwards;
    }

    .toast__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .toast--success .toast__icon { color: var(--success-dark); }
    .toast--error .toast__icon { color: var(--danger-dark); }
    .toast--warning .toast__icon { color: var(--warning-dark); }
    .toast--info .toast__icon { color: var(--info-dark); }

    .toast__message {
      flex: 1;
      font-size: var(--text-sm);
      color: var(--gray-900);
      line-height: var(--leading-normal);
    }

    .toast__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--gray-400);
      cursor: pointer;
      flex-shrink: 0;
      transition: color var(--duration-fast) var(--ease-out),
                  background-color var(--duration-fast) var(--ease-out);
    }
    .toast__close:hover {
      color: var(--gray-700);
      background: var(--gray-100);
    }
    .toast__close mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .toast__progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      animation: toastProgress linear forwards;
    }
    .toast--success .toast__progress { background: var(--success); }
    .toast--error .toast__progress { background: var(--danger); }
    .toast--warning .toast__progress { background: var(--warning); }
    .toast--info .toast__progress { background: var(--info); }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: (Toast & { _leaving?: boolean })[] = [];
  private subs: Subscription[] = [];
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.subs.push(
      this.toastService.toasts$.subscribe(toast => {
        this.toasts.push(toast);
        this.scheduleRemoval(toast);
      }),
      this.toastService.dismiss$.subscribe(id => {
        const t = this.toasts.find(x => x.id === id);
        if (t) this.remove(t);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.timers.forEach(t => clearTimeout(t));
  }

  remove(toast: Toast & { _leaving?: boolean }): void {
    if (toast._leaving) return;
    toast._leaving = true;
    const existing = this.timers.get(toast.id);
    if (existing) clearTimeout(existing);
    // Wait for exit animation then remove from array
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
      this.timers.delete(toast.id);
    }, 150);
  }

  iconFor(type: Toast['type']): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
    }
  }

  private scheduleRemoval(toast: Toast): void {
    const timer = setTimeout(() => this.remove(toast), toast.duration);
    this.timers.set(toast.id, timer);
  }
}
