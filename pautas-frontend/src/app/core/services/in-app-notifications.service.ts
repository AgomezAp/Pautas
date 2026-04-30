import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, Subscription } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { API_URLS } from '../constants/api-urls';
import { ApiResponse } from '../models/api-response.model';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class InAppNotificationsService {
  private unreadCount = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadCount.asObservable();
  private pollSub?: Subscription;

  constructor(private http: HttpClient) {}

  startPolling(): void {
    if (this.pollSub) return;
    this.getUnreadCount().subscribe();
    this.pollSub = interval(30_000).pipe(
      switchMap(() => this.getUnreadCount())
    ).subscribe();
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  getAll(): Observable<ApiResponse<AppNotification[]>> {
    return this.http.get<ApiResponse<AppNotification[]>>(API_URLS.notifications.list);
  }

  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(API_URLS.notifications.unread).pipe(
      tap(res => this.unreadCount.next(res.data.count))
    );
  }

  markAsRead(id: number): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(API_URLS.notifications.markRead(id), {}).pipe(
      tap(() => this.unreadCount.next(Math.max(0, this.unreadCount.value - 1)))
    );
  }

  markAllAsRead(): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(API_URLS.notifications.markAllRead, {}).pipe(
      tap(() => this.unreadCount.next(0))
    );
  }

  pushUnread(count: number): void {
    this.unreadCount.next(count);
  }
}
