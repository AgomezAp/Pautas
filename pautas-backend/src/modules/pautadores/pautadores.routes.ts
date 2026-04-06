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

// Conglomerado contrast endpoint
router.get('/conglomerado-contrast', (req, res, next) => pautadoresController.getConglomeradoContrast(req, res, next));

export { router as pautadoresRoutes };
