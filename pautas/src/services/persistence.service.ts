import { query, getClient } from '../config/database';
import { googleAdsService } from './google-ads.service';
import { logger } from '../utils/logger';

class GoogleAdsPersistenceService {

  // Helper: batch upsert using a transaction
  private async batchUpsert(
    sql: string,
    rows: any[][],
    label: string,
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const client = await getClient();
    let count = 0;
    try {
      await client.query('BEGIN');
      for (const params of rows) {
        await client.query(sql, params);
        count++;
      }
      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error(`[Persist:${label}] Error: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
    logger.info(`[Persist:${label}] Upserted ${count} records`);
    return count;
  }

  // ────────────────────────────────────────────────────
  // Account Info
  // ────────────────────────────────────────────────────

  async persistAccountInfo(): Promise<number> {
    const data = await googleAdsService.fetchAccountInfo();
    return this.batchUpsert(
      `INSERT INTO client_accounts (account_id, account_name, country_code, currency_code, time_zone, auto_tagging, has_partners_badge, optimization_score, status, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (account_id) DO UPDATE SET
         account_name=EXCLUDED.account_name, country_code=EXCLUDED.country_code, currency_code=EXCLUDED.currency_code,
         time_zone=EXCLUDED.time_zone, auto_tagging=EXCLUDED.auto_tagging, has_partners_badge=EXCLUDED.has_partners_badge,
         optimization_score=EXCLUDED.optimization_score, status=EXCLUDED.status, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.accountName, d.countryCode, d.currencyCode, d.timeZone, d.autoTaggingEnabled, d.hasPartnersBadge, d.optimizationScore, d.status]),
      'AccountInfo',
    );
  }

  // ────────────────────────────────────────────────────
  // Campaigns
  // ────────────────────────────────────────────────────

  async persistCampaigns(activeOnly = false): Promise<{ campaigns: number; snapshots: number }> {
    const data = await googleAdsService.fetchCampaigns(activeOnly);
    const today = new Date().toISOString().split('T')[0];

    const campaigns = await this.batchUpsert(
      `INSERT INTO campaigns (account_id, campaign_id, campaign_name, country_code, status, channel_type, channel_sub_type, start_date, end_date, serving_status, bidding_strategy_type, budget_daily, budget_total, budget_delivery_method, budget_period, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (account_id, campaign_id) DO UPDATE SET
         campaign_name=EXCLUDED.campaign_name, country_code=EXCLUDED.country_code, status=EXCLUDED.status,
         channel_type=EXCLUDED.channel_type, channel_sub_type=EXCLUDED.channel_sub_type,
         start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, serving_status=EXCLUDED.serving_status,
         bidding_strategy_type=EXCLUDED.bidding_strategy_type, budget_daily=EXCLUDED.budget_daily,
         budget_total=EXCLUDED.budget_total, budget_delivery_method=EXCLUDED.budget_delivery_method,
         budget_period=EXCLUDED.budget_period, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.campaignName, d.countryCode, d.status, d.channelType, d.channelSubType, d.startDate, d.endDate, d.servingStatus, d.biddingStrategyType, d.budget.daily, d.budget.total, d.budget.deliveryMethod, d.budget.period]),
      'Campaigns',
    );

    const snapshots = await this.batchUpsert(
      `INSERT INTO campaign_snapshots (account_id, campaign_id, snapshot_date, conversions, conversions_value, all_conversions, cost, clicks, impressions, ctr, average_cpc, average_cpm, cost_per_conversion, search_impression_share, search_budget_lost_imp_share, search_rank_lost_imp_share, content_impression_share, interactions, interaction_rate, video_views, video_view_rate, engagements, engagement_rate, active_view_impressions, active_view_ctr, active_view_cpm, active_view_viewability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       ON CONFLICT (account_id, campaign_id, snapshot_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, conversions_value=EXCLUDED.conversions_value, all_conversions=EXCLUDED.all_conversions,
         cost=EXCLUDED.cost, clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr,
         average_cpc=EXCLUDED.average_cpc, average_cpm=EXCLUDED.average_cpm, cost_per_conversion=EXCLUDED.cost_per_conversion,
         search_impression_share=EXCLUDED.search_impression_share, search_budget_lost_imp_share=EXCLUDED.search_budget_lost_imp_share,
         search_rank_lost_imp_share=EXCLUDED.search_rank_lost_imp_share, content_impression_share=EXCLUDED.content_impression_share,
         interactions=EXCLUDED.interactions, interaction_rate=EXCLUDED.interaction_rate, video_views=EXCLUDED.video_views,
         video_view_rate=EXCLUDED.video_view_rate, engagements=EXCLUDED.engagements, engagement_rate=EXCLUDED.engagement_rate,
         active_view_impressions=EXCLUDED.active_view_impressions, active_view_ctr=EXCLUDED.active_view_ctr,
         active_view_cpm=EXCLUDED.active_view_cpm, active_view_viewability=EXCLUDED.active_view_viewability,
         fetched_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, today, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.allConversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.averageCpm, d.metrics.costPerConversion, d.metrics.searchImpressionShare, d.metrics.searchBudgetLostImpressionShare, d.metrics.searchRankLostImpressionShare, d.metrics.contentImpressionShare, d.metrics.interactions, d.metrics.interactionRate, d.metrics.videoViews, d.metrics.videoViewRate, d.metrics.engagements, d.metrics.engagementRate, d.metrics.activeViewImpressions, d.metrics.activeViewCtr, d.metrics.activeViewCpm, d.metrics.activeViewViewability]),
      'CampaignSnapshots',
    );

    return { campaigns, snapshots };
  }

