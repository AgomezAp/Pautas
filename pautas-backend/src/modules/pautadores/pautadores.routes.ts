import { Router } from 'express';
import { pautadoresController } from './pautadores.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';

const router = Router();

router.use(authMiddleware, roleMiddleware('pautador', 'admin'));

router.get('/entries/daily', (req, res, next) => pautadoresController.getEntriesDaily(req, res, next));
router.get('/entries/weekly', (req, res, next) => pautadoresController.getEntriesWeekly(req, res, next));
router.get('/entries/weekly-calendar', (req, res, next) => pautadoresController.getEntriesWeeklyCalendar(req, res, next));
router.get('/consolidated', (req, res, next) => pautadoresController.getConsolidated(req, res, next));
router.get('/campaigns', (req, res, next) => pautadoresController.getCampaigns(req, res, next));
router.get('/dashboard/kpis', (req, res, next) => pautadoresController.getDashboardKpis(req, res, next));
router.get('/dashboard/charts', (req, res, next) => pautadoresController.getDashboardCharts(req, res, next));
router.get('/export/excel', (req, res, next) => pautadoresController.exportExcel(req, res, next));
router.get('/export/pdf', (req, res, next) => pautadoresController.exportPdf(req, res, next));

// Google Ads data endpoints
router.get('/google-ads/my-accounts', pautadoresController.getMyGoogleAdsAccounts.bind(pautadoresController));
router.get('/google-ads/campaigns', (req, res, next) => pautadoresController.getGoogleAdsCampaigns(req, res, next));
router.get('/google-ads/campaigns-by-account', (req, res, next) => pautadoresController.getGoogleAdsCampaignsByAccount(req, res, next));
router.get('/google-ads/campaigns/:id/history', (req, res, next) => pautadoresController.getGoogleAdsCampaignHistory(req, res, next));
router.get('/google-ads/billing/accounts', (req, res, next) => pautadoresController.getGoogleAdsBillingAccounts(req, res, next));
router.get('/google-ads/billing/history', (req, res, next) => pautadoresController.getGoogleAdsBillingHistory(req, res, next));
router.get('/google-ads/billing/charges', (req, res, next) => pautadoresController.getGoogleAdsAccountCharges(req, res, next));
router.get('/google-ads/billing/recharges', (req, res, next) => pautadoresController.getGoogleAdsRecharges(req, res, next));
router.get('/google-ads/billing/recharges/export', (req, res, next) => pautadoresController.exportRechargesCsv(req, res, next));
router.get('/google-ads/recharges-dashboard', (req, res, next) => pautadoresController.getRechargesDashboard(req, res, next));
router.post('/google-ads/sync', (req, res, next) => pautadoresController.triggerGoogleAdsSync(req, res, next));

// Google Ads Analysis endpoints
router.get('/google-ads/analysis/data-range', (req, res, next) => pautadoresController.getAnalysisDataRange(req, res, next));
router.get('/google-ads/analysis/spending-trend', (req, res, next) => pautadoresController.getAnalysisSpendingTrend(req, res, next));
router.get('/google-ads/analysis/performance', (req, res, next) => pautadoresController.getAnalysisPerformance(req, res, next));
router.get('/google-ads/analysis/rankings', (req, res, next) => pautadoresController.getAnalysisRankings(req, res, next));
router.get('/google-ads/analysis/budget-distribution', (req, res, next) => pautadoresController.getAnalysisBudgetDistribution(req, res, next));
router.get('/google-ads/analysis/impression-share', (req, res, next) => pautadoresController.getAnalysisImpressionShare(req, res, next));
router.get('/google-ads/analysis/campaign-types', (req, res, next) => pautadoresController.getAnalysisCampaignTypes(req, res, next));
router.get('/google-ads/analysis/bidding-strategies', (req, res, next) => pautadoresController.getAnalysisBiddingStrategies(req, res, next));
router.get('/google-ads/analysis/keywords', (req, res, next) => pautadoresController.getAnalysisKeywords(req, res, next));
router.get('/google-ads/analysis/keyword-quality', (req, res, next) => pautadoresController.getAnalysisKeywordQuality(req, res, next));
router.get('/google-ads/analysis/devices', (req, res, next) => pautadoresController.getAnalysisDevices(req, res, next));
router.get('/google-ads/analysis/geo', (req, res, next) => pautadoresController.getAnalysisGeo(req, res, next));
router.get('/google-ads/analysis/hourly-heatmap', (req, res, next) => pautadoresController.getAnalysisHourlyHeatmap(req, res, next));

