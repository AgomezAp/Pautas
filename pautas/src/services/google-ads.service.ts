import { env } from '../config/environment';
import { logger } from '../utils/logger';

const STATUS_MAP: Record<number, string> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'ENABLED',
  3: 'PAUSED',
  4: 'REMOVED',
};

const COUNTRY_PATTERNS: Record<string, string> = {
  'COLOMBIA': 'CO',
  'MEXICO': 'MX',
  'PERU': 'PE',
  'CHILE': 'CL',
  'ECUADOR': 'EC',
  'PANAMA': 'PA',
  'BOLIVIA': 'BO',
  'ESPAÑA': 'ES',
};

const CONCURRENCY_LIMIT = 5;

// Helper: micros to currency
const micros = (v: any) => Number(v || 0) / 1_000_000;
const num = (v: any) => Number(v || 0);
const str = (v: any) => String(v ?? '');

export interface ClientAccount {
  id: string;
  name: string;
}

class GoogleAdsService {
  private client: any = null;
  private cachedClientAccounts: ClientAccount[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 30 * 60 * 1000;
  private rateLimitHit = false;

  // ── Core: API init, Customer, MCC discovery, concurrency ──

  private async getApi(): Promise<any> {
    if (this.client) return this.client;
    if (!env.googleAds.developerToken || !env.googleAds.clientId) {
      logger.warn('Google Ads API not configured');
      return null;
    }
    try {
      const { GoogleAdsApi } = await import('google-ads-api');
      this.client = new GoogleAdsApi({
        client_id: env.googleAds.clientId,
        client_secret: env.googleAds.clientSecret,
        developer_token: env.googleAds.developerToken,
      });
      return this.client;
    } catch (error: any) {
      logger.error(`Failed to initialize Google Ads client: ${error.message}`);
      return null;
    }
  }

  private getCustomer(api: any, customerId: string, loginCustomerId?: string): any {
    const opts: any = { customer_id: customerId, refresh_token: env.googleAds.refreshToken };
    if (loginCustomerId) opts.login_customer_id = loginCustomerId;
    return api.Customer(opts);
  }

  private detectCountryCode(name: string): string | null {
    const upper = name.toUpperCase();
    for (const [pattern, code] of Object.entries(COUNTRY_PATTERNS)) {
      if (upper.includes(pattern)) return code;
    }
    return null;
  }

  private async runWithConcurrency<T>(items: T[], fn: (item: T) => Promise<void>, limit: number): Promise<void> {
    this.rateLimitHit = false;
    let index = 0;
    const run = async () => {
      while (index < items.length && !this.rateLimitHit) {
        const i = index++;
        await fn(items[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  }

  private handleError(error: any, context: string) {
    if (error.errors?.[0]?.error_code?.quota_error === 'RESOURCE_EXHAUSTED') {
      this.rateLimitHit = true;
      logger.warn(`Rate limit hit during ${context}`);
    } else {
      logger.error(`Error in ${context}: ${error.errors?.[0]?.message || error.message}`);
    }
  }

  private resolveStatus(statusCode: any): string {
    return typeof statusCode === 'number' ? (STATUS_MAP[statusCode] || 'UNKNOWN') : str(statusCode);
  }

  // Generic helper that queries all accounts and collects results
  private async queryAllAccounts<T>(
    gaql: string,
    mapper: (row: any, account: ClientAccount) => T | T[] | null,
    label: string,
    filterActive = false,
  ): Promise<T[]> {
    const api = await this.getApi();
    if (!api) return [];

    let accounts = await this.getClientAccounts();
    if (accounts.length === 0) return [];
    if (filterActive) {
      accounts = accounts.filter(a => !a.name.toUpperCase().startsWith('PAUSADA'));
    }

    const managerId = env.googleAds.managerAccountId;
    const results: T[] = [];

    await this.runWithConcurrency(accounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const rows = await customer.query(gaql);
        for (const row of rows) {
          const mapped = mapper(row, account);
          if (mapped !== null) {
            if (Array.isArray(mapped)) results.push(...mapped);
            else results.push(mapped);
          }
        }
      } catch (error: any) {
        this.handleError(error, `${label} [${account.id}]`);
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`[${label}] Fetched ${results.length} records`);
    return results;
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Account Discovery
  // ════════════════════════════════════════════════════════════

  async getClientAccounts(): Promise<ClientAccount[]> {
    if (this.cachedClientAccounts && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedClientAccounts;
    }
    const api = await this.getApi();
    if (!api) return [];
    try {
      const manager = this.getCustomer(api, env.googleAds.managerAccountId);
      const results = await manager.query(
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'"
      );
      this.cachedClientAccounts = results.map((r: any) => ({
        id: str(r.customer_client.id),
        name: r.customer_client.descriptive_name || '',
      }));
      this.cacheTimestamp = Date.now();
      logger.info(`Found ${this.cachedClientAccounts!.length} client accounts under MCC`);
      return this.cachedClientAccounts!;
    } catch (error: any) {
      logger.error(`Could not query MCC: ${error.errors?.[0]?.message || error.message}`);
      return [];
    }
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Account Info (customer resource)
  // ════════════════════════════════════════════════════════════

  async fetchAccountInfo() {
    return this.queryAllAccounts(
      `SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.auto_tagging_enabled,
        customer.has_partners_badge,
        customer.optimization_score,
        customer.optimization_score_weight,
        customer.status
      FROM customer`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        countryCode: this.detectCountryCode(account.name),
        currencyCode: r.customer?.currency_code || '',
        timeZone: r.customer?.time_zone || '',
        autoTaggingEnabled: r.customer?.auto_tagging_enabled || false,
        hasPartnersBadge: r.customer?.has_partners_badge || false,
        optimizationScore: num(r.customer?.optimization_score),
        optimizationScoreWeight: num(r.customer?.optimization_score_weight),
        status: str(r.customer?.status),
      }),
      'AccountInfo',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Campaigns (with full metrics)
  // ════════════════════════════════════════════════════════════

  async fetchCampaigns(activeOnly = false) {
    const today = new Date().toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.advertising_channel_sub_type,
        campaign.start_date,
        campaign.end_date,
        campaign.serving_status,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method,
        campaign_budget.period,
        campaign_budget.total_amount_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.cost_per_conversion,
        metrics.search_impression_share,
        metrics.search_budget_lost_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.content_impression_share,
        metrics.interactions,
        metrics.interaction_rate,
        metrics.video_views,
        metrics.video_view_rate,
        metrics.engagements,
        metrics.engagement_rate,
        metrics.active_view_impressions,
        metrics.active_view_ctr,
        metrics.active_view_cpm,
        metrics.active_view_viewability
      FROM campaign
      WHERE segments.date = '${today}'
        AND campaign.status != 'REMOVED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        countryCode: this.detectCountryCode(account.name) || this.detectCountryCode(r.campaign?.name || ''),
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        status: this.resolveStatus(r.campaign?.status),
        channelType: str(r.campaign?.advertising_channel_type),
        channelSubType: str(r.campaign?.advertising_channel_sub_type),
        startDate: r.campaign?.start_date || null,
        endDate: r.campaign?.end_date || null,
        servingStatus: str(r.campaign?.serving_status),
        biddingStrategyType: str(r.campaign?.bidding_strategy_type),
        budget: {
          daily: micros(r.campaign_budget?.amount_micros),
          total: micros(r.campaign_budget?.total_amount_micros),
          deliveryMethod: str(r.campaign_budget?.delivery_method),
          period: str(r.campaign_budget?.period),
        },
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          allConversions: num(r.metrics?.all_conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          averageCpm: micros(r.metrics?.average_cpm),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          searchImpressionShare: num(r.metrics?.search_impression_share),
          searchBudgetLostImpressionShare: num(r.metrics?.search_budget_lost_impression_share),
          searchRankLostImpressionShare: num(r.metrics?.search_rank_lost_impression_share),
          contentImpressionShare: num(r.metrics?.content_impression_share),
          interactions: num(r.metrics?.interactions),
          interactionRate: num(r.metrics?.interaction_rate),
          videoViews: num(r.metrics?.video_views),
          videoViewRate: num(r.metrics?.video_view_rate),
          engagements: num(r.metrics?.engagements),
          engagementRate: num(r.metrics?.engagement_rate),
          activeViewImpressions: num(r.metrics?.active_view_impressions),
          activeViewCtr: num(r.metrics?.active_view_ctr),
          activeViewCpm: micros(r.metrics?.active_view_cpm),
          activeViewViewability: num(r.metrics?.active_view_viewability),
        },
      }),
      'Campaigns',
      activeOnly,
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Campaign history (date range)
  // ════════════════════════════════════════════════════════════

  async fetchCampaignHistory(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.interactions,
        metrics.video_views
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        date: r.segments?.date || '',
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          interactions: num(r.metrics?.interactions),
          videoViews: num(r.metrics?.video_views),
        },
      }),
      'CampaignHistory',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Ad Groups
  // ════════════════════════════════════════════════════════════

  async fetchAdGroups() {
    const today = new Date().toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        ad_group.cpc_bid_micros,
        ad_group.cpm_bid_micros,
        ad_group.target_cpa_micros,
        ad_group.target_roas,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.interactions,
        metrics.interaction_rate
      FROM ad_group
      WHERE segments.date = '${today}'
        AND ad_group.status != 'REMOVED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        status: this.resolveStatus(r.ad_group?.status),
        type: str(r.ad_group?.type),
        cpcBid: micros(r.ad_group?.cpc_bid_micros),
        cpmBid: micros(r.ad_group?.cpm_bid_micros),
        targetCpa: micros(r.ad_group?.target_cpa_micros),
        targetRoas: num(r.ad_group?.target_roas),
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          interactions: num(r.metrics?.interactions),
          interactionRate: num(r.metrics?.interaction_rate),
        },
      }),
      'AdGroups',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Ads (individual ad creatives)
  // ════════════════════════════════════════════════════════════

  async fetchAds() {
    const today = new Date().toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.type,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.final_mobile_urls,
        ad_group_ad.ad.display_url,
        ad_group_ad.status,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM ad_group_ad
      WHERE segments.date = '${today}'
        AND ad_group_ad.status != 'REMOVED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        adId: str(r.ad_group_ad?.ad?.id),
        adName: r.ad_group_ad?.ad?.name || '',
        adType: str(r.ad_group_ad?.ad?.type),
        status: this.resolveStatus(r.ad_group_ad?.status),
        finalUrls: r.ad_group_ad?.ad?.final_urls || [],
        finalMobileUrls: r.ad_group_ad?.ad?.final_mobile_urls || [],
        displayUrl: r.ad_group_ad?.ad?.display_url || '',
        responsiveSearchAd: {
          headlines: (r.ad_group_ad?.ad?.responsive_search_ad?.headlines || []).map((h: any) => h.text || ''),
          descriptions: (r.ad_group_ad?.ad?.responsive_search_ad?.descriptions || []).map((d: any) => d.text || ''),
        },
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'Ads',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Keywords
  // ════════════════════════════════════════════════════════════

  async fetchKeywords() {
    const today = new Date().toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.final_urls,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.top_impression_percentage,
        metrics.absolute_top_impression_percentage
      FROM keyword_view
      WHERE segments.date = '${today}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        criterionId: str(r.ad_group_criterion?.criterion_id),
        keyword: r.ad_group_criterion?.keyword?.text || '',
        matchType: str(r.ad_group_criterion?.keyword?.match_type),
        status: this.resolveStatus(r.ad_group_criterion?.status),
        qualityScore: num(r.ad_group_criterion?.quality_info?.quality_score),
        creativeQualityScore: str(r.ad_group_criterion?.quality_info?.creative_quality_score),
        postClickQualityScore: str(r.ad_group_criterion?.quality_info?.post_click_quality_score),
        searchPredictedCtr: str(r.ad_group_criterion?.quality_info?.search_predicted_ctr),
        effectiveCpcBid: micros(r.ad_group_criterion?.effective_cpc_bid_micros),
        finalUrls: r.ad_group_criterion?.final_urls || [],
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          searchImpressionShare: num(r.metrics?.search_impression_share),
          searchRankLostImpressionShare: num(r.metrics?.search_rank_lost_impression_share),
          topImpressionPercentage: num(r.metrics?.top_impression_percentage),
          absoluteTopImpressionPercentage: num(r.metrics?.absolute_top_impression_percentage),
        },
      }),
      'Keywords',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Search Terms
  // ════════════════════════════════════════════════════════════

  async fetchSearchTerms(days = 7) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        search_term_view.search_term,
        search_term_view.status,
        segments.date,
        segments.search_term_match_type,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM search_term_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        searchTerm: r.search_term_view?.search_term || '',
        matchType: str(r.segments?.search_term_match_type),
        status: str(r.search_term_view?.status),
        date: r.segments?.date || '',
        metrics: {
          conversions: num(r.metrics?.conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'SearchTerms',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Geographic Performance
  // ════════════════════════════════════════════════════════════

  async fetchGeographicPerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        geographic_view.country_criterion_id,
        geographic_view.location_type,
        campaign_criterion.location.geo_target_constant,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM geographic_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        countryCriterionId: str(r.geographic_view?.country_criterion_id),
        locationType: str(r.geographic_view?.location_type),
        geoTargetConstant: str(r.campaign_criterion?.location?.geo_target_constant),
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'GeographicPerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: User Location Performance
  // ════════════════════════════════════════════════════════════

  async fetchUserLocationPerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        user_location_view.country_criterion_id,
        user_location_view.targeting_location,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr
      FROM user_location_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        countryCriterionId: str(r.user_location_view?.country_criterion_id),
        targetingLocation: r.user_location_view?.targeting_location || false,
        metrics: {
          conversions: num(r.metrics?.conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
        },
      }),
      'UserLocationPerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Age Range Demographics
  // ════════════════════════════════════════════════════════════

  async fetchAgeRangePerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        ad_group_criterion.age_range.type,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM age_range_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        ageRange: str(r.ad_group_criterion?.age_range?.type),
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'AgeRangePerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Gender Demographics
  // ════════════════════════════════════════════════════════════

  async fetchGenderPerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        ad_group_criterion.gender.type,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM gender_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        gender: str(r.ad_group_criterion?.gender?.type),
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'GenderPerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Device Performance (via campaign segments)
  // ════════════════════════════════════════════════════════════

  async fetchDevicePerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign.id,
        campaign.name,
        segments.device,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.video_views,
        metrics.interactions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        device: str(r.segments?.device),
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          videoViews: num(r.metrics?.video_views),
          interactions: num(r.metrics?.interactions),
        },
      }),
      'DevicePerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Ad Schedule (day of week / hour)
  // ════════════════════════════════════════════════════════════

  async fetchAdSchedulePerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign.id,
        campaign.name,
        segments.day_of_week,
        segments.hour,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad_schedule_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        dayOfWeek: str(r.segments?.day_of_week),
        hour: num(r.segments?.hour),
        metrics: {
          conversions: num(r.metrics?.conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
        },
      }),
      'AdSchedulePerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Landing Page Performance
  // ════════════════════════════════════════════════════════════

  async fetchLandingPagePerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        landing_page_view.unexpanded_final_url,
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion,
        metrics.mobile_friendly_clicks_percentage,
        metrics.speed_score
      FROM landing_page_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        adGroupId: str(r.ad_group?.id),
        adGroupName: r.ad_group?.name || '',
        landingPageUrl: r.landing_page_view?.unexpanded_final_url || '',
        metrics: {
          conversions: num(r.metrics?.conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
          mobileFriendlyClicksPercentage: num(r.metrics?.mobile_friendly_clicks_percentage),
          speedScore: num(r.metrics?.speed_score),
        },
      }),
      'LandingPagePerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Conversion Actions
  // ════════════════════════════════════════════════════════════

  async fetchConversionActions() {
    return this.queryAllAccounts(
      `SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.type,
        conversion_action.category,
        conversion_action.status,
        conversion_action.counting_type,
        conversion_action.attribution_model_settings.attribution_model,
        conversion_action.value_settings.default_value,
        conversion_action.value_settings.default_currency_code,
        conversion_action.click_through_lookback_window_days,
        conversion_action.view_through_lookback_window_days,
        conversion_action.include_in_conversions_metric,
        conversion_action.phone_call_duration_seconds,
        conversion_action.app_id
      FROM conversion_action`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        conversionActionId: str(r.conversion_action?.id),
        name: r.conversion_action?.name || '',
        type: str(r.conversion_action?.type),
        category: str(r.conversion_action?.category),
        status: str(r.conversion_action?.status),
        countingType: str(r.conversion_action?.counting_type),
        attributionModel: str(r.conversion_action?.attribution_model_settings?.attribution_model),
        defaultValue: num(r.conversion_action?.value_settings?.default_value),
        defaultCurrency: r.conversion_action?.value_settings?.default_currency_code || '',
        clickThroughLookbackDays: num(r.conversion_action?.click_through_lookback_window_days),
        viewThroughLookbackDays: num(r.conversion_action?.view_through_lookback_window_days),
        includeInConversionsMetric: r.conversion_action?.include_in_conversions_metric ?? true,
        phoneCallDurationSeconds: num(r.conversion_action?.phone_call_duration_seconds),
        appId: r.conversion_action?.app_id || '',
      }),
      'ConversionActions',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Network Type Performance (Search vs Display vs YouTube)
  // ════════════════════════════════════════════════════════════

  async fetchNetworkPerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign.id,
        campaign.name,
        segments.ad_network_type,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        networkType: str(r.segments?.ad_network_type),
        metrics: {
          conversions: num(r.metrics?.conversions),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'NetworkPerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Change History (audit log)
  // ════════════════════════════════════════════════════════════

  async fetchChangeHistory(days = 7) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        change_event.change_date_time,
        change_event.change_resource_type,
        change_event.change_resource_name,
        change_event.client_type,
        change_event.user_email,
        change_event.resource_change_operation,
        change_event.changed_fields,
        change_event.old_resource,
        change_event.new_resource,
        campaign.id,
        campaign.name
      FROM change_event
      WHERE change_event.change_date_time >= '${startDate}'
        AND change_event.change_date_time <= '${endDate} 23:59:59'
      ORDER BY change_event.change_date_time DESC
      LIMIT 1000`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        changeDateTime: r.change_event?.change_date_time || '',
        resourceType: str(r.change_event?.change_resource_type),
        resourceName: r.change_event?.change_resource_name || '',
        clientType: str(r.change_event?.client_type),
        userEmail: r.change_event?.user_email || '',
        operation: str(r.change_event?.resource_change_operation),
        changedFields: r.change_event?.changed_fields || [],
        oldResource: r.change_event?.old_resource || null,
        newResource: r.change_event?.new_resource || null,
      }),
      'ChangeHistory',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Labels
  // ════════════════════════════════════════════════════════════

  async fetchLabels() {
    return this.queryAllAccounts(
      `SELECT
        label.id,
        label.name,
        label.status,
        label.text_label.background_color,
        label.text_label.description
      FROM label`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        labelId: str(r.label?.id),
        name: r.label?.name || '',
        status: str(r.label?.status),
        backgroundColor: r.label?.text_label?.background_color || '',
        description: r.label?.text_label?.description || '',
      }),
      'Labels',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Audiences
  // ════════════════════════════════════════════════════════════

  async fetchAudiencePerformance(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return this.queryAllAccounts(
      `SELECT
        campaign_audience_view.resource_name,
        campaign.id,
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM campaign_audience_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        resourceName: r.campaign_audience_view?.resource_name || '',
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
          ctr: num(r.metrics?.ctr),
          averageCpc: micros(r.metrics?.average_cpc),
          costPerConversion: micros(r.metrics?.cost_per_conversion),
        },
      }),
      'AudiencePerformance',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Billing Accounts
  // ════════════════════════════════════════════════════════════

  async fetchBillingAccounts() {
    const api = await this.getApi();
    if (!api) return [];
    const accounts = await this.getClientAccounts();
    const managerId = env.googleAds.managerAccountId;
    const results: any[] = [];

    await this.runWithConcurrency(accounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        // Get currency
        const custRows = await customer.query(`SELECT customer.currency_code FROM customer`);
        const currencyCode = custRows[0]?.customer?.currency_code || '';

        const rows = await customer.query(`
          SELECT
            billing_setup.id,
            billing_setup.status,
            billing_setup.payments_account,
            billing_setup.payments_account_info.payments_account_id,
            billing_setup.payments_account_info.payments_account_name,
            billing_setup.payments_account_info.payments_profile_id,
            billing_setup.payments_account_info.payments_profile_name,
            billing_setup.payments_account_info.secondary_payments_profile_id
          FROM billing_setup
          WHERE billing_setup.status = 'APPROVED'
        `);

        for (const r of rows) {
          const info = r.billing_setup?.payments_account_info;
          results.push({
            accountId: account.id,
            accountName: account.name,
            countryCode: this.detectCountryCode(account.name),
            billingId: str(r.billing_setup?.id),
            status: str(r.billing_setup?.status),
            paymentsAccountId: info?.payments_account_id || '',
            paymentsAccountName: info?.payments_account_name || '',
            paymentsProfileId: info?.payments_profile_id || '',
            paymentsProfileName: info?.payments_profile_name || '',
            secondaryPaymentsProfileId: info?.secondary_payments_profile_id || '',
            currencyCode,
          });
        }
      } catch (error: any) {
        this.handleError(error, `BillingAccounts [${account.id}]`);
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`[BillingAccounts] Fetched ${results.length} records`);
    return results;
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Invoices
  // ════════════════════════════════════════════════════════════

  async fetchInvoices() {
    return this.queryAllAccounts(
      `SELECT
        invoice.id,
        invoice.type,
        invoice.issue_date,
        invoice.due_date,
        invoice.subtotal_amount_micros,
        invoice.tax_amount_micros,
        invoice.total_amount_micros,
        invoice.currency_code,
        invoice.pdf_url,
        invoice.payments_account_id,
        invoice.payments_profile_id
      FROM invoice
      WHERE invoice.issue_date DURING LAST_BUSINESS_YEAR`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        invoiceId: str(r.invoice?.id),
        type: str(r.invoice?.type),
        issueDate: r.invoice?.issue_date || '',
        dueDate: r.invoice?.due_date || '',
        subtotal: micros(r.invoice?.subtotal_amount_micros),
        tax: micros(r.invoice?.tax_amount_micros),
        total: micros(r.invoice?.total_amount_micros),
        currencyCode: r.invoice?.currency_code || '',
        pdfUrl: r.invoice?.pdf_url || '',
        paymentsAccountId: r.invoice?.payments_account_id || '',
        paymentsProfileId: r.invoice?.payments_profile_id || '',
      }),
      'Invoices',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Account Charges (budgets)
  // ════════════════════════════════════════════════════════════

  async fetchAccountCharges() {
    return this.queryAllAccounts(
      `SELECT
        account_budget.id,
        account_budget.name,
        account_budget.status,
        account_budget.proposed_start_date_time,
        account_budget.approved_start_date_time,
        account_budget.proposed_end_date_time,
        account_budget.approved_end_date_time,
        account_budget.purchase_order_number,
        account_budget.total_adjustments_micros,
        account_budget.amount_served_micros,
        account_budget.approved_spending_limit_micros,
        account_budget.proposed_spending_limit_micros,
        account_budget.billing_setup
      FROM account_budget`,
      (r, account) => {
        const ab = r.account_budget;
        return {
          accountId: account.id,
          accountName: account.name,
          budgetId: str(ab?.id),
          budgetName: ab?.name || '',
          budgetStatus: str(ab?.status),
          proposedStartDate: ab?.proposed_start_date_time || null,
          approvedStartDate: ab?.approved_start_date_time || null,
          proposedEndDate: ab?.proposed_end_date_time || null,
          approvedEndDate: ab?.approved_end_date_time || null,
          purchaseOrderNumber: ab?.purchase_order_number || '',
          totalAdjustments: micros(ab?.total_adjustments_micros),
          amountServed: micros(ab?.amount_served_micros),
          approvedSpendingLimit: micros(ab?.approved_spending_limit_micros),
          proposedSpendingLimit: micros(ab?.proposed_spending_limit_micros),
          billingSetup: str(ab?.billing_setup),
        };
      },
      'AccountCharges',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Recharges (budget proposals)
  // ════════════════════════════════════════════════════════════

  async fetchRecharges() {
    const api = await this.getApi();
    if (!api) return [];
    const accounts = await this.getClientAccounts();
    const managerId = env.googleAds.managerAccountId;
    const results: any[] = [];

    await this.runWithConcurrency(accounts, async (account) => {
      const customer = this.getCustomer(api, account.id, managerId);
      try {
        const rows = await customer.query(`
          SELECT
            account_budget_proposal.id,
            account_budget_proposal.proposal_type,
            account_budget_proposal.status,
            account_budget_proposal.proposed_spending_limit_micros,
            account_budget_proposal.approved_spending_limit_micros,
            account_budget_proposal.proposed_start_date_time,
            account_budget_proposal.approved_start_date_time,
            account_budget_proposal.proposed_end_date_time,
            account_budget_proposal.approved_end_date_time,
            account_budget_proposal.creation_date_time,
            account_budget_proposal.approval_date_time,
            account_budget_proposal.account_budget
          FROM account_budget_proposal
          WHERE account_budget_proposal.status = 'APPROVED'
          ORDER BY account_budget_proposal.creation_date_time ASC
        `);

        let prevLimit: number | null = null;
        for (const r of rows) {
          const p = r.account_budget_proposal;
          const approvedLimit = Number(p?.approved_spending_limit_micros || 0);
          const rechargeAmount = prevLimit !== null ? (approvedLimit - prevLimit) : approvedLimit;
          prevLimit = approvedLimit;

          results.push({
            accountId: account.id,
            accountName: account.name,
            countryCode: this.detectCountryCode(account.name),
            proposalId: str(p?.id),
            proposalType: str(p?.proposal_type),
            status: str(p?.status),
            rechargeAmount: rechargeAmount / 1_000_000,
            newSpendingLimit: micros(approvedLimit * 1_000_000), // already in micros
            proposedSpendingLimit: micros(p?.proposed_spending_limit_micros),
            approvedSpendingLimit: micros(p?.approved_spending_limit_micros),
            proposedStartDate: p?.proposed_start_date_time || null,
            approvedStartDate: p?.approved_start_date_time || null,
            proposedEndDate: p?.proposed_end_date_time || null,
            approvedEndDate: p?.approved_end_date_time || null,
            creationDate: p?.creation_date_time || '',
            approvalDate: p?.approval_date_time || '',
            accountBudget: str(p?.account_budget),
          });
        }
      } catch (error: any) {
        this.handleError(error, `Recharges [${account.id}]`);
      }
    }, CONCURRENCY_LIMIT);

    logger.info(`[Recharges] Fetched ${results.length} records`);
    return results;
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Recommendations
  // ════════════════════════════════════════════════════════════

  async fetchRecommendations() {
    return this.queryAllAccounts(
      `SELECT
        recommendation.type,
        recommendation.impact.base_metrics.impressions,
        recommendation.impact.base_metrics.clicks,
        recommendation.impact.base_metrics.cost_micros,
        recommendation.impact.base_metrics.conversions,
        recommendation.impact.potential_metrics.impressions,
        recommendation.impact.potential_metrics.clicks,
        recommendation.impact.potential_metrics.cost_micros,
        recommendation.impact.potential_metrics.conversions,
        recommendation.campaign,
        campaign.id,
        campaign.name
      FROM recommendation`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        type: str(r.recommendation?.type),
        impact: {
          baseMetrics: {
            impressions: num(r.recommendation?.impact?.base_metrics?.impressions),
            clicks: num(r.recommendation?.impact?.base_metrics?.clicks),
            cost: micros(r.recommendation?.impact?.base_metrics?.cost_micros),
            conversions: num(r.recommendation?.impact?.base_metrics?.conversions),
          },
          potentialMetrics: {
            impressions: num(r.recommendation?.impact?.potential_metrics?.impressions),
            clicks: num(r.recommendation?.impact?.potential_metrics?.clicks),
            cost: micros(r.recommendation?.impact?.potential_metrics?.cost_micros),
            conversions: num(r.recommendation?.impact?.potential_metrics?.conversions),
          },
        },
      }),
      'Recommendations',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Bidding Strategies
  // ════════════════════════════════════════════════════════════

  async fetchBiddingStrategies() {
    return this.queryAllAccounts(
      `SELECT
        bidding_strategy.id,
        bidding_strategy.name,
        bidding_strategy.type,
        bidding_strategy.status,
        bidding_strategy.campaign_count,
        bidding_strategy.non_removed_campaign_count,
        bidding_strategy.effective_currency_code,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM bidding_strategy`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        strategyId: str(r.bidding_strategy?.id),
        name: r.bidding_strategy?.name || '',
        type: str(r.bidding_strategy?.type),
        status: str(r.bidding_strategy?.status),
        campaignCount: num(r.bidding_strategy?.campaign_count),
        nonRemovedCampaignCount: num(r.bidding_strategy?.non_removed_campaign_count),
        effectiveCurrencyCode: r.bidding_strategy?.effective_currency_code || '',
        metrics: {
          conversions: num(r.metrics?.conversions),
          conversionsValue: num(r.metrics?.conversions_value),
          cost: micros(r.metrics?.cost_micros),
          clicks: num(r.metrics?.clicks),
          impressions: num(r.metrics?.impressions),
        },
      }),
      'BiddingStrategies',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Assets (sitelinks, callouts, images, etc.)
  // ════════════════════════════════════════════════════════════

  async fetchAssets() {
    return this.queryAllAccounts(
      `SELECT
        asset.id,
        asset.name,
        asset.type,
        asset.final_urls,
        asset.final_mobile_urls,
        asset.source,
        asset.sitelink_asset.description1,
        asset.sitelink_asset.description2,
        asset.sitelink_asset.link_text,
        asset.callout_asset.callout_text,
        asset.structured_snippet_asset.header,
        asset.structured_snippet_asset.values,
        asset.call_asset.phone_number,
        asset.call_asset.country_code,
        asset.image_asset.full_size.url,
        asset.image_asset.file_size,
        asset.youtube_video_asset.youtube_video_id,
        asset.youtube_video_asset.youtube_video_title
      FROM asset`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        assetId: str(r.asset?.id),
        name: r.asset?.name || '',
        type: str(r.asset?.type),
        source: str(r.asset?.source),
        finalUrls: r.asset?.final_urls || [],
        finalMobileUrls: r.asset?.final_mobile_urls || [],
        sitelink: r.asset?.sitelink_asset ? {
          linkText: r.asset.sitelink_asset.link_text || '',
          description1: r.asset.sitelink_asset.description1 || '',
          description2: r.asset.sitelink_asset.description2 || '',
        } : null,
        callout: r.asset?.callout_asset ? {
          calloutText: r.asset.callout_asset.callout_text || '',
        } : null,
        structuredSnippet: r.asset?.structured_snippet_asset ? {
          header: r.asset.structured_snippet_asset.header || '',
          values: r.asset.structured_snippet_asset.values || [],
        } : null,
        callAsset: r.asset?.call_asset ? {
          phoneNumber: r.asset.call_asset.phone_number || '',
          countryCode: r.asset.call_asset.country_code || '',
        } : null,
        imageAsset: r.asset?.image_asset ? {
          url: r.asset.image_asset.full_size?.url || '',
          fileSize: num(r.asset.image_asset.file_size),
        } : null,
        youtubeVideoAsset: r.asset?.youtube_video_asset ? {
          videoId: r.asset.youtube_video_asset.youtube_video_id || '',
          videoTitle: r.asset.youtube_video_asset.youtube_video_title || '',
        } : null,
      }),
      'Assets',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Shared Negative Keyword Lists
  // ════════════════════════════════════════════════════════════

  async fetchSharedSets() {
    return this.queryAllAccounts(
      `SELECT
        shared_set.id,
        shared_set.name,
        shared_set.type,
        shared_set.status,
        shared_set.member_count,
        shared_set.reference_count
      FROM shared_set
      WHERE shared_set.status = 'ENABLED'`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        sharedSetId: str(r.shared_set?.id),
        name: r.shared_set?.name || '',
        type: str(r.shared_set?.type),
        status: str(r.shared_set?.status),
        memberCount: num(r.shared_set?.member_count),
        referenceCount: num(r.shared_set?.reference_count),
      }),
      'SharedSets',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Campaign Criteria (targeting)
  // ════════════════════════════════════════════════════════════

  async fetchCampaignTargeting() {
    return this.queryAllAccounts(
      `SELECT
        campaign_criterion.criterion_id,
        campaign_criterion.type,
        campaign_criterion.status,
        campaign_criterion.bid_modifier,
        campaign_criterion.negative,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.language.language_constant,
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type,
        campaign.id,
        campaign.name
      FROM campaign_criterion`,
      (r, account) => ({
        accountId: account.id,
        accountName: account.name,
        campaignId: str(r.campaign?.id),
        campaignName: r.campaign?.name || '',
        criterionId: str(r.campaign_criterion?.criterion_id),
        type: str(r.campaign_criterion?.type),
        status: str(r.campaign_criterion?.status),
        bidModifier: num(r.campaign_criterion?.bid_modifier),
        isNegative: r.campaign_criterion?.negative || false,
        location: r.campaign_criterion?.location?.geo_target_constant || null,
        language: r.campaign_criterion?.language?.language_constant || null,
        keyword: r.campaign_criterion?.keyword ? {
          text: r.campaign_criterion.keyword.text || '',
          matchType: str(r.campaign_criterion.keyword.match_type),
        } : null,
      }),
      'CampaignTargeting',
    );
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC: Fetch Everything
  // ════════════════════════════════════════════════════════════

  async fetchAll() {
    logger.info('Starting full Google Ads data fetch...');
    const [
      accountInfo,
      campaigns,
      adGroups,
      ads,
      keywords,
      searchTerms,
      geographic,
      userLocation,
      ageRange,
      gender,
      device,
      adSchedule,
      landingPages,
      network,
      conversionActions,
      audiences,
      billing,
      invoices,
      charges,
      recharges,
      recommendations,
      biddingStrategies,
      assets,
      sharedSets,
      campaignTargeting,
      labels,
      changeHistory,
    ] = await Promise.all([
      this.fetchAccountInfo(),
      this.fetchCampaigns(),
      this.fetchAdGroups(),
      this.fetchAds(),
      this.fetchKeywords(),
      this.fetchSearchTerms(),
      this.fetchGeographicPerformance(),
      this.fetchUserLocationPerformance(),
      this.fetchAgeRangePerformance(),
      this.fetchGenderPerformance(),
      this.fetchDevicePerformance(),
      this.fetchAdSchedulePerformance(),
      this.fetchLandingPagePerformance(),
      this.fetchNetworkPerformance(),
      this.fetchConversionActions(),
      this.fetchAudiencePerformance(),
      this.fetchBillingAccounts(),
      this.fetchInvoices(),
      this.fetchAccountCharges(),
      this.fetchRecharges(),
      this.fetchRecommendations(),
      this.fetchBiddingStrategies(),
      this.fetchAssets(),
      this.fetchSharedSets(),
      this.fetchCampaignTargeting(),
      this.fetchLabels(),
      this.fetchChangeHistory(),
    ]);

    logger.info('Full Google Ads data fetch completed');
    return {
      accountInfo,
      campaigns,
      adGroups,
      ads,
      keywords,
      searchTerms,
      geographic,
      userLocation,
      ageRange,
      gender,
      device,
      adSchedule,
      landingPages,
      network,
      conversionActions,
      audiences,
      billing,
      invoices,
      charges,
      recharges,
      recommendations,
      biddingStrategies,
      assets,
      sharedSets,
      campaignTargeting,
      labels,
      changeHistory,
    };
  }
}

export const googleAdsService = new GoogleAdsService();
