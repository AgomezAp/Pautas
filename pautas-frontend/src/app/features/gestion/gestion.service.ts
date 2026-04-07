import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../core/constants/api-urls';
import { ApiResponse } from '../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class GestionService {
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

  getDashboardKpis(params?: any): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(API_URLS.gestion.dashboardKpis, { params: this.buildParams(params) });
  }

  getEffectivenessReport(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.reportsEffectiveness, { params: this.buildParams(params) });
  }

  getConversionReport(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.reportsConversions, { params: this.buildParams(params) });
  }

  getByCountryReport(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.reportsByCountry);
  }

  getByWeekReport(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.reportsByWeek, { params: this.buildParams(params) });
  }

  // Campaign rotation methods
  rotateCampaign(data: { campaign_id: number; new_user_id: number; reason?: string; effective_date?: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.gestion.rotations, data);
  }

  getRotationHistory(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.rotations, { params: this.buildParams(params) });
  }

  getAvailableUsers(countryId?: number): Observable<ApiResponse<any[]>> {
    const params = countryId ? { country_id: countryId.toString() } : {};
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.rotationsAvailableUsers, { params: this.buildParams(params) });
  }

  getActiveCampaigns(countryId?: number): Observable<ApiResponse<any[]>> {
    const params = countryId ? { country_id: countryId.toString() } : {};
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.rotationsCampaigns, { params: this.buildParams(params) });
  }

  getEntriesWithImages(params?: any): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.soporteImages, { params: this.buildParams(params) });
  }

  getConglomeradoUsers(countryId?: number): Observable<ApiResponse<any[]>> {
    const params = countryId ? { country_id: countryId.toString() } : {};
    return this.http.get<ApiResponse<any[]>>(API_URLS.gestion.conglomeradoUsers, { params: this.buildParams(params) });
  }

  createConglomeradoUser(data: {
    username: string;
    full_name: string;
    email?: string;
    password?: string;
    country_id: number;
    campaign_id?: number;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.gestion.conglomeradoUsers, data);
  }
}