  // ────────────────────────────────────────────────────
  // Campaign History
  // ────────────────────────────────────────────────────

  async persistCampaignHistory(days = 30): Promise<number> {
    const data = await googleAdsService.fetchCampaignHistory(days);
    return this.batchUpsert(
      `INSERT INTO campaign_snapshots (account_id, campaign_id, snapshot_date, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion, interactions, video_views)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (account_id, campaign_id, snapshot_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, conversions_value=EXCLUDED.conversions_value, cost=EXCLUDED.cost,
         clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr,
         average_cpc=EXCLUDED.average_cpc, cost_per_conversion=EXCLUDED.cost_per_conversion,
         interactions=EXCLUDED.interactions, video_views=EXCLUDED.video_views, fetched_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.date, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion, d.metrics.interactions, d.metrics.videoViews]),
      'CampaignHistory',
    );
  }

  // ────────────────────────────────────────────────────
  // Ad Groups
  // ────────────────────────────────────────────────────

  async persistAdGroups(): Promise<{ adGroups: number; snapshots: number }> {
    const data = await googleAdsService.fetchAdGroups();
    const today = new Date().toISOString().split('T')[0];

    const adGroups = await this.batchUpsert(
      `INSERT INTO ad_groups (account_id, campaign_id, ad_group_id, ad_group_name, status, type, cpc_bid, cpm_bid, target_cpa, target_roas, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (account_id, ad_group_id) DO UPDATE SET
         campaign_id=EXCLUDED.campaign_id, ad_group_name=EXCLUDED.ad_group_name, status=EXCLUDED.status,
         type=EXCLUDED.type, cpc_bid=EXCLUDED.cpc_bid, cpm_bid=EXCLUDED.cpm_bid,
         target_cpa=EXCLUDED.target_cpa, target_roas=EXCLUDED.target_roas, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.adGroupId, d.adGroupName, d.status, d.type, d.cpcBid, d.cpmBid, d.targetCpa, d.targetRoas]),
      'AdGroups',
    );

