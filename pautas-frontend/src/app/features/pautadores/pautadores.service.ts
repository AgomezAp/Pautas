import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../core/constants/api-urls';
import { ApiResponse } from '../../core/models/api-response.model';
import { KpiData, ChartData } from '../../core/models/kpi.model';

@Injectable({ providedIn: 'root' })
export class PautadoresService {
  constructor(private http: HttpClient) {}

  private buildParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined && params[k] !== '') {
          httpParams = httpParams.set(k, params[k]);
        }
      });
    }
    return httpParams;
  }

  getEntriesDaily(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.entriesDaily, { params: this.buildParams(params) });
  }

  getEntriesWeekly(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.entriesWeekly, { params: this.buildParams(params) });
  }

  getEntriesWeeklyCalendar(params?: any): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(API_URLS.pautadores.entriesWeeklyCalendar, { params: this.buildParams(params) });
  }

  getConsolidated(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.consolidated, { params: this.buildParams(params) });
  }

  getCampaigns(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.campaigns, { params: this.buildParams(params) });
  }

  getDashboardKpis(params?: any): Observable<ApiResponse<KpiData>> {
    return this.http.get<ApiResponse<KpiData>>(API_URLS.pautadores.dashboardKpis, { params: this.buildParams(params) });
  }

  getDashboardCharts(params?: any): Observable<ApiResponse<ChartData>> {
    return this.http.get<ApiResponse<ChartData>>(API_URLS.pautadores.dashboardCharts, { params: this.buildParams(params) });
  }
}
