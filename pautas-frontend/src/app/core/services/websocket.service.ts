import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';

export interface WsAlert {
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: any;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private _alerts$ = new Subject<WsAlert>();
  readonly alerts$ = this._alerts$.asObservable();

  constructor(private toastService: ToastService) {}

  connect(): void {
    const token = localStorage.getItem('accessToken');
    if (!token || this.socket?.connected) return;

    // Derive WS URL from API URL (remove /api/v1 suffix)
    const baseUrl = environment.apiUrl.replace('/api/v1', '');

    this.socket = io(baseUrl, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    this.socket.on('alert:new', (alert: WsAlert) => {
      this._alerts$.next(alert);
      this.showAlertToast(alert);
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    this.socket.on('connect_error', (err: Error) => {
      console.warn('[WS] Connection error:', err.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private showAlertToast(alert: WsAlert): void {
    const severity = alert.severity?.toLowerCase();
    switch (severity) {
      case 'critical':
        this.toastService.error(`${alert.title}: ${alert.message}`, 10000);
        break;
      case 'high':
        this.toastService.warning(`${alert.title}: ${alert.message}`, 7000);
        break;
      case 'medium':
        this.toastService.info(`${alert.title}: ${alert.message}`, 5000);
        break;
      default:
        this.toastService.info(`${alert.title}: ${alert.message}`, 4000);
        break;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
