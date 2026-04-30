import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast-container',
  imports: [CommonModule, IconComponent],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: (Toast & { _leaving?: boolean })[] = [];
  private subs: Subscription[] = [];
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private toastService: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.subs.push(
      this.toastService.toasts$.subscribe(toast => {
        // Defer push to avoid ExpressionChangedAfterItHasBeenCheckedError
        // when toast is triggered from within an active change detection cycle
        setTimeout(() => {
          this.toasts.push(toast);
          this.scheduleRemoval(toast);
          this.cdr.detectChanges();
        }, 0);
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
