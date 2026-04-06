import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class GoogleAdsService {
  constructor(private http: HttpClient) {}

  getMyAccounts(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(API_URLS.googleAds.myAccounts);
  }

  getCampaigns(countryId?: number): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (countryId) params = params.set('country_id', countryId);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.campaigns, { params });
  }

  getCampaignsByAccount(countryId?: number, accountIds?: string[]): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();
    if (countryId) params = params.set('country_id', countryId);
    if (accountIds && accountIds.length > 0) params = params.set('account_ids', accountIds.join(','));
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.campaignsByAccount, { params });
  }

  getCampaignHistory(campaignId: number, days = 30): Observable<ApiResponse<any[]>> {
    const params = new HttpParams().set('days', days);
    return this.http.get<ApiResponse<any[]>>(`${API_URLS.googleAds.campaignHistory}/${campaignId}/history`, { params });
  }

  getBillingAccounts(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.billingAccounts);
  }

  getBillingHistory(page = 1, limit = 25): Observable<ApiResponse<any[]>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.billingHistory, { params });
  }

  getAccountCharges(page = 1, limit = 50): Observable<ApiResponse<any[]>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.accountCharges, { params });
  }

  getRecharges(page = 1, limit = 50, filters?: any, accountIds?: string[]): Observable<ApiResponse<any[]>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (filters) {
      Object.keys(filters).forEach(k => {
        if (filters[k]) params = params.set(k, filters[k]);
      });
    }
    if (accountIds && accountIds.length > 0) params = params.set('account_ids', accountIds.join(','));
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.recharges, { params });
  }

  exportRechargesCsv(filters?: any): void {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(k => {
        if (filters[k]) params = params.set(k, filters[k]);
      });
    }
    this.http.get(API_URLS.googleAds.rechargesExport, { params, responseType: 'blob' }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recargas.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  triggerSync(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.googleAds.sync, {});
  }
}