    const snapshots = await this.batchUpsert(
      `INSERT INTO ad_group_snapshots (account_id, campaign_id, ad_group_id, snapshot_date, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion, interactions, interaction_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (account_id, ad_group_id, snapshot_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, conversions_value=EXCLUDED.conversions_value, cost=EXCLUDED.cost,
         clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr,
         average_cpc=EXCLUDED.average_cpc, cost_per_conversion=EXCLUDED.cost_per_conversion,
         interactions=EXCLUDED.interactions, interaction_rate=EXCLUDED.interaction_rate, fetched_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.adGroupId, today, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion, d.metrics.interactions, d.metrics.interactionRate]),
      'AdGroupSnapshots',
    );

    return { adGroups, snapshots };
  }

  // ────────────────────────────────────────────────────
  // Ads
  // ────────────────────────────────────────────────────

  async persistAds(): Promise<{ ads: number; snapshots: number }> {
    const data = await googleAdsService.fetchAds();
    const today = new Date().toISOString().split('T')[0];

    const ads = await this.batchUpsert(
      `INSERT INTO ads (account_id, campaign_id, ad_group_id, ad_id, ad_name, ad_type, status, display_url, final_urls, final_mobile_urls, rsa_headlines, rsa_descriptions, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (account_id, ad_id) DO UPDATE SET
         campaign_id=EXCLUDED.campaign_id, ad_group_id=EXCLUDED.ad_group_id, ad_name=EXCLUDED.ad_name,
         ad_type=EXCLUDED.ad_type, status=EXCLUDED.status, display_url=EXCLUDED.display_url,
         final_urls=EXCLUDED.final_urls, final_mobile_urls=EXCLUDED.final_mobile_urls,
         rsa_headlines=EXCLUDED.rsa_headlines, rsa_descriptions=EXCLUDED.rsa_descriptions, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.adGroupId, d.adId, d.adName, d.adType, d.status, d.displayUrl, JSON.stringify(d.finalUrls), JSON.stringify(d.finalMobileUrls), JSON.stringify(d.responsiveSearchAd.headlines), JSON.stringify(d.responsiveSearchAd.descriptions)]),
      'Ads',
    );

    const snapshots = await this.batchUpsert(
      `INSERT INTO ad_snapshots (account_id, ad_id, snapshot_date, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (account_id, ad_id, snapshot_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, conversions_value=EXCLUDED.conversions_value, cost=EXCLUDED.cost,
         clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr,
         average_cpc=EXCLUDED.average_cpc, cost_per_conversion=EXCLUDED.cost_per_conversion, fetched_at=NOW()`,
      data.map(d => [d.accountId, d.adId, today, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'AdSnapshots',
    );

    return { ads, snapshots };
  }

  // ────────────────────────────────────────────────────
  // Keywords
  // ────────────────────────────────────────────────────

  async persistKeywords(): Promise<{ keywords: number; snapshots: number }> {
    const data = await googleAdsService.fetchKeywords();
    const today = new Date().toISOString().split('T')[0];

    const keywords = await this.batchUpsert(
      `INSERT INTO keywords (account_id, campaign_id, ad_group_id, criterion_id, keyword_text, match_type, status, quality_score, creative_quality_score, post_click_quality_score, search_predicted_ctr, effective_cpc_bid, final_urls, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (account_id, criterion_id) DO UPDATE SET
         campaign_id=EXCLUDED.campaign_id, ad_group_id=EXCLUDED.ad_group_id, keyword_text=EXCLUDED.keyword_text,
         match_type=EXCLUDED.match_type, status=EXCLUDED.status, quality_score=EXCLUDED.quality_score,
         creative_quality_score=EXCLUDED.creative_quality_score, post_click_quality_score=EXCLUDED.post_click_quality_score,
         search_predicted_ctr=EXCLUDED.search_predicted_ctr, effective_cpc_bid=EXCLUDED.effective_cpc_bid,
         final_urls=EXCLUDED.final_urls, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.adGroupId, d.criterionId, d.keyword, d.matchType, d.status, d.qualityScore, d.creativeQualityScore, d.postClickQualityScore, d.searchPredictedCtr, d.effectiveCpcBid, JSON.stringify(d.finalUrls)]),
      'Keywords',
    );

    const snapshots = await this.batchUpsert(
      `INSERT INTO keyword_snapshots (account_id, criterion_id, snapshot_date, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion, search_impression_share, search_rank_lost_imp_share, top_impression_pct, absolute_top_impression_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (account_id, criterion_id, snapshot_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, conversions_value=EXCLUDED.conversions_value, cost=EXCLUDED.cost,
         clicks=EXCLUDED.clicks, impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr,
         average_cpc=EXCLUDED.average_cpc, cost_per_conversion=EXCLUDED.cost_per_conversion,
         search_impression_share=EXCLUDED.search_impression_share, search_rank_lost_imp_share=EXCLUDED.search_rank_lost_imp_share,
         top_impression_pct=EXCLUDED.top_impression_pct, absolute_top_impression_pct=EXCLUDED.absolute_top_impression_pct, fetched_at=NOW()`,
      data.map(d => [d.accountId, d.criterionId, today, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion, d.metrics.searchImpressionShare, d.metrics.searchRankLostImpressionShare, d.metrics.topImpressionPercentage, d.metrics.absoluteTopImpressionPercentage]),
      'KeywordSnapshots',
    );

    return { keywords, snapshots };
  }

  // ────────────────────────────────────────────────────
  // Search Terms
  // ────────────────────────────────────────────────────

  async persistSearchTerms(days = 7): Promise<number> {
    const data = await googleAdsService.fetchSearchTerms(days);
    return this.batchUpsert(
      `INSERT INTO search_terms (account_id, campaign_id, ad_group_id, search_term, match_type, status, term_date, conversions, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (account_id, ad_group_id, search_term, term_date) DO UPDATE SET
         conversions=EXCLUDED.conversions, cost=EXCLUDED.cost, clicks=EXCLUDED.clicks,
         impressions=EXCLUDED.impressions, ctr=EXCLUDED.ctr, average_cpc=EXCLUDED.average_cpc,
         cost_per_conversion=EXCLUDED.cost_per_conversion, fetched_at=NOW()`,
      data.map(d => [d.accountId, d.campaignId, d.adGroupId, d.searchTerm, d.matchType, d.status, d.date, d.metrics.conversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'SearchTerms',
    );
  }

  // ────────────────────────────────────────────────────
  // Geographic (delete+insert per period)
  // ────────────────────────────────────────────────────

  async persistGeographic(days = 30): Promise<number> {
    const data = await googleAdsService.fetchGeographicPerformance(days);
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    await query(`DELETE FROM geographic_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    return this.batchUpsert(
      `INSERT INTO geographic_performance (account_id, campaign_id, country_criterion_id, location_type, geo_target_constant, period_start, period_end, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      data.map(d => [d.accountId, d.campaignId, d.countryCriterionId, d.locationType, d.geoTargetConstant, startDate, endDate, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'Geographic',
    );
  }

  // ────────────────────────────────────────────────────
  // User Location
  // ────────────────────────────────────────────────────

  async persistUserLocation(days = 30): Promise<number> {
    const data = await googleAdsService.fetchUserLocationPerformance(days);
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    await query(`DELETE FROM user_location_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    return this.batchUpsert(
      `INSERT INTO user_location_performance (account_id, campaign_id, country_criterion_id, targeting_location, period_start, period_end, conversions, cost, clicks, impressions, ctr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      data.map(d => [d.accountId, d.campaignId, d.countryCriterionId, d.targetingLocation, startDate, endDate, d.metrics.conversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr]),
      'UserLocation',
    );
  }

  // ────────────────────────────────────────────────────
  // Demographics
  // ────────────────────────────────────────────────────

  async persistDemographics(days = 30): Promise<{ age: number; gender: number }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const ageData = await googleAdsService.fetchAgeRangePerformance(days);
    await query(`DELETE FROM age_range_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const age = await this.batchUpsert(
      `INSERT INTO age_range_performance (account_id, campaign_id, ad_group_id, age_range, period_start, period_end, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      ageData.map(d => [d.accountId, d.campaignId, d.adGroupId, d.ageRange, startDate, endDate, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'AgeRange',
    );

    const genderData = await googleAdsService.fetchGenderPerformance(days);
    await query(`DELETE FROM gender_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const gender = await this.batchUpsert(
      `INSERT INTO gender_performance (account_id, campaign_id, ad_group_id, gender, period_start, period_end, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      genderData.map(d => [d.accountId, d.campaignId, d.adGroupId, d.gender, startDate, endDate, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'Gender',
    );

    return { age, gender };
  }

  // ────────────────────────────────────────────────────
  // Device, Schedule, Network
  // ────────────────────────────────────────────────────

  async persistDeviceScheduleNetwork(days = 30): Promise<{ device: number; schedule: number; network: number }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const deviceData = await googleAdsService.fetchDevicePerformance(days);
    await query(`DELETE FROM device_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const device = await this.batchUpsert(
      `INSERT INTO device_performance (account_id, campaign_id, device, period_start, period_end, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion, video_views, interactions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      deviceData.map(d => [d.accountId, d.campaignId, d.device, startDate, endDate, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion, d.metrics.videoViews, d.metrics.interactions]),
      'Device',
    );

    const scheduleData = await googleAdsService.fetchAdSchedulePerformance(days);
    await query(`DELETE FROM ad_schedule_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const schedule = await this.batchUpsert(
      `INSERT INTO ad_schedule_performance (account_id, campaign_id, day_of_week, hour, period_start, period_end, conversions, cost, clicks, impressions, ctr, average_cpc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      scheduleData.map(d => [d.accountId, d.campaignId, d.dayOfWeek, d.hour, startDate, endDate, d.metrics.conversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc]),
      'Schedule',
    );

    const networkData = await googleAdsService.fetchNetworkPerformance(days);
    await query(`DELETE FROM network_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const network = await this.batchUpsert(
      `INSERT INTO network_performance (account_id, campaign_id, network_type, period_start, period_end, conversions, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      networkData.map(d => [d.accountId, d.campaignId, d.networkType, startDate, endDate, d.metrics.conversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'Network',
    );

    return { device, schedule, network };
  }

  // ────────────────────────────────────────────────────
  // Landing Pages & Audiences
  // ────────────────────────────────────────────────────

  async persistLandingPagesAndAudiences(days = 30): Promise<{ landingPages: number; audiences: number }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const lpData = await googleAdsService.fetchLandingPagePerformance(days);
    await query(`DELETE FROM landing_page_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const landingPages = await this.batchUpsert(
      `INSERT INTO landing_page_performance (account_id, campaign_id, ad_group_id, landing_page_url, period_start, period_end, conversions, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion, mobile_friendly_clicks_pct, speed_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      lpData.map(d => [d.accountId, d.campaignId, d.adGroupId, d.landingPageUrl, startDate, endDate, d.metrics.conversions, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion, d.metrics.mobileFriendlyClicksPercentage, d.metrics.speedScore]),
      'LandingPages',
    );

    const audData = await googleAdsService.fetchAudiencePerformance(days);
    await query(`DELETE FROM audience_performance WHERE period_start = $1 AND period_end = $2`, [startDate, endDate]);
    const audiences = await this.batchUpsert(
      `INSERT INTO audience_performance (account_id, campaign_id, resource_name, period_start, period_end, conversions, conversions_value, cost, clicks, impressions, ctr, average_cpc, cost_per_conversion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      audData.map(d => [d.accountId, d.campaignId, d.resourceName, startDate, endDate, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions, d.metrics.ctr, d.metrics.averageCpc, d.metrics.costPerConversion]),
      'Audiences',
    );

    return { landingPages, audiences };
  }

  // ────────────────────────────────────────────────────
  // Conversion Actions
  // ────────────────────────────────────────────────────

  async persistConversionActions(): Promise<number> {
    const data = await googleAdsService.fetchConversionActions();
    return this.batchUpsert(
      `INSERT INTO conversion_actions (account_id, conversion_action_id, name, type, category, status, counting_type, attribution_model, default_value, default_currency, click_through_lookback_days, view_through_lookback_days, include_in_conversions_metric, phone_call_duration_seconds, app_id, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (account_id, conversion_action_id) DO UPDATE SET
         name=EXCLUDED.name, type=EXCLUDED.type, category=EXCLUDED.category, status=EXCLUDED.status,
         counting_type=EXCLUDED.counting_type, attribution_model=EXCLUDED.attribution_model,
         default_value=EXCLUDED.default_value, default_currency=EXCLUDED.default_currency,
         click_through_lookback_days=EXCLUDED.click_through_lookback_days,
         view_through_lookback_days=EXCLUDED.view_through_lookback_days,
         include_in_conversions_metric=EXCLUDED.include_in_conversions_metric,
         phone_call_duration_seconds=EXCLUDED.phone_call_duration_seconds,
         app_id=EXCLUDED.app_id, last_synced_at=NOW()`,
      data.map(d => [d.accountId, d.conversionActionId, d.name, d.type, d.category, d.status, d.countingType, d.attributionModel, d.defaultValue, d.defaultCurrency, d.clickThroughLookbackDays, d.viewThroughLookbackDays, d.includeInConversionsMetric, d.phoneCallDurationSeconds, d.appId]),
      'ConversionActions',
    );
  }

  // ────────────────────────────────────────────────────
  // Billing
  // ────────────────────────────────────────────────────

  async persistBilling(): Promise<{ billing: number; invoices: number; charges: number; recharges: number }> {
    const billingData = await googleAdsService.fetchBillingAccounts();
    const billing = await this.batchUpsert(
      `INSERT INTO billing_accounts (account_id, account_name, country_code, billing_id, status, payments_account_id, payments_account_name, payments_profile_id, payments_profile_name, secondary_payments_profile, currency_code, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (account_id, billing_id) DO UPDATE SET
         account_name=EXCLUDED.account_name, country_code=EXCLUDED.country_code, status=EXCLUDED.status,
         payments_account_id=EXCLUDED.payments_account_id, payments_account_name=EXCLUDED.payments_account_name,
         payments_profile_id=EXCLUDED.payments_profile_id, payments_profile_name=EXCLUDED.payments_profile_name,
         secondary_payments_profile=EXCLUDED.secondary_payments_profile, currency_code=EXCLUDED.currency_code, last_synced_at=NOW()`,
      billingData.map(d => [d.accountId, d.accountName, d.countryCode, d.billingId, d.status, d.paymentsAccountId, d.paymentsAccountName, d.paymentsProfileId, d.paymentsProfileName, d.secondaryPaymentsProfileId, d.currencyCode]),
      'Billing',
    );

    const invoiceData = await googleAdsService.fetchInvoices();
    const invoices = await this.batchUpsert(
      `INSERT INTO invoices (account_id, invoice_id, type, issue_date, due_date, subtotal, tax, total, currency_code, pdf_url, payments_account_id, payments_profile_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (account_id, invoice_id) DO UPDATE SET
         type=EXCLUDED.type, issue_date=EXCLUDED.issue_date, due_date=EXCLUDED.due_date,
         subtotal=EXCLUDED.subtotal, tax=EXCLUDED.tax, total=EXCLUDED.total,
         currency_code=EXCLUDED.currency_code, pdf_url=EXCLUDED.pdf_url, fetched_at=NOW()`,
      invoiceData.map(d => [d.accountId, d.invoiceId, d.type, d.issueDate, d.dueDate, d.subtotal, d.tax, d.total, d.currencyCode, d.pdfUrl, d.paymentsAccountId, d.paymentsProfileId]),
      'Invoices',
    );

    const chargeData = await googleAdsService.fetchAccountCharges();
    const charges = await this.batchUpsert(
      `INSERT INTO account_charges (account_id, account_name, budget_id, budget_name, budget_status, proposed_start_date, approved_start_date, proposed_end_date, approved_end_date, purchase_order_number, total_adjustments, amount_served, approved_spending_limit, proposed_spending_limit, billing_setup, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (account_id, budget_id) DO UPDATE SET
         account_name=EXCLUDED.account_name, budget_name=EXCLUDED.budget_name, budget_status=EXCLUDED.budget_status,
         proposed_start_date=EXCLUDED.proposed_start_date, approved_start_date=EXCLUDED.approved_start_date,
         proposed_end_date=EXCLUDED.proposed_end_date, approved_end_date=EXCLUDED.approved_end_date,
         purchase_order_number=EXCLUDED.purchase_order_number, total_adjustments=EXCLUDED.total_adjustments,
         amount_served=EXCLUDED.amount_served, approved_spending_limit=EXCLUDED.approved_spending_limit,
         proposed_spending_limit=EXCLUDED.proposed_spending_limit, billing_setup=EXCLUDED.billing_setup, last_synced_at=NOW()`,
      chargeData.map(d => [d.accountId, d.accountName, d.budgetId, d.budgetName, d.budgetStatus, d.proposedStartDate, d.approvedStartDate, d.proposedEndDate, d.approvedEndDate, d.purchaseOrderNumber, d.totalAdjustments, d.amountServed, d.approvedSpendingLimit, d.proposedSpendingLimit, d.billingSetup]),
      'Charges',
    );

    const rechargeData = await googleAdsService.fetchRecharges();
    const recharges = await this.batchUpsert(
      `INSERT INTO recharges (account_id, account_name, country_code, proposal_id, proposal_type, status, recharge_amount, new_spending_limit, proposed_spending_limit, approved_spending_limit, proposed_start_date, approved_start_date, proposed_end_date, approved_end_date, creation_date, approval_date, account_budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (account_id, proposal_id) DO UPDATE SET
         account_name=EXCLUDED.account_name, country_code=EXCLUDED.country_code, proposal_type=EXCLUDED.proposal_type,
         status=EXCLUDED.status, recharge_amount=EXCLUDED.recharge_amount, new_spending_limit=EXCLUDED.new_spending_limit,
         proposed_spending_limit=EXCLUDED.proposed_spending_limit, approved_spending_limit=EXCLUDED.approved_spending_limit,
         proposed_start_date=EXCLUDED.proposed_start_date, approved_start_date=EXCLUDED.approved_start_date,
         proposed_end_date=EXCLUDED.proposed_end_date, approved_end_date=EXCLUDED.approved_end_date,
         creation_date=EXCLUDED.creation_date, approval_date=EXCLUDED.approval_date, account_budget=EXCLUDED.account_budget, fetched_at=NOW()`,
      rechargeData.map(d => [d.accountId, d.accountName, d.countryCode, d.proposalId, d.proposalType, d.status, d.rechargeAmount, d.newSpendingLimit, d.proposedSpendingLimit, d.approvedSpendingLimit, d.proposedStartDate, d.approvedStartDate, d.proposedEndDate, d.approvedEndDate, d.creationDate, d.approvalDate, d.accountBudget]),
      'Recharges',
    );

    return { billing, invoices, charges, recharges };
  }

  // ────────────────────────────────────────────────────
  // Strategies, Recommendations, Labels
  // ────────────────────────────────────────────────────

  async persistStrategiesRecommendationsLabels(): Promise<{ strategies: number; recommendations: number; labels: number }> {
    const stratData = await googleAdsService.fetchBiddingStrategies();
    const strategies = await this.batchUpsert(
      `INSERT INTO bidding_strategies (account_id, strategy_id, name, type, status, campaign_count, non_removed_campaign_count, effective_currency_code, conversions, conversions_value, cost, clicks, impressions, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (account_id, strategy_id) DO UPDATE SET
         name=EXCLUDED.name, type=EXCLUDED.type, status=EXCLUDED.status,
         campaign_count=EXCLUDED.campaign_count, non_removed_campaign_count=EXCLUDED.non_removed_campaign_count,
         effective_currency_code=EXCLUDED.effective_currency_code, conversions=EXCLUDED.conversions,
         conversions_value=EXCLUDED.conversions_value, cost=EXCLUDED.cost, clicks=EXCLUDED.clicks,
         impressions=EXCLUDED.impressions, last_synced_at=NOW()`,
      stratData.map(d => [d.accountId, d.strategyId, d.name, d.type, d.status, d.campaignCount, d.nonRemovedCampaignCount, d.effectiveCurrencyCode, d.metrics.conversions, d.metrics.conversionsValue, d.metrics.cost, d.metrics.clicks, d.metrics.impressions]),
      'BiddingStrategies',
    );

    // Recommendations: delete and re-insert (no stable unique key)
    await query(`DELETE FROM recommendations`);
    const recData = await googleAdsService.fetchRecommendations();
    const recommendations = await this.batchUpsert(
      `INSERT INTO recommendations (account_id, campaign_id, type, base_impressions, base_clicks, base_cost, base_conversions, potential_impressions, potential_clicks, potential_cost, potential_conversions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      recData.map(d => [d.accountId, d.campaignId, d.type, d.impact.baseMetrics.impressions, d.impact.baseMetrics.clicks, d.impact.baseMetrics.cost, d.impact.baseMetrics.conversions, d.impact.potentialMetrics.impressions, d.impact.potentialMetrics.clicks, d.impact.potentialMetrics.cost, d.impact.potentialMetrics.conversions]),
      'Recommendations',
    );

    const labelData = await googleAdsService.fetchLabels();
    const labels = await this.batchUpsert(
      `INSERT INTO labels (account_id, label_id, name, status, background_color, description, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (account_id, label_id) DO UPDATE SET
         name=EXCLUDED.name, status=EXCLUDED.status, background_color=EXCLUDED.background_color,
         description=EXCLUDED.description, last_synced_at=NOW()`,
      labelData.map(d => [d.accountId, d.labelId, d.name, d.status, d.backgroundColor, d.description]),
      'Labels',
    );

    return { strategies, recommendations, labels };
  }

  // ────────────────────────────────────────────────────
  // Assets, Shared Sets, Campaign Targeting
  // ────────────────────────────────────────────────────

  async persistAssetsAndTargeting(): Promise<{ assets: number; sharedSets: number; targeting: number }> {
    const assetData = await googleAdsService.fetchAssets();
    const assets = await this.batchUpsert(
      `INSERT INTO assets (account_id, asset_id, name, type, source, final_urls, final_mobile_urls, sitelink_text, sitelink_desc1, sitelink_desc2, callout_text, snippet_header, snippet_values, call_phone_number, call_country_code, image_url, image_file_size, youtube_video_id, youtube_video_title, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
       ON CONFLICT (account_id, asset_id) DO UPDATE SET
         name=EXCLUDED.name, type=EXCLUDED.type, source=EXCLUDED.source,
         final_urls=EXCLUDED.final_urls, final_mobile_urls=EXCLUDED.final_mobile_urls,
         sitelink_text=EXCLUDED.sitelink_text, sitelink_desc1=EXCLUDED.sitelink_desc1, sitelink_desc2=EXCLUDED.sitelink_desc2,
         callout_text=EXCLUDED.callout_text, snippet_header=EXCLUDED.snippet_header, snippet_values=EXCLUDED.snippet_values,
         call_phone_number=EXCLUDED.call_phone_number, call_country_code=EXCLUDED.call_country_code,
         image_url=EXCLUDED.image_url, image_file_size=EXCLUDED.image_file_size,
         youtube_video_id=EXCLUDED.youtube_video_id, youtube_video_title=EXCLUDED.youtube_video_title, last_synced_at=NOW()`,
      assetData.map(d => [d.accountId, d.assetId, d.name, d.type, d.source, JSON.stringify(d.finalUrls), JSON.stringify(d.finalMobileUrls), d.sitelink?.linkText || '', d.sitelink?.description1 || '', d.sitelink?.description2 || '', d.callout?.calloutText || '', d.structuredSnippet?.header || '', JSON.stringify(d.structuredSnippet?.values || []), d.callAsset?.phoneNumber || '', d.callAsset?.countryCode || '', d.imageAsset?.url || '', d.imageAsset?.fileSize || 0, d.youtubeVideoAsset?.videoId || '', d.youtubeVideoAsset?.videoTitle || '']),
      'Assets',
    );

    const ssData = await googleAdsService.fetchSharedSets();
    const sharedSets = await this.batchUpsert(
      `INSERT INTO shared_sets (account_id, shared_set_id, name, type, status, member_count, reference_count, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (account_id, shared_set_id) DO UPDATE SET
         name=EXCLUDED.name, type=EXCLUDED.type, status=EXCLUDED.status,
         member_count=EXCLUDED.member_count, reference_count=EXCLUDED.reference_count, last_synced_at=NOW()`,
      ssData.map(d => [d.accountId, d.sharedSetId, d.name, d.type, d.status, d.memberCount, d.referenceCount]),
      'SharedSets',
    );

    const targetData = await googleAdsService.fetchCampaignTargeting();
    const targeting = await this.batchUpsert(
      `INSERT INTO campaign_targeting (account_id, campaign_id, criterion_id, type, status, bid_modifier, is_negative, location_constant, language_constant, keyword_text, keyword_match_type, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (account_id, campaign_id, criterion_id) DO UPDATE SET
         type=EXCLUDED.type, status=EXCLUDED.status, bid_modifier=EXCLUDED.bid_modifier,
         is_negative=EXCLUDED.is_negative, location_constant=EXCLUDED.location_constant,
         language_constant=EXCLUDED.language_constant, keyword_text=EXCLUDED.keyword_text,
         keyword_match_type=EXCLUDED.keyword_match_type, last_synced_at=NOW()`,
      targetData.map(d => [d.accountId, d.campaignId, d.criterionId, d.type, d.status, d.bidModifier, d.isNegative, d.location, d.language, d.keyword?.text || '', d.keyword?.matchType || '']),
      'CampaignTargeting',
    );

    return { assets, sharedSets, targeting };
  }

  // ────────────────────────────────────────────────────
  // Change History
  // ────────────────────────────────────────────────────

  async persistChangeHistory(days = 7): Promise<number> {
    const data = await googleAdsService.fetchChangeHistory(days);
    // Delete previous entries for this range and re-insert
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    await query(`DELETE FROM change_history WHERE change_date_time >= $1`, [startDate]);

    return this.batchUpsert(
      `INSERT INTO change_history (account_id, campaign_id, campaign_name, change_date_time, resource_type, resource_name, client_type, user_email, operation, changed_fields, old_resource, new_resource)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      data.map(d => [d.accountId, d.campaignId, d.campaignName, d.changeDateTime, d.resourceType, d.resourceName, d.clientType, d.userEmail, d.operation, JSON.stringify(d.changedFields), d.oldResource ? JSON.stringify(d.oldResource) : null, d.newResource ? JSON.stringify(d.newResource) : null]),
      'ChangeHistory',
    );
  }

  // ════════════════════════════════════════════════════
  // FULL SYNC: Persist everything
  // ════════════════════════════════════════════════════

  async syncAll(): Promise<Record<string, any>> {
    logger.info('Starting full Google Ads sync & persist...');
    const results: Record<string, any> = {};

    results.accountInfo = await this.persistAccountInfo();
    results.campaigns = await this.persistCampaigns();
    results.adGroups = await this.persistAdGroups();
    results.ads = await this.persistAds();
    results.keywords = await this.persistKeywords();
    results.searchTerms = await this.persistSearchTerms();
    results.geographic = await this.persistGeographic();
    results.userLocation = await this.persistUserLocation();
    results.demographics = await this.persistDemographics();
    results.deviceScheduleNetwork = await this.persistDeviceScheduleNetwork();
    results.landingPagesAudiences = await this.persistLandingPagesAndAudiences();
    results.conversionActions = await this.persistConversionActions();
    results.billing = await this.persistBilling();
    results.strategiesRecsLabels = await this.persistStrategiesRecommendationsLabels();
    results.assetsTargeting = await this.persistAssetsAndTargeting();
    results.changeHistory = await this.persistChangeHistory();

    logger.info('Full Google Ads sync & persist completed');
    return results;
  }
}

export const persistenceService = new GoogleAdsPersistenceService();
