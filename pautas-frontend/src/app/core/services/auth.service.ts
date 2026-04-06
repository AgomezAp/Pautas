import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { API_URLS } from '../constants/api-urls';
import { ROLE_ROUTES } from '../constants/app.constants';
import { User, LoginResponse } from '../models/user.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken = signal<string | null>(localStorage.getItem('accessToken'));
  private currentUser = signal<User | null>(this.loadUserFromStorage());

  readonly isAuthenticated = computed(() => !!this.accessToken());
  readonly user = computed(() => this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role || null);

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(API_URLS.auth.login, { username, password }, { withCredentials: true })
      .pipe(
        tap(response => {
          this.accessToken.set(response.data.accessToken);
          this.currentUser.set(response.data.user);
          localStorage.setItem('accessToken', response.data.accessToken);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        })
      );
  }

  logout(): void {
    this.http.post(API_URLS.auth.logout, {}, { withCredentials: true }).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  refreshToken(): Observable<ApiResponse<{ accessToken: string }>> {
    return this.http.post<ApiResponse<{ accessToken: string }>>(API_URLS.auth.refresh, {}, { withCredentials: true })
      .pipe(
        tap(response => {
          this.accessToken.set(response.data.accessToken);
          localStorage.setItem('accessToken', response.data.accessToken);
        }),
        catchError(err => {
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  getProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(API_URLS.auth.me);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.put(API_URLS.auth.changePassword, { currentPassword, newPassword });
  }

  getToken(): string | null {
    return this.accessToken();
  }

  getRedirectUrl(): string {
    const role = this.userRole();
    return role ? (ROLE_ROUTES[role] || '/auth/login') : '/auth/login';
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    this.router.navigate(['/auth/login']);
  }

  private loadUserFromStorage(): User | null {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  }
}
