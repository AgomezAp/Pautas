import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _counter = 0;
  private _toasts$ = new Subject<Toast>();
  private _dismiss$ = new Subject<number>();

  readonly toasts$ = this._toasts$.asObservable();
  readonly dismiss$ = this._dismiss$.asObservable();

  success(message: string, duration = 3000): void {
    this._emit('success', message, duration);
  }

  error(message: string, duration = 5000): void {
    this._emit('error', message, duration);
  }

  warning(message: string, duration = 4000): void {
    this._emit('warning', message, duration);
  }

  info(message: string, duration = 3000): void {
    this._emit('info', message, duration);
  }

  dismiss(id: number): void {
    this._dismiss$.next(id);
  }

  private _emit(type: Toast['type'], message: string, duration: number): void {
    this._toasts$.next({ id: ++this._counter, type, message, duration });
  }
}