// Google Ads Budget Intelligence endpoints
router.get('/google-ads/analysis/budget-pacing', (req, res, next) => pautadoresController.getAnalysisBudgetPacing(req, res, next));
router.get('/google-ads/analysis/waste-detection', (req, res, next) => pautadoresController.getAnalysisWasteDetection(req, res, next));
router.get('/google-ads/analysis/optimal-schedule', (req, res, next) => pautadoresController.getAnalysisOptimalSchedule(req, res, next));
router.get('/google-ads/analysis/budget-forecast', (req, res, next) => pautadoresController.getAnalysisBudgetForecast(req, res, next));
router.get('/google-ads/analysis/budget-redistribution', (req, res, next) => pautadoresController.getAnalysisBudgetRedistribution(req, res, next));

// Phase 2: Comparaciones & Tendencias
router.get('/google-ads/analysis/temporal-comparison', (req, res, next) => pautadoresController.getAnalysisTemporalComparison(req, res, next));
router.get('/google-ads/analysis/cpa-analysis', (req, res, next) => pautadoresController.getAnalysisCPAAnalysis(req, res, next));
router.get('/google-ads/analysis/quality-score-trend', (req, res, next) => pautadoresController.getAnalysisQualityScoreTrend(req, res, next));
router.get('/google-ads/analysis/cpc-trend', (req, res, next) => pautadoresController.getAnalysisCPCTrend(req, res, next));
router.get('/google-ads/analysis/seasonality', (req, res, next) => pautadoresController.getAnalysisSeasonality(req, res, next));

// Phase 4: Search Terms & Keywords
router.get('/google-ads/analysis/search-terms', (req, res, next) => pautadoresController.getAnalysisSearchTerms(req, res, next));
router.get('/google-ads/analysis/negative-keyword-candidates', (req, res, next) => pautadoresController.getAnalysisNegativeKeywordCandidates(req, res, next));
router.get('/google-ads/analysis/long-tail', (req, res, next) => pautadoresController.getAnalysisLongTail(req, res, next));
router.get('/google-ads/analysis/keyword-cannibalization', (req, res, next) => pautadoresController.getAnalysisKeywordCannibalization(req, res, next));

// Phase 5: Ad Performance & Fatigue Detection
router.get('/google-ads/analysis/ad-performance-comparison', (req, res, next) => pautadoresController.getAnalysisAdPerformanceComparison(req, res, next));
router.get('/google-ads/analysis/ad-fatigue', (req, res, next) => pautadoresController.getAnalysisAdFatigue(req, res, next));
router.get('/google-ads/analysis/ad-type-performance', (req, res, next) => pautadoresController.getAnalysisAdTypePerformance(req, res, next));

// Phase 6: Competitive Intelligence / Auction Insights
router.get('/google-ads/analysis/auction-insights', (req, res, next) => pautadoresController.getAnalysisAuctionInsights(req, res, next));
router.get('/google-ads/analysis/competitive-position', (req, res, next) => pautadoresController.getAnalysisCompetitivePosition(req, res, next));
router.get('/google-ads/analysis/market-opportunities', (req, res, next) => pautadoresController.getAnalysisMarketOpportunities(req, res, next));

