import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../core/constants/api-urls';
import { ApiResponse } from '../../core/models/api-response.model';
import {
  Alert,
  AlertSummary,
  AlertTrendItem,
  TopAlertedUser,
  AlertThreshold,
  ConglomerateRanking,
  AdsComparison,
  AlertFilters,
} from '../../core/models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  constructor(private http: HttpClient) {}

  getAlerts(filters?: AlertFilters): Observable<ApiResponse<Alert[]>> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<ApiResponse<Alert[]>>(API_URLS.alerts.list, { params });
  }

  getSummary(): Observable<ApiResponse<AlertSummary>> {
    return this.http.get<ApiResponse<AlertSummary>>(API_URLS.alerts.summary);
  }

  getTrend(): Observable<ApiResponse<AlertTrendItem[]>> {
    return this.http.get<ApiResponse<AlertTrendItem[]>>(API_URLS.alerts.trend);
  }

  getTopAlerted(limit = 10): Observable<ApiResponse<TopAlertedUser[]>> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<ApiResponse<TopAlertedUser[]>>(API_URLS.alerts.topAlerted, { params });
  }

  acknowledge(id: number): Observable<ApiResponse<Alert>> {
    return this.http.patch<ApiResponse<Alert>>(`${API_URLS.alerts.list}/${id}/acknowledge`, {});
  }

  resolve(id: number): Observable<ApiResponse<Alert>> {
    return this.http.patch<ApiResponse<Alert>>(`${API_URLS.alerts.list}/${id}/resolve`, {});
  }

  dismiss(id: number): Observable<ApiResponse<Alert>> {
    return this.http.patch<ApiResponse<Alert>>(`${API_URLS.alerts.list}/${id}/dismiss`, {});
  }

  getThresholds(): Observable<ApiResponse<AlertThreshold[]>> {
    return this.http.get<ApiResponse<AlertThreshold[]>>(API_URLS.alerts.thresholds);
  }

  updateThreshold(data: {
    alert_type: string;
    country_id?: number | null;
    campaign_id?: number | null;
    threshold_value: number;
    is_active?: boolean;
  }): Observable<ApiResponse<AlertThreshold>> {
    return this.http.put<ApiResponse<AlertThreshold>>(API_URLS.alerts.thresholds, data);
  }

  getRanking(countryId?: number): Observable<ApiResponse<ConglomerateRanking[]>> {
    let params = new HttpParams();
    if (countryId) params = params.set('country_id', String(countryId));
    return this.http.get<ApiResponse<ConglomerateRanking[]>>(API_URLS.alerts.ranking, { params });
  }

  getAdsComparison(filters?: { country_id?: number; date_from?: string; date_to?: string }): Observable<ApiResponse<AdsComparison[]>> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<ApiResponse<AdsComparison[]>>(API_URLS.alerts.adsComparison, { params });
  }
}
