import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../../core/constants/api-urls';
import { ApiResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class GoogleAdsAnalysisService {
  constructor(private http: HttpClient) {}

  getDataRange(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisDataRange);
  }

  getSpendingTrend(params: {
    granularity: string;
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('granularity', params.granularity)
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisSpendingTrend, { params: httpParams });
  }

  getPerformance(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisPerformance, { params: httpParams });
  }

  getRankings(params: {
    metric: string;
    sort: string;
    limit: number;
    date_from: string;
    date_to: string;
  }): Observable<ApiResponse<any[]>> {
    const httpParams = new HttpParams()
      .set('metric', params.metric)
      .set('sort', params.sort)
      .set('limit', params.limit)
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisRankings, { params: httpParams });
  }

  getBudgetDistribution(countryId?: number): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (countryId) httpParams = httpParams.set('country_id', countryId);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisBudgetDistribution, { params: httpParams });
  }

  getConglomeradoContrast(params: {
    date_from: string;
    date_to: string;
    country_id?: number;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.conglomeradoContrast, { params: httpParams });
  }
}
