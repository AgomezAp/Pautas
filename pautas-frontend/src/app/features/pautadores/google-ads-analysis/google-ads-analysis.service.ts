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
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('granularity', params.granularity)
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisSpendingTrend, { params: httpParams });
  }

  getPerformance(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
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

  getCampaignTypes(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCampaignTypes, { params: httpParams });
  }

  getBiddingStrategies(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisBiddingStrategies, { params: httpParams });
  }

  getKeywords(params: {
    date_from: string;
    date_to: string;
    metric?: string;
    match_type?: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
    limit?: number;
    group_by?: string;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.metric) httpParams = httpParams.set('metric', params.metric);
    if (params.match_type) httpParams = httpParams.set('match_type', params.match_type);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    if (params.limit) httpParams = httpParams.set('limit', params.limit);
    if (params.group_by) httpParams = httpParams.set('group_by', params.group_by);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisKeywords, { params: httpParams });
  }

  getKeywordQuality(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisKeywordQuality, { params: httpParams });
  }

  getDevices(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisDevices, { params: httpParams });
  }

  getHourlyHeatmap(params: {
    date_from: string;
    date_to: string;
    metric?: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.metric) httpParams = httpParams.set('metric', params.metric);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisHourlyHeatmap, { params: httpParams });
  }

  // ========== Budget Intelligence ==========

  getBudgetPacing(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisBudgetPacing, { params: httpParams });
  }

  getWasteDetection(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisWasteDetection, { params: httpParams });
  }

  getOptimalSchedule(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisOptimalSchedule, { params: httpParams });
  }

  getBudgetForecast(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisBudgetForecast, { params: httpParams });
  }

  getBudgetRedistribution(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisBudgetRedistribution, { params: httpParams });
  }

  // ========== Phase 2: Comparaciones & Tendencias ==========

  getTemporalComparison(params: {
    date_from_1: string;
    date_to_1: string;
    date_from_2: string;
    date_to_2: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams()
      .set('date_from_1', params.date_from_1)
      .set('date_to_1', params.date_to_1)
      .set('date_from_2', params.date_from_2)
      .set('date_to_2', params.date_to_2);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisTemporalComparison, { params: httpParams });
  }

  getCPAAnalysis(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCPAAnalysis, { params: httpParams });
  }

  getQualityScoreTrend(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisQualityScoreTrend, { params: httpParams });
  }

  getCPCTrend(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCPCTrend, { params: httpParams });
  }

  getSeasonality(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisSeasonality, { params: httpParams });
  }

  // ========== Phase 4: Search Terms & Keywords ==========

  getSearchTerms(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
    limit?: number;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    if (params.limit) httpParams = httpParams.set('limit', params.limit);
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisSearchTerms, { params: httpParams });
  }

  getNegativeKeywordCandidates(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisNegativeKeywordCandidates, { params: httpParams });
  }

  getLongTailAnalysis(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisLongTail, { params: httpParams });
  }

  getKeywordCannibalization(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisKeywordCannibalization, { params: httpParams });
  }

  // ========== Phase 5: Ad Performance & Fatigue Detection ==========

  getAdPerformanceComparison(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAdPerformanceComparison, { params: httpParams });
  }

  getAdFatigueDetection(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAdFatigue, { params: httpParams });
  }

  getAdTypePerformance(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAdTypePerformance, { params: httpParams });
  }

  // ========== Phase 6: Competitive Intelligence / Auction Insights ==========

  getAuctionInsights(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAuctionInsights, { params: httpParams });
  }

  getCompetitivePosition(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCompetitivePosition, { params: httpParams });
  }

  getMarketOpportunities(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisMarketOpportunities, { params: httpParams });
  }

  getConglomeradoContrast(params: {
    date_from: string;
    date_to: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.pautadores.conglomeradoContrast, { params: httpParams });
  }

  // ========== Phase 7: Demographics ==========

  getAgeBreakdown(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAgeBreakdown, { params: httpParams });
  }

  getGenderBreakdown(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisGenderBreakdown, { params: httpParams });
  }

  // ========== Phase 9: Enhanced Tabs ==========

  getDeviceBidRecommendations(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisDeviceBidRecommendations, { params: httpParams });
  }

  getDeviceExclusions(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisDeviceExclusions, { params: httpParams });
  }

  getKeywordActionPlan(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisKeywordActionPlan, { params: httpParams });
  }

  getMatchTypeRecommendations(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisMatchTypeRecommendations, { params: httpParams });
  }

  getCrossAccountKeywords(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCrossAccountKeywords, { params: httpParams });
  }

  getFullForecast(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisFullForecast, { params: httpParams });
  }

  getScalingHealth(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisScalingHealth, { params: httpParams });
  }

  getCompetitiveMarketTrend(params: {
    date_from: string;
    date_to: string;
    account_id?: string;
    country_id?: number;
    my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams()
      .set('date_from', params.date_from)
      .set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCompetitiveMarketTrend, { params: httpParams });
  }

  // ========== Phase 10: Dashboard Ejecutivo ==========

  getAccountHealthScores(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAccountHealthScores, { params: httpParams });
  }

  getExecutiveSummary(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisExecutiveSummary, { params: httpParams });
  }

  getTopRecommendations(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisTopRecommendations, { params: httpParams });
  }

  // ========== Phase 11: Auditoria Financiera ==========

  getZombieKeywords(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisZombieKeywords, { params: httpParams });
  }

  getVampireCampaigns(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisVampireCampaigns, { params: httpParams });
  }

  getConsolidatedActionPlan(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisConsolidatedActionPlan, { params: httpParams });
  }

  // ========== Phase 12: Benchmark Cross-Account ==========

  getAccountBenchmark(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAccountBenchmark, { params: httpParams });
  }

  getPortfolioRecommendation(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisPortfolioRecommendation, { params: httpParams });
  }

  getAccountPatterns(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAccountPatterns, { params: httpParams });
  }

  // ========== Wave 4: Landing Pages, Funnel, Month Comparison ==========

  getLandingPages(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisLandingPages, { params: httpParams });
  }

  getConversionFunnel(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisConversionFunnel, { params: httpParams });
  }

  getMonthComparison(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any>>(API_URLS.googleAds.analysisMonthComparison, { params: httpParams });
  }

  // ========== Wave 5A: Asset Analysis ==========

  getAssetSummary(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAssetSummary, { params: httpParams });
  }

  getAssetHeadlines(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAssetHeadlines, { params: httpParams });
  }

  getAssetDescriptions(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAssetDescriptions, { params: httpParams });
  }

  getAssetSitelinks(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisAssetSitelinks, { params: httpParams });
  }

  // ========== Geography ==========

  getGeoPerformance(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisGeo, { params: httpParams });
  }

  getCountryEfficiency(params: {
    date_from: string; date_to: string; account_id?: string; country_id?: number; my_accounts?: boolean;
  }): Observable<ApiResponse<any[]>> {
    let httpParams = new HttpParams().set('date_from', params.date_from).set('date_to', params.date_to);
    if (params.account_id) httpParams = httpParams.set('account_id', params.account_id);
    if (params.country_id) httpParams = httpParams.set('country_id', params.country_id);
    if (params.my_accounts) httpParams = httpParams.set('my_accounts', 'true');
    return this.http.get<ApiResponse<any[]>>(API_URLS.googleAds.analysisCountryEfficiency, { params: httpParams });
  }
}
