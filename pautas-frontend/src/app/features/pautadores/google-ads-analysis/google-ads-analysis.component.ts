import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { HttpClient } from '@angular/common/http';
import { GoogleAdsAnalysisService } from './google-ads-analysis.service';
import { CountryService } from '../../../core/services/country.service';
import { Country } from '../../../core/models/country.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { API_URLS } from '../../../core/constants/api-urls';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

@Component({
  selector: 'app-google-ads-analysis',
  imports: [
    CommonModule, FormsModule, NgbTooltipModule,
    BaseChartDirective, IconComponent,
  ],
  templateUrl: './google-ads-analysis.component.html',
  styleUrl: './google-ads-analysis.component.scss',
})
export class GoogleAdsAnalysisComponent implements OnInit {
  countries: Country[] = [];
  filterDateFrom = '';
  filterDateTo = '';
  filterCountryId: number | null = null;

  // Sync & Auth
  syncing = false;
  isPautador = false;
  isAdmin = false;
  showOnlyMine = true;
  myAccountIds: string[] = [];

  // Tab 1 - Spending Trend
  granularity = 'daily';
  loadingTrend = false;
  spendingTrendData: any[] = [];
  lineChartData: ChartConfiguration<'line'>['data'] | null = null;
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16 } },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12 },
        bodySpacing: 6,
        usePointStyle: true,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            return items[0].label || '';
          },
          label: (ctx) => {
            const val = Number(ctx.parsed.y) || 0;
            const label = ctx.dataset.label || '';
            const formatted = val >= 1_000_000
              ? `$${(val / 1_000_000).toFixed(2)}M`
              : `$${val.toLocaleString('es-CO')}`;
            return ` ${label}: ${formatted}`;
          },
          afterBody: (items) => {
            if (!items.length || !this.spendingTrendData.length) return '';
            const idx = items[0].dataIndex;
            const row = this.spendingTrendData[idx];
            if (!row) return '';
            const lines: string[] = [];
            if (row.campaigns_count != null) {
              lines.push(`  Campanas activas: ${row.campaigns_count}`);
            }
            const cost = Number(row.total_cost) || 0;
            const budget = Number(row.total_budget) || 0;
            if (budget > 0) {
              const pct = ((cost / budget) * 100).toFixed(1);
              lines.push(`  Ejecucion: ${pct}%`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true, position: 'left',
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
            return String(value);
          },
        },
        title: { display: true, text: 'Costo', font: { size: 11 }, color: '#888' },
      },
      y1: {
        beginAtZero: true, position: 'right',
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + 'M';
            if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
            return String(value);
          },
        },
        title: { display: true, text: 'Presupuesto', font: { size: 11 }, color: '#888' },
      },
      x: { grid: { display: false } },
    },
  };

  // Tab 2 - Performance
  loadingPerformance = false;
  performanceData: any[] = [];
  performanceBarData: ChartConfiguration<'bar'>['data'] | null = null;
  performanceBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          title: (items) => items.length ? String(items[0].label) : '',
          label: (ctx) => {
            const val = Number(ctx.parsed.x) || 0;
            return ` CPC: $${val.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          },
          afterLabel: (ctx) => {
            const row = this.performanceData
              .sort((a: any, b: any) => Number(b.cpc) - Number(a.cpc))[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.total_cost != null) lines.push(` Costo total: $${Number(row.total_cost).toLocaleString('es-CO')}`);
            if (row.total_clicks != null) lines.push(` Clicks: ${Number(row.total_clicks).toLocaleString('es-CO')}`);
            if (row.total_impressions != null) lines.push(` Impresiones: ${Number(row.total_impressions).toLocaleString('es-CO')}`);
            if (row.ctr != null) lines.push(` CTR: ${row.ctr}%`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'CPC', font: { size: 11 }, color: '#888' },
      },
      y: { grid: { display: false } },
    },
  };

  // Tab 3 - Rankings
  rankingMetric = 'spend';
  rankingSort = 'top';
  loadingRankings = false;
  rankingsData: any[] = [];
  rankingsBarData: ChartConfiguration<'bar'>['data'] | null = null;
  rankingsBarOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          title: (items) => items.length ? String(items[0].label) : '',
          label: (ctx) => {
            const val = Number(ctx.parsed.x) || 0;
            const label = this.getMetricLabel();
            if (this.rankingMetric === 'spend') {
              return ` ${label}: $${val.toLocaleString('es-CO')}`;
            }
            return ` ${label}: ${val.toLocaleString('es-CO')}`;
          },
          afterLabel: (ctx) => {
            const row = this.rankingsData[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.total_cost != null) lines.push(` Costo: $${Number(row.total_cost).toLocaleString('es-CO')}`);
            if (row.total_clicks != null) lines.push(` Clicks: ${Number(row.total_clicks).toLocaleString('es-CO')}`);
            if (row.total_conversions != null) lines.push(` Conversiones: ${Number(row.total_conversions).toLocaleString('es-CO')}`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' },
      },
      y: { grid: { display: false } },
    },
  };

  // Tab 4 - Budget Distribution
  loadingBudget = false;
  budgetData: any[] = [];
  doughnutChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(20,20,20,0.92)',
        cornerRadius: 8,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        bodyFont: { size: 12 },
        bodySpacing: 4,
        callbacks: {
          label: (ctx) => {
            const val = Number(ctx.parsed) || 0;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + Number(b), 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            return ` Presupuesto: $${val.toLocaleString('es-CO')} (${pct}%)`;
          },
          afterLabel: (ctx) => {
            const row = this.budgetData[ctx.dataIndex];
            if (!row) return '';
            const lines: string[] = [];
            if (row.spent != null) lines.push(` Gastado: $${Number(row.spent).toLocaleString('es-CO')}`);
            if (row.execution_pct != null) lines.push(` Ejecucion: ${row.execution_pct}%`);
            if (row.accounts_count != null) lines.push(` Cuentas: ${row.accounts_count}`);
            return lines;
          },
        },
      },
    },
  };

  activeTab = 0;

  // Tab 4 - Campaign Types & Bidding Strategies
  loadingCampaignTypes = false;
  campaignTypesData: any[] = [];
  campaignTypesChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  loadingBiddingStrategies = false;
  biddingStrategiesData: any[] = [];

  // Tab 5 - Keywords
  loadingKeywords = false;
  keywordsData: any[] = [];
  keywordMetric = 'clicks';
  keywordMatchFilter = '';
  keywordGroupBy = 'flat'; // flat | account | campaign
  keywordsGrouped: { label: string; rows: any[] }[] = [];

  // Tab 6 - Devices
  loadingDevices = false;
  devicesData: any[] = [];
  devicesChartData: ChartConfiguration<'doughnut'>['data'] | null = null;

  // Tab 7 - Hourly Heatmap
  loadingHeatmap = false;
  heatmapData: { hour_of_day: number; day_of_week: number; value: number }[] = [];
  heatmapGrid: number[][] = [];
  heatmapMax = 0;
  heatmapMetric = 'clicks';

  // Tab 8 - Budget Intelligence
  loadingPacing = false;
  pacingData: any[] = [];
  loadingWaste = false;
  wasteData: any[] = [];
  loadingOptimalSchedule = false;
  optimalScheduleData: any[] = [];
  optimalScheduleGrid: number[][] = [];
  optimalScheduleMax = 0;
  loadingForecast = false;
  forecastData: any = null;
  forecastChartData: ChartConfiguration<'line'>['data'] | null = null;
  loadingRedistribution = false;
  redistributionData: any[] = [];

  // Tab 9 - Comparaciones & Tendencias
  comparisonMode = 'week'; // week | month | custom
  comparisonData: any = null;
  loadingComparison = false;
  cpaData: any[] = [];
  loadingCPA = false;
  qsTrendData: any[] = [];
  qsTrendChartData: ChartConfiguration<'line'>['data'] | null = null;
  loadingQSTrend = false;
  cpcTrendData: any = null;
  cpcTrendChartData: ChartConfiguration<'line'>['data'] | null = null;
  loadingCPCTrend = false;
  seasonalityData: any = null;
  seasonalityChartData: ChartConfiguration<'bar'>['data'] | null = null;
  loadingSeasonality = false;

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16 } },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Tab 10 - Search Terms & Keyword Strategy
  searchTermsData: any[] = [];
  loadingSearchTerms = false;
  negativeKeywordsData: any[] = [];
  loadingNegativeKeywords = false;
  longTailData: any[] = [];
  longTailChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  loadingLongTail = false;
  cannibalizationData: any[] = [];
  loadingCannibalization = false;

  // Tab 11 - Ad Performance & Fatigue Detection
  adComparisonData: any[] = [];
  loadingAdComparison = false;
  adFatigueData: any[] = [];
  loadingAdFatigue = false;
  adTypeData: any[] = [];
  adTypeChartData: ChartConfiguration<'doughnut'>['data'] | null = null;
  // Landing page analysis
  landingPageData: any[] = [];
  loadingLandingPages = false;
  loadingAdType = false;

  // Tab 12 - Competencia (Auction Insights)
  auctionInsightsData: any[] = [];
  loadingAuctionInsights = false;
  competitiveData: any[] = [];
  competitiveChartData: ChartConfiguration<'line'>['data'] | null = null;
  loadingCompetitive = false;
  marketOppData: any[] = [];
  loadingMarketOpp = false;

  // Tab 13 - Audiencia (Demographics)
  ageData: any[] = [];
  loadingAge = false;
  ageChartData: ChartConfiguration<'bar'>['data'] | null = null;
  genderData: any[] = [];
  loadingGender = false;
  genderChartData: ChartConfiguration<'doughnut'>['data'] | null = null;

  // Phase 10: Dashboard Ejecutivo
  loadingHealthScores = false;
  healthScoresData: any[] = [];
  loadingExecSummary = false;
  execSummaryData: any = null;
  loadingRecommendations = false;
  recommendationsData: any[] = [];
  // Conversion Funnel
  conversionFunnelData: any[] = [];
  loadingConversionFunnel = false;
  // Month-over-Month Comparison
  monthComparisonData: any = null;
  loadingMonthComparison = false;

  // Phase 11: Auditoria Financiera
  loadingZombieKeywords = false;
  zombieKeywordsData: any[] = [];
  loadingVampireCampaigns = false;
  vampireCampaignsData: any[] = [];
  loadingActionPlan = false;
  actionPlanData: any[] = [];

  // Phase 12: Benchmark Cross-Account
  loadingBenchmark = false;
  benchmarkData: any[] = [];
  loadingPortfolio = false;
  portfolioData: any[] = [];
  loadingPatterns = false;
  patternsData: any[] = [];

  // Tab 17 - Recursos (Assets)
  assetSummaryData: any[] = [];
  loadingAssetSummary = false;
  headlineData: any[] = [];
  loadingHeadlines = false;
  descriptionData: any[] = [];
  loadingDescriptions = false;
  sitelinkData: any[] = [];
  loadingSitelinks = false;

  // Geography
  geoData: any[] = [];
  loadingGeo = false;
  countryEfficiencyData: any[] = [];
  loadingCountryEfficiency = false;

  // Phase 9: Enhanced Tabs
  // Devices enhancements
  loadingDeviceBidRecs = false;
  deviceBidRecsData: any[] = [];
  loadingDeviceExclusions = false;
  deviceExclusionsData: any[] = [];

  // Keywords enhancements
  loadingKeywordActionPlan = false;
  keywordActionPlanData: any[] = [];
  loadingMatchTypeRecs = false;
  matchTypeRecsData: any[] = [];
  loadingCrossAccountKws = false;
  crossAccountKwsData: any[] = [];

  // Predictions enhancements
  loadingFullForecast = false;
  fullForecastData: any = null;
  loadingScalingHealth = false;
  scalingHealthData: any[] = [];
  loadingCompMarketTrend = false;
  compMarketTrendData: any[] = [];
  compMarketTrendChartData: ChartConfiguration<'line'>['data'] | null = null;

  /* doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 12 } },
    },
  }; */

  constructor(
    private analysisService: GoogleAdsAnalysisService,
    private countryService: CountryService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Set role flags
    const role = this.authService.userRole();
    this.isPautador = role === 'pautador';
    this.isAdmin = role === 'admin';
    if (!this.isPautador) this.showOnlyMine = false;

    // If pautador, fetch their assigned accounts
    if (this.isPautador) {
      this.http.get<any>(API_URLS.googleAds.myAccounts).subscribe({
        next: (res) => {
          this.myAccountIds = res.data || [];
          this.cdr.detectChanges();
        },
        error: () => {},
      });
    }

    this.countryService.getAll().subscribe(res => {
      this.countries = res.data;
      this.cdr.detectChanges();
    });

    // Fetch actual data range from DB to set smart defaults
    this.analysisService.getDataRange().subscribe({
      next: (res) => {
        const data = res.data;
        if (data?.min_date && data?.max_date) {
          this.filterDateFrom = data.min_date;
          this.filterDateTo = data.max_date;

          // Auto-select best granularity based on date range
          const fromDate = new Date(data.min_date);
          const toDate = new Date(data.max_date);
          const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000);
          if (diffDays > 90) {
            this.granularity = 'monthly';
          } else if (diffDays > 21) {
            this.granularity = 'weekly';
          } else {
            this.granularity = 'daily';
          }
        } else {
          // Fallback: last 30 days
          const today = new Date();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          this.filterDateFrom = this.formatDate(thirtyDaysAgo);
          this.filterDateTo = this.formatDate(today);
        }
        this.loadSpendingTrend();
        this.cdr.detectChanges();
      },
      error: () => {
        // Fallback: last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        this.filterDateFrom = this.formatDate(thirtyDaysAgo);
        this.filterDateTo = this.formatDate(today);
        this.loadSpendingTrend();
      },
    });
  }

  triggerSync(): void {
    if (this.syncing) return;
    this.syncing = true;
    this.cdr.detectChanges();
    this.http.post<any>(API_URLS.googleAds.sync, {}).subscribe({
      next: () => {
        this.syncing = false;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: () => {
        this.syncing = false;
        this.cdr.detectChanges();
      },
    });
  }

  // Helper: should filter by pautador's accounts
  get myAccountsFilter(): boolean {
    return this.isPautador && this.showOnlyMine && this.myAccountIds.length > 0;
  }

  applyFilters(): void {
    // Invalidate cached data for all tabs so they reload with new filters
    this.spendingTrendData = [];
    this.lineChartData = null;
    this.performanceData = [];
    this.performanceBarData = null;
    this.rankingsData = [];
    this.rankingsBarData = null;
    this.budgetData = [];
    this.doughnutChartData = null;
    this.campaignTypesData = [];
    this.campaignTypesChartData = null;
    this.biddingStrategiesData = [];
    this.keywordsData = [];
    this.devicesData = [];
    this.devicesChartData = null;
    this.heatmapData = [];
    this.heatmapGrid = [];
    this.pacingData = [];
    this.wasteData = [];
    this.optimalScheduleData = [];
    this.optimalScheduleGrid = [];
    this.forecastData = null;
    this.forecastChartData = null;
    this.redistributionData = [];
    this.comparisonData = null;
    this.cpaData = [];
    this.qsTrendData = [];
    this.qsTrendChartData = null;
    this.cpcTrendData = null;
    this.cpcTrendChartData = null;
    this.seasonalityData = null;
    this.seasonalityChartData = null;
    this.searchTermsData = [];
    this.negativeKeywordsData = [];
    this.longTailData = [];
    this.longTailChartData = null;
    this.cannibalizationData = [];
    this.adComparisonData = [];
    this.adFatigueData = [];
    this.adTypeData = [];
    this.adTypeChartData = null;
    this.auctionInsightsData = [];
    this.competitiveData = [];
    this.competitiveChartData = null;
    this.marketOppData = [];
    this.ageData = [];
    this.ageChartData = null;
    this.genderData = [];
    this.genderChartData = null;
    // Phase 9 resets
    this.deviceBidRecsData = [];
    this.deviceExclusionsData = [];
    this.keywordActionPlanData = [];
    this.matchTypeRecsData = [];
    this.crossAccountKwsData = [];
    this.fullForecastData = null;
    this.scalingHealthData = [];
    this.compMarketTrendData = [];
    this.compMarketTrendChartData = null;
    // Phase 10 resets
    this.healthScoresData = [];
    this.execSummaryData = null;
    this.recommendationsData = [];
    // Phase 11 resets
    this.zombieKeywordsData = [];
    this.vampireCampaignsData = [];
    this.actionPlanData = [];
    // Phase 12 resets
    this.benchmarkData = [];
    this.portfolioData = [];
    this.patternsData = [];

    // Reload current tab
    switch (this.activeTab) {
      case 0: this.loadSpendingTrend(); break;
      case 1: this.loadPerformance(); break;
      case 2: this.loadRankings(); break;
      case 3: this.loadBudgetDistribution(); break;
      case 4: this.loadCampaignTypesAndStrategies(); break;
      case 5: this.loadKeywords(); break;
      case 6: this.loadDevices(); break;
      case 7: this.loadHeatmap(); break;
      case 8: this.loadBudgetIntelligence(); break;
      case 9: this.loadComparisons(); break;
      case 10: this.loadSearchTermStrategy(); break;
      case 11: this.loadAdPerformance(); break;
      case 12: this.loadCompetitiveIntelligence(); break;
      case 13: this.loadDemographics(); break;
      case 14: this.loadExecutiveDashboard(); break;
      case 15: this.loadFinancialAudit(); break;
      case 16: this.loadBenchmark(); break;
      case 17: this.loadAssets(); break;
      case 18: this.loadGeo(); break;
    }
  }

  clearFilters(): void {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    this.filterDateFrom = this.formatDate(thirtyDaysAgo);
    this.filterDateTo = this.formatDate(today);
    this.filterCountryId = null;

    // Invalidate cached data for all tabs
    this.spendingTrendData = [];
    this.lineChartData = null;
    this.performanceData = [];
    this.performanceBarData = null;
    this.rankingsData = [];
    this.rankingsBarData = null;
    this.budgetData = [];
    this.doughnutChartData = null;
    this.campaignTypesData = [];
    this.campaignTypesChartData = null;
    this.biddingStrategiesData = [];
    this.keywordsData = [];
    this.devicesData = [];
    this.devicesChartData = null;
    this.heatmapData = [];
    this.heatmapGrid = [];
    this.pacingData = [];
    this.wasteData = [];
    this.optimalScheduleData = [];
    this.optimalScheduleGrid = [];
    this.forecastData = null;
    this.forecastChartData = null;
    this.redistributionData = [];
    this.comparisonData = null;
    this.cpaData = [];
    this.qsTrendData = [];
    this.qsTrendChartData = null;
    this.cpcTrendData = null;
    this.cpcTrendChartData = null;
    this.seasonalityData = null;
    this.seasonalityChartData = null;
    this.searchTermsData = [];
    this.negativeKeywordsData = [];
    this.longTailData = [];
    this.longTailChartData = null;
    this.cannibalizationData = [];
    this.adComparisonData = [];
    this.adFatigueData = [];
    this.adTypeData = [];
    this.adTypeChartData = null;
    this.auctionInsightsData = [];
    this.competitiveData = [];
    this.competitiveChartData = null;
    this.marketOppData = [];
    this.ageData = [];
    this.ageChartData = null;
    this.genderData = [];
    this.genderChartData = null;
    // Phase 9 resets
    this.deviceBidRecsData = [];
    this.deviceExclusionsData = [];
    this.keywordActionPlanData = [];
    this.matchTypeRecsData = [];
    this.crossAccountKwsData = [];
    this.fullForecastData = null;
    this.scalingHealthData = [];
    this.compMarketTrendData = [];
    this.compMarketTrendChartData = null;
    // Phase 10 resets
    this.healthScoresData = [];
    this.execSummaryData = null;
    this.recommendationsData = [];
    // Phase 11 resets
    this.zombieKeywordsData = [];
    this.vampireCampaignsData = [];
    this.actionPlanData = [];
    // Phase 12 resets
    this.benchmarkData = [];
    this.portfolioData = [];
    this.patternsData = [];

    // Reload current tab
    switch (this.activeTab) {
      case 0: this.loadSpendingTrend(); break;
      case 1: this.loadPerformance(); break;
      case 2: this.loadRankings(); break;
      case 3: this.loadBudgetDistribution(); break;
      case 4: this.loadCampaignTypesAndStrategies(); break;
      case 5: this.loadKeywords(); break;
      case 6: this.loadDevices(); break;
      case 7: this.loadHeatmap(); break;
      case 8: this.loadBudgetIntelligence(); break;
      case 9: this.loadComparisons(); break;
      case 10: this.loadSearchTermStrategy(); break;
      case 11: this.loadAdPerformance(); break;
      case 12: this.loadCompetitiveIntelligence(); break;
      case 13: this.loadDemographics(); break;
      case 14: this.loadExecutiveDashboard(); break;
      case 15: this.loadFinancialAudit(); break;
      case 16: this.loadBenchmark(); break;
      case 17: this.loadAssets(); break;
      case 18: this.loadGeo(); break;
    }
  }

  onTabChange(index: number): void {
    this.activeTab = index;
    switch (index) {
      case 0:
        if (this.spendingTrendData.length === 0) this.loadSpendingTrend();
        break;
      case 1:
        if (this.performanceData.length === 0) this.loadPerformance();
        break;
      case 2:
        if (this.rankingsData.length === 0) this.loadRankings();
        break;
      case 3:
        if (this.budgetData.length === 0) this.loadBudgetDistribution();
        break;
      case 4:
        if (this.campaignTypesData.length === 0) this.loadCampaignTypesAndStrategies();
        break;
      case 5:
        if (this.keywordsData.length === 0) this.loadKeywords();
        break;
      case 6:
        if (this.devicesData.length === 0) this.loadDevices();
        break;
      case 7:
        if (this.heatmapData.length === 0) this.loadHeatmap();
        break;
      case 8:
        if (this.pacingData.length === 0) this.loadBudgetIntelligence();
        break;
      case 9:
        if (!this.comparisonData && this.cpaData.length === 0) this.loadComparisons();
        break;
      case 10:
        if (this.searchTermsData.length === 0) this.loadSearchTermStrategy();
        break;
      case 11:
        if (this.adComparisonData.length === 0) this.loadAdPerformance();
        break;
      case 12:
        if (this.auctionInsightsData.length === 0) this.loadCompetitiveIntelligence();
        break;
      case 13:
        if (this.ageData.length === 0 && this.genderData.length === 0) this.loadDemographics();
        break;
      case 14:
        if (this.healthScoresData.length === 0) this.loadExecutiveDashboard();
        break;
      case 15:
        if (this.zombieKeywordsData.length === 0) this.loadFinancialAudit();
        break;
      case 16:
        if (this.benchmarkData.length === 0) this.loadBenchmark();
        break;
      case 17:
        if (this.assetSummaryData.length === 0) this.loadAssets();
        break;
      case 18:
        if (this.geoData.length === 0) this.loadGeo();
        break;
    }
  }

  // ---- Tab 1: Spending Trend ----

  loadSpendingTrend(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingTrend = true;
    this.cdr.detectChanges();

    this.analysisService.getSpendingTrend({
      granularity: this.granularity,
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.spendingTrendData = res.data || [];
        this.buildSpendingChart();
        this.loadingTrend = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingTrend = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildSpendingChart(): void {
    const data = this.spendingTrendData;
    if (!data.length) { this.lineChartData = null; return; }

    const pointRadius = data.length <= 10 ? 5 : 3;
    const pointHoverRadius = data.length <= 10 ? 7 : 5;

    const chartData: ChartConfiguration<'line'>['data'] = {
      labels: data.map(d => this.formatPeriod(d.period)),
      datasets: [
        {
          label: 'Costo',
          data: data.map(d => Number(d.total_cost)),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(21, 101, 192, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius,
          pointHoverRadius,
          pointBackgroundColor: '#3B82F6',
          borderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: 'Presupuesto',
          data: data.map(d => Number(d.total_budget)),
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius,
          pointHoverRadius,
          pointBackgroundColor: '#10B981',
          borderWidth: 2,
          borderDash: [5, 5],
          yAxisID: 'y1',
        },
      ],
    };

    // Defer to let Angular render the canvas before Chart.js initializes
    setTimeout(() => {
      this.lineChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 2: Performance ----

  loadPerformance(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingPerformance = true;
    this.cdr.detectChanges();

    this.analysisService.getPerformance({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.performanceData = res.data || [];
        this.buildPerformanceChart();
        this.loadingPerformance = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingPerformance = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildPerformanceChart(): void {
    const sorted = [...this.performanceData]
      .sort((a, b) => Number(b.cpc) - Number(a.cpc))
      .slice(0, 10);
    if (!sorted.length) { this.performanceBarData = null; return; }

    const chartData: ChartConfiguration<'bar'>['data'] = {
      labels: sorted.map(d => d.customer_account_name || d.customer_account_id),
      datasets: [{
        label: 'CPC',
        data: sorted.map(d => Number(d.cpc)),
        backgroundColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'DD'),
        borderColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };

    setTimeout(() => {
      this.performanceBarData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 3: Rankings ----

  loadRankings(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingRankings = true;
    this.cdr.detectChanges();

    this.analysisService.getRankings({
      metric: this.rankingMetric,
      sort: this.rankingSort,
      limit: 10,
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
    }).subscribe({
      next: (res) => {
        this.rankingsData = res.data || [];
        this.buildRankingsChart();
        this.loadingRankings = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingRankings = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildRankingsChart(): void {
    if (!this.rankingsData.length) { this.rankingsBarData = null; return; }

    const chartData: ChartConfiguration<'bar'>['data'] = {
      labels: this.rankingsData.map(d => d.customer_account_name || d.customer_account_id),
      datasets: [{
        label: this.getMetricLabel(),
        data: this.rankingsData.map(d => Number(d.metric_value)),
        backgroundColor: this.rankingsData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'DD'),
        borderColor: this.rankingsData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };

    setTimeout(() => {
      this.rankingsBarData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 4: Budget Distribution ----

  loadBudgetDistribution(): void {
    this.loadingBudget = true;
    this.cdr.detectChanges();

    this.analysisService.getBudgetDistribution(
      this.filterCountryId || undefined,
    ).subscribe({
      next: (res) => {
        this.budgetData = res.data || [];
        this.buildBudgetChart();
        this.loadingBudget = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingBudget = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildBudgetChart(): void {
    if (!this.budgetData.length) { this.doughnutChartData = null; return; }

    const chartData: ChartConfiguration<'doughnut'>['data'] = {
      labels: this.budgetData.map(d => d.country_name || 'Sin pais'),
      datasets: [{
        data: this.budgetData.map(d => Number(d.assigned_budget)),
        backgroundColor: this.budgetData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };

    setTimeout(() => {
      this.doughnutChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  // ---- Tab 4: Campaign Types & Bidding Strategies ----

  loadCampaignTypesAndStrategies(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCampaignTypes = true;
    this.loadingBiddingStrategies = true;
    this.cdr.detectChanges();

    const commonParams = {
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    };

    this.analysisService.getCampaignTypes(commonParams).subscribe({
      next: (res) => {
        this.campaignTypesData = res.data || [];
        this.buildCampaignTypesChart();
        this.loadingCampaignTypes = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingCampaignTypes = false;
        this.cdr.detectChanges();
      },
    });

    this.analysisService.getBiddingStrategies(commonParams).subscribe({
      next: (res) => {
        this.biddingStrategiesData = res.data || [];
        this.loadingBiddingStrategies = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingBiddingStrategies = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildCampaignTypesChart(): void {
    if (!this.campaignTypesData.length) { this.campaignTypesChartData = null; return; }

    const chartData: ChartConfiguration<'doughnut'>['data'] = {
      labels: this.campaignTypesData.map(d => this.formatChannelType(d.channel_type)),
      datasets: [{
        data: this.campaignTypesData.map(d => Number(d.total_cost)),
        backgroundColor: this.campaignTypesData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };

    setTimeout(() => {
      this.campaignTypesChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  formatChannelType(type: string): string {
    const map: Record<string, string> = {
      SEARCH: 'Busqueda',
      DISPLAY: 'Display',
      VIDEO: 'Video',
      SHOPPING: 'Shopping',
      PERFORMANCE_MAX: 'Performance Max',
      DISCOVERY: 'Discovery',
      SMART: 'Smart',
      UNKNOWN: 'Desconocido',
    };
    return map[type] || type || 'Desconocido';
  }

  formatBiddingStrategy(type: string): string {
    const map: Record<string, string> = {
      TARGET_CPA: 'CPA Objetivo',
      TARGET_ROAS: 'ROAS Objetivo',
      MAXIMIZE_CONVERSIONS: 'Max Conversiones',
      MAXIMIZE_CONVERSION_VALUE: 'Max Valor Conv.',
      ENHANCED_CPC: 'CPC Mejorado',
      MANUAL_CPC: 'CPC Manual',
      MANUAL_CPM: 'CPM Manual',
      TARGET_IMPRESSION_SHARE: 'IS Objetivo',
      MAXIMIZE_CLICKS: 'Max Clicks',
      UNKNOWN: 'Desconocido',
    };
    return map[type] || type || 'Desconocido';
  }

  // ---- Tab 5: Keywords ----

  loadKeywords(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingKeywords = true;
    this.cdr.detectChanges();

    this.analysisService.getKeywords({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      metric: this.keywordMetric,
      match_type: this.keywordMatchFilter || undefined,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
      group_by: this.keywordGroupBy !== 'flat' ? this.keywordGroupBy : undefined,
    }).subscribe({
      next: (res) => {
        this.keywordsData = res.data || [];
        this.buildKeywordGroups();
        this.loadingKeywords = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingKeywords = false;
        this.cdr.detectChanges();
      },
    });
  }

  onKeywordGroupByChange(mode: string): void {
    this.keywordGroupBy = mode;
    this.loadKeywords();
  }

  private buildKeywordGroups(): void {
    if (this.keywordGroupBy === 'flat' || !this.keywordsData.length) {
      this.keywordsGrouped = [];
      return;
    }
    const groupKey = this.keywordGroupBy === 'account' ? 'customer_account_name' : 'campaign_name';
    const map = new Map<string, any[]>();
    for (const row of this.keywordsData) {
      const key = row[groupKey] || 'Sin asignar';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    this.keywordsGrouped = Array.from(map.entries()).map(([label, rows]) => ({ label, rows }));
  }

  getQualityScoreClass(score: number | null): string {
    if (score == null) return '';
    if (score >= 7) return 'badge-green';
    if (score >= 4) return 'badge-yellow';
    return 'badge-red';
  }

  // ---- Tab 6: Devices ----

  loadDevices(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingDevices = true;
    this.cdr.detectChanges();

    this.analysisService.getDevices({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.devicesData = res.data || [];
        this.buildDevicesChart();
        this.loadingDevices = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDevices = false;
        this.cdr.detectChanges();
      },
    });
    this.loadDeviceBidRecommendations();
    this.loadDeviceExclusions();
  }

  private buildDevicesChart(): void {
    if (!this.devicesData.length) { this.devicesChartData = null; return; }

    const chartData: ChartConfiguration<'doughnut'>['data'] = {
      labels: this.devicesData.map(d => this.formatDevice(d.device)),
      datasets: [{
        data: this.devicesData.map(d => Number(d.total_cost)),
        backgroundColor: this.devicesData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };

    setTimeout(() => {
      this.devicesChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  formatDevice(device: string): string {
    const map: Record<string, string> = {
      MOBILE: 'Movil',
      DESKTOP: 'Escritorio',
      TABLET: 'Tablet',
      CONNECTED_TV: 'TV Conectada',
      UNKNOWN: 'Desconocido',
    };
    return map[device] || device;
  }

  // ---- Tab 7: Hourly Heatmap ----

  loadHeatmap(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingHeatmap = true;
    this.cdr.detectChanges();

    this.analysisService.getHourlyHeatmap({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      metric: this.heatmapMetric,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.heatmapData = res.data || [];
        this.buildHeatmapGrid();
        this.loadingHeatmap = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingHeatmap = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildHeatmapGrid(): void {
    // 7 days x 24 hours (ISODOW: 1=Mon..7=Sun -> index 0..6)
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const row of this.heatmapData) {
      const isodow = Number(row.day_of_week); // 1=Mon, 7=Sun
      const day = isodow - 1; // 0=Mon, 6=Sun
      const hour = Number(row.hour_of_day);
      const val = Number(row.value) || 0;
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        grid[day][hour] += val;
        if (grid[day][hour] > max) max = grid[day][hour];
      }
    }
    this.heatmapGrid = grid;
    this.heatmapMax = max;
  }

  getHeatmapColor(value: number): string {
    if (this.heatmapMax === 0 || value === 0) return 'rgba(0,0,0,0.03)';
    const intensity = value / this.heatmapMax;
    const r = Math.round(59 + (239 - 59) * intensity);
    const g = Math.round(130 + (68 - 130) * intensity);
    const b = Math.round(246 + (68 - 246) * intensity);
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.85})`;
  }

  getDayName(index: number): string {
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    return days[index] || '';
  }

  formatHeatmapCell(val: number): string {
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return Math.round(val).toString();
  }

  formatHeatmapValue(value: number): string {
    if (this.heatmapMetric === 'cost' || this.heatmapMetric === 'cpc') {
      return this.formatCurrency(value);
    }
    return Math.round(value).toLocaleString('es-CO');
  }

  // ---- Tab 11: Budget Intelligence ----

  loadBudgetIntelligence(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadPacing();
    this.loadWaste();
    this.loadOptimalSchedule();
    this.loadForecast();
    this.loadRedistribution();
    this.loadFullForecast();
    this.loadScalingHealth();
    this.loadCompetitiveMarketTrend();
  }

  private loadPacing(): void {
    this.loadingPacing = true;
    this.cdr.detectChanges();
    this.analysisService.getBudgetPacing({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.pacingData = res.data || [];
        this.loadingPacing = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPacing = false; this.cdr.detectChanges(); },
    });
  }

  private loadWaste(): void {
    this.loadingWaste = true;
    this.cdr.detectChanges();
    this.analysisService.getWasteDetection({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.wasteData = res.data || [];
        this.loadingWaste = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingWaste = false; this.cdr.detectChanges(); },
    });
  }

  private loadOptimalSchedule(): void {
    this.loadingOptimalSchedule = true;
    this.cdr.detectChanges();
    this.analysisService.getOptimalSchedule({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.optimalScheduleData = res.data || [];
        this.buildOptimalScheduleGrid();
        this.loadingOptimalSchedule = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingOptimalSchedule = false; this.cdr.detectChanges(); },
    });
  }

  private buildOptimalScheduleGrid(): void {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const row of this.optimalScheduleData) {
      const isodow = Number(row.day_of_week); // 1=Mon, 7=Sun
      const day = isodow - 1; // 0=Mon, 6=Sun
      const hour = Number(row.hour_of_day);
      const val = row.cpa != null ? Number(row.cpa) : 0;
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        grid[day][hour] = val;
        if (val > max) max = val;
      }
    }
    this.optimalScheduleGrid = grid;
    this.optimalScheduleMax = max;
  }

  getScheduleColor(value: number): string {
    if (this.optimalScheduleMax === 0 || value === 0) return 'rgba(0,0,0,0.03)';
    const intensity = value / this.optimalScheduleMax;
    // Green (low CPA = good) to Red (high CPA = bad)
    const r = Math.round(16 + (239 - 16) * intensity);
    const g = Math.round(185 + (68 - 185) * intensity);
    const b = Math.round(129 + (68 - 129) * intensity);
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.85})`;
  }

  private loadForecast(): void {
    this.loadingForecast = true;
    this.cdr.detectChanges();
    this.analysisService.getBudgetForecast({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.forecastData = res.data || null;
        this.buildForecastChart();
        this.loadingForecast = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingForecast = false; this.cdr.detectChanges(); },
    });
  }

  private buildForecastChart(): void {
    if (!this.forecastData?.trend?.length) { this.forecastChartData = null; return; }
    const trend = this.forecastData.trend;
    const forecast = this.forecastData.forecast;

    const labels = trend.map((d: any) => {
      const dt = new Date(d.date);
      return dt.getDate() + '/' + (dt.getMonth() + 1);
    });
    const costData = trend.map((d: any) => Number(d.daily_cost));
    const budgetData = trend.map((d: any) => Number(d.daily_budget));

    // Add forecast points if available
    if (forecast) {
      const lastDate = new Date(trend[trend.length - 1].date);
      for (let i = 1; i <= 7; i++) {
        const projDate = new Date(lastDate);
        projDate.setDate(projDate.getDate() + i);
        labels.push(projDate.getDate() + '/' + (projDate.getMonth() + 1));
        const projValue = Math.max(0, forecast.avg_daily_cost + forecast.slope * i);
        costData.push(null); // Real data ends
        budgetData.push(null);
      }
    }

    // Forecast line (projected from last real point)
    const forecastLine: (number | null)[] = new Array(trend.length).fill(null);
    if (forecast) {
      forecastLine[trend.length - 1] = Number(trend[trend.length - 1].daily_cost);
      for (let i = 1; i <= 7; i++) {
        forecastLine.push(Math.max(0, forecast.avg_daily_cost + forecast.slope * i));
      }
    }

    const chartData: ChartConfiguration<'line'>['data'] = {
      labels,
      datasets: [
        {
          label: 'Costo Real',
          data: costData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: trend.length <= 14 ? 4 : 2,
          borderWidth: 2,
          spanGaps: false,
        },
        {
          label: 'Presupuesto',
          data: budgetData,
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [5, 5],
          spanGaps: false,
        },
        {
          label: 'Proyeccion',
          data: forecastLine,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          borderWidth: 2,
          borderDash: [8, 4],
          spanGaps: true,
        },
      ],
    };

    setTimeout(() => {
      this.forecastChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  private loadRedistribution(): void {
    this.loadingRedistribution = true;
    this.cdr.detectChanges();
    this.analysisService.getBudgetRedistribution({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.redistributionData = res.data || [];
        this.loadingRedistribution = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingRedistribution = false; this.cdr.detectChanges(); },
    });
  }

  getTierClass(tier: string): string {
    switch (tier) {
      case 'high_performer': return 'badge-green';
      case 'low_performer': return 'badge-red';
      default: return 'badge-yellow';
    }
  }

  formatTier(tier: string): string {
    switch (tier) {
      case 'high_performer': return 'Alto';
      case 'low_performer': return 'Bajo';
      default: return 'Medio';
    }
  }

  getPacingClass(pct: number): string {
    if (pct >= 90 && pct <= 110) return 'text-success';
    if (pct > 110) return 'text-danger';
    return 'text-warning';
  }

  formatScheduleCell(val: number): string {
    if (val === 0) return '';
    return '$' + Math.round(val).toLocaleString('es-CO');
  }

  // ---- Tab 12: Comparaciones & Tendencias ----

  loadComparisons(): void {
    this.loadTemporalComparison();
    this.loadCPA();
    this.loadQSTrend();
    this.loadCPCTrend();
    this.loadSeasonality();
  }

  getComparisonDates(): { from1: string; to1: string; from2: string; to2: string } {
    const to2 = new Date(this.filterDateTo);
    const from2 = new Date(this.filterDateFrom);
    const diffMs = to2.getTime() - from2.getTime();

    const to1 = new Date(from2.getTime() - 86400000); // day before from2
    const from1 = new Date(to1.getTime() - diffMs);

    return {
      from1: this.formatDate(from1),
      to1: this.formatDate(to1),
      from2: this.filterDateFrom,
      to2: this.filterDateTo,
    };
  }

  loadTemporalComparison(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    const dates = this.getComparisonDates();
    this.loadingComparison = true;
    this.analysisService.getTemporalComparison({
      date_from_1: dates.from1,
      date_to_1: dates.to1,
      date_from_2: dates.from2,
      date_to_2: dates.to2,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.comparisonData = res.data;
        this.loadingComparison = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingComparison = false; this.cdr.detectChanges(); },
    });
  }

  loadCPA(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCPA = true;
    this.analysisService.getCPAAnalysis({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.cpaData = res.data || [];
        this.loadingCPA = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCPA = false; this.cdr.detectChanges(); },
    });
  }

  loadQSTrend(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingQSTrend = true;
    this.analysisService.getQualityScoreTrend({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.qsTrendData = res.data || [];
        this.buildQSTrendChart();
        this.loadingQSTrend = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingQSTrend = false; this.cdr.detectChanges(); },
    });
  }

  buildQSTrendChart(): void {
    if (!this.qsTrendData.length) { this.qsTrendChartData = null; return; }
    this.qsTrendChartData = {
      labels: this.qsTrendData.map((r: any) => r.snapshot_date),
      datasets: [{
        label: 'Quality Score Promedio',
        data: this.qsTrendData.map((r: any) => parseFloat(r.avg_quality_score)),
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      }],
    };
  }

  loadCPCTrend(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCPCTrend = true;
    this.analysisService.getCPCTrend({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.cpcTrendData = res.data || null;
        this.buildCPCTrendChart();
        this.loadingCPCTrend = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCPCTrend = false; this.cdr.detectChanges(); },
    });
  }

  buildCPCTrendChart(): void {
    if (!this.cpcTrendData?.trend?.length) { this.cpcTrendChartData = null; return; }
    const trend = this.cpcTrendData.trend;
    this.cpcTrendChartData = {
      labels: trend.map((r: any) => r.snapshot_date),
      datasets: [{
        label: 'CPC',
        data: trend.map((r: any) => parseFloat(r.cpc)),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      }],
    };
  }

  loadSeasonality(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingSeasonality = true;
    this.analysisService.getSeasonality({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.seasonalityData = res.data || null;
        this.buildSeasonalityChart();
        this.loadingSeasonality = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingSeasonality = false; this.cdr.detectChanges(); },
    });
  }

  buildSeasonalityChart(): void {
    if (!this.seasonalityData?.by_day_of_week?.length) { this.seasonalityChartData = null; return; }
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const data = this.seasonalityData.by_day_of_week;
    this.seasonalityChartData = {
      labels: data.map((r: any) => dayNames[r.day_of_week] || '?'),
      datasets: [
        {
          label: 'Costo Promedio',
          data: data.map((r: any) => parseFloat(r.avg_cost)),
          backgroundColor: 'rgba(255, 214, 0, 0.6)',
          borderColor: '#ffd600',
          borderWidth: 1,
        },
        {
          label: 'Conversiones Promedio',
          data: data.map((r: any) => parseFloat(r.avg_conversions)),
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10B981',
          borderWidth: 1,
        },
      ],
    };
  }

  getComparisonArrowClass(pct: number, inverse = false): string {
    if (pct === 0) return '';
    const positive = inverse ? pct < 0 : pct > 0;
    return positive ? 'text-success' : 'text-danger';
  }

  getComparisonArrow(pct: number): string {
    if (pct > 0) return '+';
    return '';
  }

  // ---- Tab 13: Search Terms & Keyword Strategy ----

  loadSearchTermStrategy(): void {
    this.loadSearchTerms();
    this.loadNegativeKeywords();
    this.loadLongTail();
    this.loadCannibalization();
    this.loadKeywordActionPlan();
    this.loadMatchTypeRecommendations();
    this.loadCrossAccountKeywords();
  }

  loadSearchTerms(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingSearchTerms = true;
    this.analysisService.getSearchTerms({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
      limit: 50,
    }).subscribe({
      next: (res) => {
        this.searchTermsData = res.data || [];
        this.loadingSearchTerms = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingSearchTerms = false; this.cdr.detectChanges(); },
    });
  }

  loadNegativeKeywords(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingNegativeKeywords = true;
    this.analysisService.getNegativeKeywordCandidates({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.negativeKeywordsData = res.data || [];
        this.loadingNegativeKeywords = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingNegativeKeywords = false; this.cdr.detectChanges(); },
    });
  }

  loadLongTail(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingLongTail = true;
    this.analysisService.getLongTailAnalysis({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.longTailData = res.data || [];
        this.buildLongTailChart();
        this.loadingLongTail = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingLongTail = false; this.cdr.detectChanges(); },
    });
  }

  buildLongTailChart(): void {
    if (!this.longTailData.length) { this.longTailChartData = null; return; }
    const colors = ['#3B82F6', '#F59E0B', '#10B981'];
    this.longTailChartData = {
      labels: this.longTailData.map((r: any) => r.category),
      datasets: [{
        data: this.longTailData.map((r: any) => parseFloat(r.total_cost)),
        backgroundColor: colors.slice(0, this.longTailData.length),
        borderWidth: 0,
      }],
    };
  }

  loadCannibalization(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCannibalization = true;
    this.analysisService.getKeywordCannibalization({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.cannibalizationData = res.data || [];
        this.loadingCannibalization = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCannibalization = false; this.cdr.detectChanges(); },
    });
  }

  // ---- Tab 14: Ad Performance & Fatigue Detection ----

  loadAdPerformance(): void {
    this.loadAdComparison();
    this.loadAdFatigue();
    this.loadAdType();
    this.loadLandingPages();
  }

  loadAdComparison(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingAdComparison = true;
    this.cdr.detectChanges();
    this.analysisService.getAdPerformanceComparison({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.adComparisonData = res.data || [];
        this.loadingAdComparison = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingAdComparison = false; this.cdr.detectChanges(); },
    });
  }

  loadAdFatigue(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingAdFatigue = true;
    this.cdr.detectChanges();
    this.analysisService.getAdFatigueDetection({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.adFatigueData = res.data || [];
        this.loadingAdFatigue = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingAdFatigue = false; this.cdr.detectChanges(); },
    });
  }

  loadAdType(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingAdType = true;
    this.cdr.detectChanges();
    this.analysisService.getAdTypePerformance({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.adTypeData = res.data || [];
        this.buildAdTypeChart();
        this.loadingAdType = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingAdType = false; this.cdr.detectChanges(); },
    });
  }

  buildAdTypeChart(): void {
    if (!this.adTypeData.length) { this.adTypeChartData = null; return; }
    this.adTypeChartData = {
      labels: this.adTypeData.map((r: any) => this.formatAdType(r.ad_type)),
      datasets: [{
        data: this.adTypeData.map((r: any) => parseFloat(r.total_cost)),
        backgroundColor: this.adTypeData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }

  formatAdType(type: string): string {
    const map: Record<string, string> = {
      RESPONSIVE_SEARCH_AD: 'Busqueda Responsiva',
      EXPANDED_TEXT_AD: 'Texto Expandido',
      RESPONSIVE_DISPLAY_AD: 'Display Responsivo',
      IMAGE_AD: 'Imagen',
      VIDEO_AD: 'Video',
      APP_AD: 'App',
      SHOPPING_PRODUCT_AD: 'Shopping',
      CALL_AD: 'Llamada',
      SMART_CAMPAIGN_AD: 'Smart',
      UNKNOWN: 'Desconocido',
    };
    return map[type] || type || 'Desconocido';
  }

  getFatigueClass(level: string): string {
    switch (level) {
      case 'high_fatigue': return 'badge-red';
      case 'moderate_fatigue': return 'badge-yellow';
      case 'slight_decline': return 'badge-blue';
      default: return 'badge-green';
    }
  }

  formatFatigueLevel(level: string): string {
    switch (level) {
      case 'high_fatigue': return 'Alta Fatiga';
      case 'moderate_fatigue': return 'Fatiga Moderada';
      case 'slight_decline': return 'Declive Leve';
      default: return 'Estable';
    }
  }

  getAdGroupGroups(): { adGroupName: string; ads: any[] }[] {
    const map = new Map<string, any[]>();
    for (const row of this.adComparisonData) {
      const key = row.ad_group_name || row.ad_group_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).map(([adGroupName, ads]) => ({ adGroupName, ads }));
  }

  // ---- Helpers ----

  formatCurrency(value: any): string {
    const num = Number(value) || 0;
    return '$' + Math.round(num).toLocaleString('es-CO');
  }

  formatPeriod(period: string): string {
    if (!period) return '';
    const d = new Date(period);
    if (this.granularity === 'monthly') {
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      return months[d.getMonth()] + ' ' + d.getFullYear();
    }
    if (this.granularity === 'weekly') {
      return 'Sem ' + this.getISOWeek(d) + ' (' + d.getDate() + '/' + (d.getMonth() + 1) + ')';
    }
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  formatMetricValue(value: any): string {
    const num = Number(value) || 0;
    if (this.rankingMetric === 'spend') {
      return this.formatCurrency(num);
    }
    return num.toLocaleString('es-CO');
  }

  getColor(index: number): string {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  clampPct(pct: any): number {
    const num = Number(pct) || 0;
    return Math.min(num, 100);
  }

  private getMetricLabel(): string {
    switch (this.rankingMetric) {
      case 'spend': return 'Gasto';
      case 'conversions': return 'Conversiones';
      case 'clicks': return 'Clicks';
      default: return 'Valor';
    }
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // ---- Tab 15: Competencia (Auction Insights) ----

  loadCompetitiveIntelligence(): void {
    this.loadAuctionInsights();
    this.loadCompetitivePosition();
    this.loadMarketOpportunities();
  }

  loadAuctionInsights(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingAuctionInsights = true;
    this.cdr.detectChanges();

    this.analysisService.getAuctionInsights({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.auctionInsightsData = res.data || [];
        this.loadingAuctionInsights = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingAuctionInsights = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadCompetitivePosition(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCompetitive = true;
    this.cdr.detectChanges();

    this.analysisService.getCompetitivePosition({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.competitiveData = res.data || [];
        this.buildCompetitiveChart();
        this.loadingCompetitive = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingCompetitive = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildCompetitiveChart(): void {
    const data = this.competitiveData;
    if (!data.length) { this.competitiveChartData = null; return; }

    this.competitiveChartData = {
      labels: data.map(d => {
        const dt = new Date(d.snapshot_date);
        return dt.getDate() + '/' + (dt.getMonth() + 1);
      }),
      datasets: [
        {
          label: 'Tu Impression Share',
          data: data.map(d => Number(d.your_impression_share) * 100),
          borderColor: CHART_COLORS[0],
          backgroundColor: CHART_COLORS[0] + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Overlap Competidores',
          data: data.map(d => Number(d.avg_competitor_overlap) * 100),
          borderColor: CHART_COLORS[3],
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Outranking Share',
          data: data.map(d => Number(d.avg_outranking) * 100),
          borderColor: CHART_COLORS[1],
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    };
  }

  loadMarketOpportunities(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingMarketOpp = true;
    this.cdr.detectChanges();

    this.analysisService.getMarketOpportunities({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.marketOppData = res.data || [];
        this.loadingMarketOpp = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingMarketOpp = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadLandingPages(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingLandingPages = true;
    this.cdr.detectChanges();
    this.analysisService.getLandingPages({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.landingPageData = res.data || [];
        this.loadingLandingPages = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingLandingPages = false; this.cdr.detectChanges(); },
    });
  }

  // ---- Tab 16: Audiencia (Demographics) ----

  loadDemographics(): void {
    this.loadAge();
    this.loadGender();
  }

  loadAge(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingAge = true;
    this.cdr.detectChanges();

    this.analysisService.getAgeBreakdown({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.ageData = res.data || [];
        this.buildAgeChart();
        this.loadingAge = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingAge = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildAgeChart(): void {
    const data = this.ageData;
    if (!data.length) { this.ageChartData = null; return; }

    this.ageChartData = {
      labels: data.map(d => d.demographic_value),
      datasets: [
        {
          label: 'Costo',
          data: data.map(d => Number(d.total_cost) || 0),
          backgroundColor: CHART_COLORS[0] + 'CC',
          borderColor: CHART_COLORS[0],
          borderWidth: 1,
        },
        {
          label: 'Clicks',
          data: data.map(d => Number(d.total_clicks) || 0),
          backgroundColor: CHART_COLORS[1] + 'CC',
          borderColor: CHART_COLORS[1],
          borderWidth: 1,
        },
        {
          label: 'Conversiones',
          data: data.map(d => Number(d.total_conversions) || 0),
          backgroundColor: CHART_COLORS[2] + 'CC',
          borderColor: CHART_COLORS[2],
          borderWidth: 1,
        },
      ],
    };
  }

  loadGender(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingGender = true;
    this.cdr.detectChanges();

    this.analysisService.getGenderBreakdown({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.genderData = res.data || [];
        this.buildGenderChart();
        this.loadingGender = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingGender = false;
        this.cdr.detectChanges();
      },
    });
  }

  private buildGenderChart(): void {
    const data = this.genderData;
    if (!data.length) { this.genderChartData = null; return; }

    this.genderChartData = {
      labels: data.map(d => d.demographic_value),
      datasets: [
        {
          data: data.map(d => Number(d.total_cost) || 0),
          backgroundColor: CHART_COLORS.slice(0, data.length),
          borderWidth: 1,
        },
      ],
    };
  }

  // ============ Phase 9: Enhanced Tab Methods ============

  private loadDeviceBidRecommendations(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingDeviceBidRecs = true;
    this.cdr.detectChanges();
    this.analysisService.getDeviceBidRecommendations({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.deviceBidRecsData = res.data || [];
        this.loadingDeviceBidRecs = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingDeviceBidRecs = false; this.cdr.detectChanges(); },
    });
  }

  private loadDeviceExclusions(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingDeviceExclusions = true;
    this.cdr.detectChanges();
    this.analysisService.getDeviceExclusions({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.deviceExclusionsData = res.data || [];
        this.loadingDeviceExclusions = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingDeviceExclusions = false; this.cdr.detectChanges(); },
    });
  }

  private loadKeywordActionPlan(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingKeywordActionPlan = true;
    this.cdr.detectChanges();
    this.analysisService.getKeywordActionPlan({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.keywordActionPlanData = res.data || [];
        this.loadingKeywordActionPlan = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingKeywordActionPlan = false; this.cdr.detectChanges(); },
    });
  }

  private loadMatchTypeRecommendations(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingMatchTypeRecs = true;
    this.cdr.detectChanges();
    this.analysisService.getMatchTypeRecommendations({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.matchTypeRecsData = res.data || [];
        this.loadingMatchTypeRecs = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingMatchTypeRecs = false; this.cdr.detectChanges(); },
    });
  }

  private loadCrossAccountKeywords(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCrossAccountKws = true;
    this.cdr.detectChanges();
    this.analysisService.getCrossAccountKeywords({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.crossAccountKwsData = res.data || [];
        this.loadingCrossAccountKws = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCrossAccountKws = false; this.cdr.detectChanges(); },
    });
  }

  private loadFullForecast(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingFullForecast = true;
    this.cdr.detectChanges();
    this.analysisService.getFullForecast({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.fullForecastData = res.data || null;
        this.loadingFullForecast = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingFullForecast = false; this.cdr.detectChanges(); },
    });
  }

  private loadScalingHealth(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingScalingHealth = true;
    this.cdr.detectChanges();
    this.analysisService.getScalingHealth({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.scalingHealthData = res.data || [];
        this.loadingScalingHealth = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingScalingHealth = false; this.cdr.detectChanges(); },
    });
  }

  private loadCompetitiveMarketTrend(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingCompMarketTrend = true;
    this.cdr.detectChanges();
    this.analysisService.getCompetitiveMarketTrend({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.compMarketTrendData = res.data || [];
        this.buildCompMarketTrendChart();
        this.loadingCompMarketTrend = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCompMarketTrend = false; this.cdr.detectChanges(); },
    });
  }

  private buildCompMarketTrendChart(): void {
    if (!this.compMarketTrendData.length) { this.compMarketTrendChartData = null; return; }
    const labels = this.compMarketTrendData.map((d: any) => d.snapshot_date);
    const chartData: ChartConfiguration<'line'>['data'] = {
      labels,
      datasets: [
        {
          label: 'Impression Share %',
          data: this.compMarketTrendData.map((d: any) => Number(d.avg_impression_share) || 0),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'CPC Promedio',
          data: this.compMarketTrendData.map((d: any) => Number(d.avg_cpc) || 0),
          borderColor: '#EF4444',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    };
    setTimeout(() => {
      this.compMarketTrendChartData = chartData;
      this.cdr.detectChanges();
    });
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'SUBIR': return 'badge-green';
      case 'MANTENER': return 'badge-yellow';
      case 'BAJAR': return 'bg-warning';
      case 'PAUSAR': return 'badge-red';
      default: return 'badge-outline';
    }
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'SUBIR': return 'Subir Puja';
      case 'MANTENER': return 'Mantener';
      case 'BAJAR': return 'Bajar Puja';
      case 'PAUSAR': return 'Pausar';
      default: return action;
    }
  }

  // ============ Phase 10: Dashboard Ejecutivo ============

  loadExecutiveDashboard(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadHealthScores();
    this.loadExecSummary();
    this.loadTopRecommendations();
    this.loadConversionFunnel();
    this.loadMonthComparison();
  }

  private loadHealthScores(): void {
    this.loadingHealthScores = true;
    this.cdr.detectChanges();
    this.analysisService.getAccountHealthScores({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.healthScoresData = res.data || [];
        this.loadingHealthScores = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingHealthScores = false; this.cdr.detectChanges(); },
    });
  }

  private loadExecSummary(): void {
    this.loadingExecSummary = true;
    this.cdr.detectChanges();
    this.analysisService.getExecutiveSummary({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.execSummaryData = res.data || null;
        this.loadingExecSummary = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingExecSummary = false; this.cdr.detectChanges(); },
    });
  }

  private loadTopRecommendations(): void {
    this.loadingRecommendations = true;
    this.cdr.detectChanges();
    this.analysisService.getTopRecommendations({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.recommendationsData = res.data || [];
        this.loadingRecommendations = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingRecommendations = false; this.cdr.detectChanges(); },
    });
  }

  private loadConversionFunnel(): void {
    this.loadingConversionFunnel = true;
    this.cdr.detectChanges();
    this.analysisService.getConversionFunnel({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.conversionFunnelData = res.data || [];
        this.loadingConversionFunnel = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingConversionFunnel = false; this.cdr.detectChanges(); },
    });
  }

  private loadMonthComparison(): void {
    this.loadingMonthComparison = true;
    this.cdr.detectChanges();
    this.analysisService.getMonthComparison({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.monthComparisonData = res.data || null;
        this.loadingMonthComparison = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingMonthComparison = false; this.cdr.detectChanges(); },
    });
  }

  getFunnelWidth(impressions: number, value: number): number {
    if (!impressions || impressions === 0) return 0;
    return Math.max(5, (value / impressions) * 100);
  }

  getHealthBadgeClass(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'badge-green';
      case 'ATTENTION': return 'badge-yellow';
      case 'CRITICAL': return 'badge-red';
      default: return 'badge-outline';
    }
  }

  getHealthLabel(status: string): string {
    switch (status) {
      case 'HEALTHY': return 'Saludable';
      case 'ATTENTION': return 'Atencion';
      case 'CRITICAL': return 'Critica';
      default: return status;
    }
  }

  getRecActionIcon(type: string): string {
    switch (type) {
      case 'PAUSE_CAMPAIGN': return 'pause_circle';
      case 'EXCLUDE_DEVICE': return 'devices';
      case 'ADD_NEGATIVE': return 'block';
      case 'REDUCE_BUDGET': return 'trending_down';
      default: return 'lightbulb';
    }
  }

  // ============ Phase 11: Auditoria Financiera ============

  loadFinancialAudit(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadZombieKeywords();
    this.loadVampireCampaigns();
    this.loadConsolidatedActionPlan();
  }

  private loadZombieKeywords(): void {
    this.loadingZombieKeywords = true;
    this.cdr.detectChanges();
    this.analysisService.getZombieKeywords({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.zombieKeywordsData = res.data || [];
        this.loadingZombieKeywords = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingZombieKeywords = false; this.cdr.detectChanges(); },
    });
  }

  private loadVampireCampaigns(): void {
    this.loadingVampireCampaigns = true;
    this.cdr.detectChanges();
    this.analysisService.getVampireCampaigns({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.vampireCampaignsData = res.data || [];
        this.loadingVampireCampaigns = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingVampireCampaigns = false; this.cdr.detectChanges(); },
    });
  }

  private loadConsolidatedActionPlan(): void {
    this.loadingActionPlan = true;
    this.cdr.detectChanges();
    this.analysisService.getConsolidatedActionPlan({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.actionPlanData = res.data || [];
        this.loadingActionPlan = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingActionPlan = false; this.cdr.detectChanges(); },
    });
  }

  getTotalEstimatedSavings(): number {
    return this.actionPlanData.reduce((sum: number, row: any) => sum + (Number(row.estimated_monthly_savings) || 0), 0);
  }

  // ============ Phase 12: Benchmark Cross-Account ============

  loadBenchmark(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadAccountBenchmark();
    this.loadPortfolioRecommendation();
    this.loadAccountPatterns();
  }

  private loadAccountBenchmark(): void {
    this.loadingBenchmark = true;
    this.cdr.detectChanges();
    this.analysisService.getAccountBenchmark({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.benchmarkData = res.data || [];
        this.loadingBenchmark = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingBenchmark = false; this.cdr.detectChanges(); },
    });
  }

  private loadPortfolioRecommendation(): void {
    this.loadingPortfolio = true;
    this.cdr.detectChanges();
    this.analysisService.getPortfolioRecommendation({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.portfolioData = res.data || [];
        this.loadingPortfolio = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPortfolio = false; this.cdr.detectChanges(); },
    });
  }

  private loadAccountPatterns(): void {
    this.loadingPatterns = true;
    this.cdr.detectChanges();
    this.analysisService.getAccountPatterns({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.patternsData = res.data || [];
        this.loadingPatterns = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPatterns = false; this.cdr.detectChanges(); },
    });
  }

  getBenchmarkTierClass(tier: string): string {
    switch (tier) {
      case 'TOP': return 'badge-green';
      case 'MID': return 'badge-yellow';
      case 'BOTTOM': return 'badge-red';
      default: return 'badge-outline';
    }
  }

  getRecClass(rec: string): string {
    switch (rec) {
      case 'KEEP': return 'badge-green';
      case 'REVIEW': return 'badge-yellow';
      case 'STOP': return 'badge-red';
      default: return 'badge-outline';
    }
  }

  getRecLabel(rec: string): string {
    switch (rec) {
      case 'KEEP': return 'Mantener';
      case 'REVIEW': return 'Revisar';
      case 'STOP': return 'Detener';
      default: return rec;
    }
  }

  // ========== Tab 19: Assets (Recursos) ==========

  loadAssets(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadAssetSummary();
    this.loadHeadlines();
    this.loadDescriptions();
    this.loadSitelinks();
  }

  private loadAssetSummary(): void {
    this.loadingAssetSummary = true;
    this.cdr.detectChanges();
    this.analysisService.getAssetSummary({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.assetSummaryData = res.data || [];
        this.loadingAssetSummary = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingAssetSummary = false; this.cdr.detectChanges(); },
    });
  }

  private loadHeadlines(): void {
    this.loadingHeadlines = true;
    this.cdr.detectChanges();
    this.analysisService.getAssetHeadlines({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.headlineData = res.data || [];
        this.loadingHeadlines = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingHeadlines = false; this.cdr.detectChanges(); },
    });
  }

  private loadDescriptions(): void {
    this.loadingDescriptions = true;
    this.cdr.detectChanges();
    this.analysisService.getAssetDescriptions({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.descriptionData = res.data || [];
        this.loadingDescriptions = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingDescriptions = false; this.cdr.detectChanges(); },
    });
  }

  private loadSitelinks(): void {
    this.loadingSitelinks = true;
    this.cdr.detectChanges();
    this.analysisService.getAssetSitelinks({
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    }).subscribe({
      next: (res) => {
        this.sitelinkData = res.data || [];
        this.loadingSitelinks = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingSitelinks = false; this.cdr.detectChanges(); },
    });
  }

  getAssetTypeLabel(type: string): string {
    switch (type) {
      case 'HEADLINE': return 'Titulos';
      case 'DESCRIPTION': return 'Descripciones';
      case 'SITELINK': return 'Enlaces de Sitio';
      case 'CALLOUT': return 'Textos Destacados';
      case 'STRUCTURED_SNIPPET': return 'Fragmentos';
      default: return type;
    }
  }

  // ---- Tab 18: Geography ----

  loadGeo(): void {
    if (!this.filterDateFrom || !this.filterDateTo) return;
    this.loadingGeo = true;
    this.loadingCountryEfficiency = true;
    this.cdr.detectChanges();
    const params = {
      date_from: this.filterDateFrom,
      date_to: this.filterDateTo,
      country_id: this.filterCountryId || undefined,
      my_accounts: this.myAccountsFilter,
    };

    this.analysisService.getGeoPerformance(params).subscribe({
      next: (res: any) => {
        this.geoData = res.data || [];
        this.loadingGeo = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingGeo = false; this.cdr.detectChanges(); },
    });

    this.analysisService.getCountryEfficiency(params).subscribe({
      next: (res: any) => {
        this.countryEfficiencyData = res.data || [];
        this.loadingCountryEfficiency = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCountryEfficiency = false; this.cdr.detectChanges(); },
    });
  }
}
