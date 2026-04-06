import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../core/constants/api-urls';
import { ApiResponse } from '../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  // Users
  getUsers(params?: any): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.users, { params: httpParams });
  }

  getUserById(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${API_URLS.admin.users}/${id}`);
  }

  createUser(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.admin.users, data);
  }

  updateUser(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${API_URLS.admin.users}/${id}`, data);
  }

  toggleUserActive(id: number): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${API_URLS.admin.users}/${id}/toggle-active`, {});
  }

  deleteUser(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${API_URLS.admin.users}/${id}`);
  }

  // Campaigns
  getCampaigns(params?: any): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.campaigns, { params: httpParams });
  }

  createCampaign(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.admin.campaigns, data);
  }

  updateCampaign(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${API_URLS.admin.campaigns}/${id}`, data);
  }

  // Countries
  getCountries(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.countries);
  }

  createCountry(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.admin.countries, data);
  }

  updateCountry(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${API_URLS.admin.countries}/${id}`, data);
  }

  // Roles
  getRoles(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.roles);
  }

  // Stats
  getStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(API_URLS.admin.stats);
  }

  // Recharges Dashboard
  getRechargesDashboard(filters?: any): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(k => {
        if (filters[k] !== null && filters[k] !== undefined && filters[k] !== '') {
          httpParams = httpParams.set(k, filters[k]);
        }
      });
    }
    return this.http.get<ApiResponse<any>>(API_URLS.admin.rechargesDashboard, { params: httpParams });
  }

  // Audit Log
  getAuditLog(params?: any): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k]) httpParams = httpParams.set(k, params[k]);
      });
    }
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.auditLog, { params: httpParams });
  }

  // Google Ads Accounts
  getPautadorAccounts(userId: number): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(API_URLS.admin.pautadorAccounts(userId));
  }

  setPautadorAccounts(userId: number, accountIds: string[]): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(API_URLS.admin.pautadorAccounts(userId), { account_ids: accountIds });
  }

  getAllGoogleAdsAccounts(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.admin.allGoogleAdsAccounts);
  }
}
