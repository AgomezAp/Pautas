import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URLS } from '../constants/api-urls';
import { Country } from '../models/country.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class CountryService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Country[]>> {
    return this.http.get<ApiResponse<Country[]>>(API_URLS.system.countries);
  }
}
