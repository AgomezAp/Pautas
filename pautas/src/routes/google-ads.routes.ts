import { Router, Request, Response } from 'express';
import { googleAdsService } from '../services/google-ads.service';
import { persistenceService } from '../services/persistence.service';

const router = Router();

// Helper to create simple GET endpoints
const endpoint = (fn: (req: Request) => Promise<any>) => {
  return async (req: Request, res: Response) => {
    try {
      const data = await fn(req);
      res.json({ success: true, data, total: Array.isArray(data) ? data.length : undefined });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
};

// ── Account & Discovery ──
router.get('/accounts', endpoint(() => googleAdsService.getClientAccounts()));
router.get('/account-info', endpoint(() => googleAdsService.fetchAccountInfo()));

// ── Campaigns ──
router.get('/campaigns', endpoint((req) => googleAdsService.fetchCampaigns(req.query.active_only === 'true')));
router.get('/campaigns/history', endpoint((req) => googleAdsService.fetchCampaignHistory(Number(req.query.days) || 30)));

// ── Ad Groups ──
router.get('/ad-groups', endpoint(() => googleAdsService.fetchAdGroups()));

// ── Ads (creatives) ──
router.get('/ads', endpoint(() => googleAdsService.fetchAds()));

// ── Keywords ──
router.get('/keywords', endpoint(() => googleAdsService.fetchKeywords()));

// ── Search Terms ──
router.get('/search-terms', endpoint((req) => googleAdsService.fetchSearchTerms(Number(req.query.days) || 7)));

// ── Demographics ──
router.get('/demographics/age', endpoint((req) => googleAdsService.fetchAgeRangePerformance(Number(req.query.days) || 30)));
router.get('/demographics/gender', endpoint((req) => googleAdsService.fetchGenderPerformance(Number(req.query.days) || 30)));

// ── Geographic ──
router.get('/geographic', endpoint((req) => googleAdsService.fetchGeographicPerformance(Number(req.query.days) || 30)));
router.get('/geographic/user-location', endpoint((req) => googleAdsService.fetchUserLocationPerformance(Number(req.query.days) || 30)));

// ── Device Performance ──
router.get('/devices', endpoint((req) => googleAdsService.fetchDevicePerformance(Number(req.query.days) || 30)));

// ── Ad Schedule (day/hour) ──
router.get('/ad-schedule', endpoint((req) => googleAdsService.fetchAdSchedulePerformance(Number(req.query.days) || 30)));

// ── Network Type (Search vs Display vs YouTube) ──
router.get('/network', endpoint((req) => googleAdsService.fetchNetworkPerformance(Number(req.query.days) || 30)));

// ── Landing Pages ──
router.get('/landing-pages', endpoint((req) => googleAdsService.fetchLandingPagePerformance(Number(req.query.days) || 30)));

// ── Audiences ──
router.get('/audiences', endpoint((req) => googleAdsService.fetchAudiencePerformance(Number(req.query.days) || 30)));

// ── Conversion Actions ──
router.get('/conversion-actions', endpoint(() => googleAdsService.fetchConversionActions()));

// ── Billing ──
router.get('/billing', endpoint(() => googleAdsService.fetchBillingAccounts()));
router.get('/invoices', endpoint(() => googleAdsService.fetchInvoices()));
router.get('/charges', endpoint(() => googleAdsService.fetchAccountCharges()));
router.get('/recharges', endpoint(() => googleAdsService.fetchRecharges()));

// ── Bidding Strategies ──
router.get('/bidding-strategies', endpoint(() => googleAdsService.fetchBiddingStrategies()));

// ── Recommendations ──
router.get('/recommendations', endpoint(() => googleAdsService.fetchRecommendations()));

// ── Assets (sitelinks, callouts, images, videos) ──
router.get('/assets', endpoint(() => googleAdsService.fetchAssets()));

// ── Shared Sets (negative keyword lists) ──
router.get('/shared-sets', endpoint(() => googleAdsService.fetchSharedSets()));

// ── Campaign Targeting (locations, languages, keywords) ──
router.get('/campaign-targeting', endpoint(() => googleAdsService.fetchCampaignTargeting()));

// ── Labels ──
router.get('/labels', endpoint(() => googleAdsService.fetchLabels()));

// ── Change History (audit log) ──
router.get('/change-history', endpoint((req) => googleAdsService.fetchChangeHistory(Number(req.query.days) || 7)));

// ── Fetch Everything ──
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const data = await googleAdsService.fetchAll();
    const totals: Record<string, number> = {};
    for (const [key, value] of Object.entries(data)) {
      totals[key] = Array.isArray(value) ? value.length : 0;
    }
    res.json({ success: true, data, totals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sync - Fetch from Google Ads API and persist to DB
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const results = await persistenceService.syncAll();
    res.json({ success: true, message: 'Sincronización completada y guardada en DB', results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as googleAdsRoutes };
