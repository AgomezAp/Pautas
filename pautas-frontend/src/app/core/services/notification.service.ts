import { Injectable } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * Legacy wrapper — delegates to ToastService.
 * Existing consumers can keep using NotificationService without changes.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private toast: ToastService) {}

  success(message: string): void {
    this.toast.success(message);
  }

  error(message: string): void {
    this.toast.error(message);
  }

  info(message: string): void {
    this.toast.info(message);
  }
}
