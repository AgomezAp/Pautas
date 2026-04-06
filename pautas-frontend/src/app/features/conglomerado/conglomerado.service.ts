import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../../core/constants/api-urls';
import { ApiResponse } from '../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ConglomeradoService {
  constructor(private http: HttpClient) {}

  checkToday(): Observable<ApiResponse<{ submitted: boolean; entry: any }>> {
    return this.http.get<ApiResponse<{ submitted: boolean; entry: any }>>(API_URLS.conglomerado.entryToday);
  }

  submitEntry(formData: FormData): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(API_URLS.conglomerado.entry, formData);
  }

  getEntries(params?: any): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k]) httpParams = httpParams.set(k, params[k]);
      });
    }
    return this.http.get<ApiResponse<any[]>>(API_URLS.conglomerado.entries, { params: httpParams });
  }

  getWeeklySummary(isoYear?: number, isoWeek?: number): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    if (isoYear) httpParams = httpParams.set('iso_year', isoYear.toString());
    if (isoWeek) httpParams = httpParams.set('iso_week', isoWeek.toString());
    return this.http.get<ApiResponse<any>>(API_URLS.conglomerado.weeklySummary, { params: httpParams });
  }
}