// Phase 7: Demographics
router.get('/google-ads/analysis/age-breakdown', (req, res, next) => pautadoresController.getAnalysisAgeBreakdown(req, res, next));
router.get('/google-ads/analysis/gender-breakdown', (req, res, next) => pautadoresController.getAnalysisGenderBreakdown(req, res, next));

// Phase 9: Enhanced Tabs
router.get('/google-ads/analysis/device-bid-recommendations', (req, res, next) => pautadoresController.getAnalysisDeviceBidRecommendations(req, res, next));
router.get('/google-ads/analysis/device-exclusions', (req, res, next) => pautadoresController.getAnalysisDeviceExclusions(req, res, next));
router.get('/google-ads/analysis/geo-tier-classification', (req, res, next) => pautadoresController.getAnalysisGeoTierClassification(req, res, next));
router.get('/google-ads/analysis/regional-patterns', (req, res, next) => pautadoresController.getAnalysisRegionalPatterns(req, res, next));
router.get('/google-ads/analysis/keyword-action-plan', (req, res, next) => pautadoresController.getAnalysisKeywordActionPlan(req, res, next));
router.get('/google-ads/analysis/match-type-recommendations', (req, res, next) => pautadoresController.getAnalysisMatchTypeRecommendations(req, res, next));
router.get('/google-ads/analysis/cross-account-keywords', (req, res, next) => pautadoresController.getAnalysisCrossAccountKeywords(req, res, next));
router.get('/google-ads/analysis/full-forecast', (req, res, next) => pautadoresController.getAnalysisFullForecast(req, res, next));
router.get('/google-ads/analysis/scaling-health', (req, res, next) => pautadoresController.getAnalysisScalingHealth(req, res, next));
router.get('/google-ads/analysis/competitive-market-trend', (req, res, next) => pautadoresController.getAnalysisCompetitiveMarketTrend(req, res, next));

// Phase 10: Dashboard Ejecutivo
router.get('/google-ads/analysis/account-health-scores', (req, res, next) => pautadoresController.getAnalysisAccountHealthScores(req, res, next));
router.get('/google-ads/analysis/executive-summary', (req, res, next) => pautadoresController.getAnalysisExecutiveSummary(req, res, next));
router.get('/google-ads/analysis/top-recommendations', (req, res, next) => pautadoresController.getAnalysisTopRecommendations(req, res, next));

// Phase 11: Auditoria Financiera
router.get('/google-ads/analysis/zombie-keywords', (req, res, next) => pautadoresController.getAnalysisZombieKeywords(req, res, next));
router.get('/google-ads/analysis/vampire-campaigns', (req, res, next) => pautadoresController.getAnalysisVampireCampaigns(req, res, next));
router.get('/google-ads/analysis/consolidated-action-plan', (req, res, next) => pautadoresController.getAnalysisConsolidatedActionPlan(req, res, next));

// Phase 12: Benchmark Cross-Account
router.get('/google-ads/analysis/account-benchmark', (req, res, next) => pautadoresController.getAnalysisAccountBenchmark(req, res, next));
router.get('/google-ads/analysis/portfolio-recommendation', (req, res, next) => pautadoresController.getAnalysisPortfolioRecommendation(req, res, next));
router.get('/google-ads/analysis/account-patterns', (req, res, next) => pautadoresController.getAnalysisAccountPatterns(req, res, next));

// Conglomerado contrast endpoint
router.get('/conglomerado-contrast', (req, res, next) => pautadoresController.getConglomeradoContrast(req, res, next));

// Phase 8: Scheduled Reports
router.get('/scheduled-reports', (req, res, next) => pautadoresController.getScheduledReports(req, res, next));
router.post('/scheduled-reports', (req, res, next) => pautadoresController.createScheduledReport(req, res, next));
router.put('/scheduled-reports/:id', (req, res, next) => pautadoresController.updateScheduledReport(req, res, next));
router.delete('/scheduled-reports/:id', (req, res, next) => pautadoresController.deleteScheduledReport(req, res, next));

export { router as pautadoresRoutes };
