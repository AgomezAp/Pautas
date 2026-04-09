import { env } from '../config/environment';
import { query } from '../config/database';
import { logger } from '../utils/logger.util';

// Map Google Ads status codes to strings
const STATUS_MAP: Record<number, string> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'ENABLED',
  3: 'PAUSED',
  4: 'REMOVED',
};

// Map Google Ads account name patterns to country codes
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

export class GoogleAdsSyncService {
  private client: any = null;
  private cachedClientAccounts: { id: string; name: string }[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private async getApi(): Promise<any> {
    if (this.client) return this.client;

    if (!env.googleAds.developerToken || !env.googleAds.clientId) {
      logger.warn('Google Ads API not configured. Skipping sync.');
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
    const opts: any = {
      customer_id: customerId,
      refresh_token: env.googleAds.refreshToken,
    };
    if (loginCustomerId) {
      opts.login_customer_id = loginCustomerId;
    }
    return api.Customer(opts);
  }

  // Discover all client accounts under the MCC with caching
  private async getClientAccounts(): Promise<{ id: string; name: string }[]> {
    if (this.cachedClientAccounts && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedClientAccounts;
    }

    const api = await this.getApi();
    if (!api) return [];

    const managerId = env.googleAds.managerAccountId;

    try {
      const manager = this.getCustomer(api, managerId);
      const results = await manager.query(
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'"
      );
      const accounts = results.map((r: any) => ({
        id: String(r.customer_client.id),
        name: r.customer_client.descriptive_name || '',
      }));
      this.cachedClientAccounts = accounts;
      this.cacheTimestamp = Date.now();
      logger.info(`Found ${accounts.length} client accounts under MCC`);
      return accounts;
    } catch (error: any) {
      logger.error(`Could not query MCC for clients: ${error.errors?.[0]?.message || error.message}`);
      return [];
    }
  }

  // Detect country code from account/campaign name
  private detectCountryCode(name: string): string | null {
    const upper = name.toUpperCase();
    for (const [pattern, code] of Object.entries(COUNTRY_PATTERNS)) {
      if (upper.includes(pattern)) return code;
    }
    return null;
  }

  // Run async tasks with limited concurrency (stops on rate limit)
  private rateLimitHit = false;
  private async runWithConcurrency<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    limit: number,
  ): Promise<void> {
    this.rateLimitHit = false;
    let index = 0;
    const run = async () => {
      while (index < items.length && !this.rateLimitHit) {
        const i = index++;
        await fn(items[i]);
      }
    };
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
    await Promise.all(workers);
  }

  // ========================================================
  // 1. Sync campaigns
  // ========================================================
  async syncAllCampaigns(activeOnly = false): Promise<void> {
    const api = await this.getApi();
    if (!api) {
      logger.warn('Google Ads sync skipped: client not configured');
      return;
    }

    logger.info('Starting Google Ads sync — discovering accounts and campaigns...');

    try {
      let clientAccounts = await this.getClientAccounts();
      if (clientAccounts.length === 0) {
        logger.warn('No client accounts found');
        return;
      }

      // Skip PAUSADA accounts during hourly syncs to reduce API calls
      if (activeOnly) {
        const before = clientAccounts.length;
        clientAccounts = clientAccounts.filter((a: any) => !a.name.toUpperCase().startsWith('PAUSADA'));
        logger.info('Active-only sync: ' + clientAccounts.length + ' accounts (' + (before - clientAccounts.length) + ' PAUSADA skipped)');
      }

      const today = new Date().toISOString().split('T')[0];
      const managerId = env.googleAds.managerAccountId;

      // Load country map: code -> id
      const countriesResult = await query(`SELECT id, code FROM countries WHERE is_active = TRUE`);
      const countryMap = new Map<string, number>(countriesResult.rows.map((c: any) => [c.code, c.id]));
      const defaultCountryId = countriesResult.rows[0]?.id || 1;

      // Build map of existing local campaigns
      const existingCampaigns = await query(
        `SELECT id, google_ads_campaign_id FROM campaigns WHERE google_ads_campaign_id IS NOT NULL`
      );
      const campaignMap = new Map(existingCampaigns.rows.map((c: any) => [String(c.google_ads_campaign_id), c.id]));

      let synced = 0;
      let imported = 0;
      let errors = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);

        try {
          // Step 1: Fetch all campaigns (no date filter)
          const campaignList = await customer.query(`
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign_budget.amount_micros
            FROM campaign
            WHERE campaign.status != 'REMOVED'
          `);

          if (campaignList.length === 0) return;

          // Step 2: Fetch today's metrics
          const metricsMap = new Map<string, any>();
          try {
            const metricsResults = await customer.query(`
              SELECT
                campaign.id,
                metrics.conversions,
                metrics.cost_micros,
                metrics.clicks,
                metrics.impressions,
                metrics.ctr
              FROM campaign
              WHERE segments.date = '${today}'
            `);
            for (const row of metricsResults) {
              metricsMap.set(String(row.campaign.id), row.metrics);
            }
          } catch (metricsError: any) {
            // Metrics may not exist for today — not critical
          }

          // Detect country from account name
          const countryCode = this.detectCountryCode(account.name);
          const countryId = countryCode ? (countryMap.get(countryCode) || defaultCountryId) : defaultCountryId;

          for (const row of campaignList) {
            const adsCampaignId = String(row.campaign.id);
            let localCampaignId = campaignMap.get(adsCampaignId);

            const budgetMicros = row.campaign_budget?.amount_micros || 0;
            const dailyBudget = budgetMicros / 1_000_000;
            const campaignName = row.campaign?.name || `Campaign ${adsCampaignId}`;
            const statusCode = row.campaign?.status;
            const statusStr = STATUS_MAP[statusCode] || String(statusCode);
            const todayMetrics = metricsMap.get(adsCampaignId);
            const costMicros = todayMetrics?.cost_micros || 0;

            // Also try to detect country from campaign name (more specific)
            const campaignCountryCode = this.detectCountryCode(campaignName);
            const finalCountryId = campaignCountryCode
              ? (countryMap.get(campaignCountryCode) || countryId)
              : countryId;

            if (!localCampaignId) {
              const insertResult = await query(
                `INSERT INTO campaigns (name, google_ads_campaign_id, country_id, campaign_url, ads_status, daily_budget, customer_account_id, customer_account_name, is_active, last_synced_at, created_at, updated_at)
                 VALUES ($1, $2, $3, '', $4, $5, $6, $7, TRUE, NOW(), NOW(), NOW())
                 RETURNING id`,
                [
                  campaignName,
                  adsCampaignId,
                  finalCountryId,
                  statusStr,
                  dailyBudget,
                  account.id,
                  account.name,
                ]
              );
              localCampaignId = insertResult.rows[0].id;
              campaignMap.set(adsCampaignId, localCampaignId);
              imported++;
            } else {
              await query(
                `UPDATE campaigns SET
                  name = $1,
                  ads_status = $2,
                  daily_budget = $3,
                  country_id = $4,
                  customer_account_id = $5,
                  customer_account_name = $6,
                  last_synced_at = NOW(),
                  updated_at = NOW()
                WHERE id = $7`,
                [
                  campaignName,
                  statusStr,
                  dailyBudget,
                  finalCountryId,
                  account.id,
                  account.name,
                  localCampaignId,
                ]
              );
            }

            if (todayMetrics) {
              await query(
                `INSERT INTO google_ads_snapshots
                  (campaign_id, snapshot_date, conversions, status, remaining_budget, cost, clicks, impressions, ctr, daily_budget, fetched_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                 ON CONFLICT (campaign_id, snapshot_date)
                 DO UPDATE SET
                  conversions = EXCLUDED.conversions,
                  status = EXCLUDED.status,
                  remaining_budget = EXCLUDED.remaining_budget,
                  cost = EXCLUDED.cost,
                  clicks = EXCLUDED.clicks,
                  impressions = EXCLUDED.impressions,
                  ctr = EXCLUDED.ctr,
                  daily_budget = EXCLUDED.daily_budget,
                  fetched_at = NOW()`,
                [
                  localCampaignId,
                  today,
                  todayMetrics?.conversions || 0,
                  statusStr,
                  (budgetMicros - costMicros) / 1_000_000,
                  costMicros / 1_000_000,
                  todayMetrics?.clicks || 0,
                  todayMetrics?.impressions || 0,
                  todayMetrics?.ctr || 0,
                  dailyBudget,
                ]
              );
            }
            synced++;
          }
        } catch (accountError: any) {
          const errorMsg = accountError.errors?.[0]?.message || accountError.message || '';
          if (errorMsg.includes('Too many requests') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
            this.rateLimitHit = true;
            logger.error('Google Ads API rate limit reached — stopping sync to avoid further errors');
          } else {
            errors++;
            logger.warn('Error syncing account ' + account.id + ' (' + account.name + '): ' + errorMsg);
          }
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Google Ads sync complete: ${synced} campaigns updated, ${imported} imported, ${errors} account errors`);
    } catch (error: any) {
      logger.error(`Google Ads sync failed: ${error.message}`);
    }
  }

  // ========================================================
  // 2. Sync billing accounts (with payment profile details)
  // ========================================================
  async syncBillingAccounts(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads billing accounts...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing setup with payment profile details
          const results = await customer.query(`
            SELECT
              billing_setup.id,
              billing_setup.status,
              billing_setup.payments_account_info.payments_account_id,
              billing_setup.payments_account_info.payments_account_name,
              billing_setup.payments_account_info.payments_profile_id,
              billing_setup.payments_account_info.payments_profile_name
            FROM billing_setup
          `);

          // Get account currency
          let currencyCode = 'USD';
          try {
            const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
            if (custInfo.length > 0) {
              currencyCode = custInfo[0].customer.currency_code || 'USD';
            }
          } catch (_) { /* ignore */ }

          for (const row of results) {
            const paymentsAccountId = row.billing_setup?.payments_account_info?.payments_account_id;
            if (!paymentsAccountId) continue;

            const billingStatus = STATUS_MAP[row.billing_setup?.status] || String(row.billing_setup?.status || 'UNKNOWN');

            await query(
              `INSERT INTO google_ads_billing_accounts
                (billing_id, name, status, currency_code, payments_profile_name, customer_account_id, customer_account_name, last_synced_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               ON CONFLICT (billing_id) DO UPDATE SET
                name = EXCLUDED.name,
                status = EXCLUDED.status,
                currency_code = EXCLUDED.currency_code,
                payments_profile_name = EXCLUDED.payments_profile_name,
                customer_account_id = EXCLUDED.customer_account_id,
                customer_account_name = EXCLUDED.customer_account_name,
                last_synced_at = NOW()`,
              [
                paymentsAccountId,
                row.billing_setup?.payments_account_info?.payments_account_name || 'N/A',
                billingStatus,
                currencyCode,
                row.billing_setup?.payments_account_info?.payments_profile_name || null,
                account.id,
                account.name,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // Billing setup may not exist for all accounts
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Billing accounts synced: ${synced}`);
    } catch (error: any) {
      logger.error(`Billing accounts sync failed: ${error.message}`);
    }
  }

  // ========================================================
  // 3. Sync account charges (budget transactions for each account)
  // ========================================================
  async syncAccountCharges(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads account charges...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing setup info for this account
          const billingSetup = await customer.query(`
            SELECT
              billing_setup.payments_account_info.payments_account_id,
              billing_setup.payments_account_info.payments_profile_name
            FROM billing_setup
          `);

          let currencyCode = 'USD';
          try {
            const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
            if (custInfo.length > 0) currencyCode = custInfo[0].customer.currency_code || 'USD';
          } catch (_) { /* ignore */ }

          const paymentsAccountId = billingSetup[0]?.billing_setup?.payments_account_info?.payments_account_id || null;
          const paymentsProfileName = billingSetup[0]?.billing_setup?.payments_account_info?.payments_profile_name || null;

          // Get account budget info
          const budgets = await customer.query(`
            SELECT
              account_budget.id,
              account_budget.name,
              account_budget.status,
              account_budget.proposed_start_date_time,
              account_budget.approved_start_date_time,
              account_budget.proposed_end_date_time,
              account_budget.approved_end_date_time,
              account_budget.purchase_order_number,
              account_budget.total_adjustments_micros,
              account_budget.amount_served_micros
            FROM account_budget
          `);

          // Lookup billing account id in our DB
          let billingAccountDbId: number | null = null;
          if (paymentsAccountId) {
            const baResult = await query(`SELECT id FROM google_ads_billing_accounts WHERE billing_id = $1`, [paymentsAccountId]);
            billingAccountDbId = baResult.rows[0]?.id || null;
          }

          for (const row of budgets) {
            const budgetStatus = STATUS_MAP[row.account_budget?.status] || String(row.account_budget?.status || 'UNKNOWN');

            await query(
              `INSERT INTO google_ads_account_charges
                (customer_account_id, customer_account_name, billing_account_id, payments_account_id,
                 payments_profile_name, currency_code, budget_name, budget_status,
                 budget_start_date, budget_end_date, purchase_order_number,
                 total_adjustments_micros, amount_served_micros, fetched_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
               ON CONFLICT (customer_account_id, payments_account_id) DO UPDATE SET
                customer_account_name = EXCLUDED.customer_account_name,
                billing_account_id = EXCLUDED.billing_account_id,
                payments_profile_name = EXCLUDED.payments_profile_name,
                currency_code = EXCLUDED.currency_code,
                budget_name = EXCLUDED.budget_name,
                budget_status = EXCLUDED.budget_status,
                budget_start_date = EXCLUDED.budget_start_date,
                budget_end_date = EXCLUDED.budget_end_date,
                purchase_order_number = EXCLUDED.purchase_order_number,
                total_adjustments_micros = EXCLUDED.total_adjustments_micros,
                amount_served_micros = EXCLUDED.amount_served_micros,
                fetched_at = NOW()`,
              [
                account.id,
                account.name,
                billingAccountDbId,
                paymentsAccountId,
                paymentsProfileName,
                currencyCode,
                row.account_budget?.name || null,
                budgetStatus,
                row.account_budget?.approved_start_date_time || row.account_budget?.proposed_start_date_time || null,
                row.account_budget?.approved_end_date_time || row.account_budget?.proposed_end_date_time || null,
                row.account_budget?.purchase_order_number || null,
                row.account_budget?.total_adjustments_micros || 0,
                row.account_budget?.amount_served_micros || 0,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // account_budget may not be available for all accounts
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Account charges synced: ${synced}`);
    } catch (error: any) {
      logger.error(`Account charges sync failed: ${error.message}`);
    }
  }

  // ========================================================
  // 3. Sync billing history (invoices)
  // ========================================================
  async syncBillingHistory(): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads billing history...');

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          const results = await customer.query(`
            SELECT
              invoice.id,
              invoice.issue_date,
              invoice.due_date,
              invoice.subtotal_amount_micros,
              invoice.tax_amount_micros,
              invoice.total_amount_micros,
              invoice.currency_code,
              invoice.type,
              invoice.pdf_url,
              invoice.payments_account_id
            FROM invoice
            WHERE invoice.issue_date DURING LAST_BUSINESS_YEAR
          `);

          for (const row of results) {
            const billingResult = await query(
              `SELECT id FROM google_ads_billing_accounts WHERE billing_id = $1`,
              [row.invoice?.payments_account_id]
            );
            const billingAccountId = billingResult.rows[0]?.id || null;

            await query(
              `INSERT INTO google_ads_billing_history
                (billing_account_id, invoice_id, issue_date, due_date, subtotal, tax, total, currency_code, status, pdf_url, fetched_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
               ON CONFLICT (invoice_id) DO UPDATE SET
                subtotal = EXCLUDED.subtotal,
                tax = EXCLUDED.tax,
                total = EXCLUDED.total,
                status = EXCLUDED.status,
                pdf_url = EXCLUDED.pdf_url,
                fetched_at = NOW()`,
              [
                billingAccountId,
                row.invoice?.id,
                row.invoice?.issue_date || null,
                row.invoice?.due_date || null,
                (row.invoice?.subtotal_amount_micros || 0) / 1_000_000,
                (row.invoice?.tax_amount_micros || 0) / 1_000_000,
                (row.invoice?.total_amount_micros || 0) / 1_000_000,
                row.invoice?.currency_code || 'USD',
                row.invoice?.type || 'UNKNOWN',
                row.invoice?.pdf_url || null,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          // Invoice access may not be available for all accounts — not critical
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Billing history synced: ${synced} invoices`);
    } catch (error: any) {
      logger.error(`Billing history sync failed: ${error.message}`);
    }
  }

  // ========================================================
  // 4. Sync recharges (account_budget_proposal — individual top-ups)
  // ========================================================
  async syncRecharges(recentOnly = false): Promise<void> {
    const api = await this.getApi();
    if (!api) return;

    logger.info('Syncing Google Ads recharges...' + (recentOnly ? ' [incremental]' : ' [full rebuild]'));

    try {
      const clientAccounts = await this.getClientAccounts();
      const managerId = env.googleAds.managerAccountId;
      let synced = 0;
      let accountsProcessed = 0;
      let accountErrors = 0;

      // Cache billing info per account
      const billingCache = new Map<string, { paymentsAccountId: string | null; paymentsProfileName: string | null; currencyCode: string }>();

      // For incremental mode, load existing proposal IDs to skip them
      const existingProposalIds = new Set<string>();
      if (recentOnly) {
        const existingResult = await query(`SELECT proposal_id FROM google_ads_recharges`);
        for (const row of existingResult.rows) {
          existingProposalIds.add(row.proposal_id);
        }
        logger.info(`Incremental sync: ${existingProposalIds.size} existing proposals in DB`);
      }

      await this.runWithConcurrency(clientAccounts, async (account) => {
        const customer = this.getCustomer(api, account.id, managerId);
        try {
          // Get billing info (cached)
          let paymentsAccountId: string | null = null;
          let paymentsProfileName: string | null = null;
          let currencyCode = 'USD';

          if (billingCache.has(account.id)) {
            const cached = billingCache.get(account.id)!;
            paymentsAccountId = cached.paymentsAccountId;
            paymentsProfileName = cached.paymentsProfileName;
            currencyCode = cached.currencyCode;
          } else {
            try {
              const billingSetup = await customer.query(`
                SELECT billing_setup.payments_account_info.payments_account_id,
                       billing_setup.payments_account_info.payments_profile_name
                FROM billing_setup
              `);
              paymentsAccountId = billingSetup[0]?.billing_setup?.payments_account_info?.payments_account_id || null;
              paymentsProfileName = billingSetup[0]?.billing_setup?.payments_account_info?.payments_profile_name || null;
            } catch (_) {}
            try {
              const custInfo = await customer.query(`SELECT customer.currency_code FROM customer`);
              if (custInfo.length > 0) currencyCode = custInfo[0].customer.currency_code || 'USD';
            } catch (_) {}
            billingCache.set(account.id, { paymentsAccountId, paymentsProfileName, currencyCode });
          }

          // Query ALL proposals from Google Ads API (sorted by creation date)
          const proposals = await customer.query(`
            SELECT
              account_budget_proposal.id,
              account_budget_proposal.proposal_type,
              account_budget_proposal.status,
              account_budget_proposal.proposed_spending_limit_micros,
              account_budget_proposal.approved_spending_limit_micros,
              account_budget_proposal.creation_date_time,
              account_budget_proposal.approval_date_time
            FROM account_budget_proposal
            ORDER BY account_budget_proposal.creation_date_time ASC
          `);

          if (proposals.length === 0) return;
          accountsProcessed++;

          // Sort by creation date to compute spending deltas properly
          const sorted = [...proposals].sort((a: any, b: any) => {
            const da = a.account_budget_proposal?.creation_date_time || '';
            const db = b.account_budget_proposal?.creation_date_time || '';
            return da.localeCompare(db);
          });

          // Iterate ALL proposals to compute the running spending limit correctly
          // but only INSERT proposals that don't already exist in the DB
          let previousLimit = 0;

          for (const row of sorted) {
            const proposal = row.account_budget_proposal;
            const proposalId = proposal?.id ? String(proposal.id) : null;
            if (!proposalId) continue;

            const proposalType = proposal?.proposal_type || 0;
            const spendingLimitMicros = Number(proposal?.approved_spending_limit_micros || proposal?.proposed_spending_limit_micros || 0);
            const newSpendingLimit = spendingLimitMicros / 1_000_000;

            let rechargeAmount = 0;
            if (proposalType === 2) {
              rechargeAmount = newSpendingLimit;
            } else if (proposalType === 3) {
              rechargeAmount = newSpendingLimit - previousLimit;
            }
            previousLimit = newSpendingLimit;

            // Skip non-positive recharges
            if (rechargeAmount <= 0) continue;

            // In incremental mode, skip proposals already in DB
            if (recentOnly && existingProposalIds.has(proposalId)) continue;

            const rechargeDate = proposal?.approval_date_time || proposal?.creation_date_time || null;

            await query(
              `INSERT INTO google_ads_recharges
                (customer_account_id, customer_account_name, payments_account_id,
                 payments_profile_name, currency_code, recharge_amount, new_spending_limit,
                 proposal_id, proposal_type, recharge_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (proposal_id) DO UPDATE SET
                recharge_amount = EXCLUDED.recharge_amount,
                new_spending_limit = EXCLUDED.new_spending_limit,
                customer_account_name = EXCLUDED.customer_account_name,
                payments_profile_name = EXCLUDED.payments_profile_name,
                fetched_at = NOW()`,
              [
                account.id, account.name, paymentsAccountId,
                paymentsProfileName, currencyCode, rechargeAmount,
                newSpendingLimit, proposalId, proposalType, rechargeDate,
              ]
            );
            synced++;
          }
        } catch (accountError: any) {
          accountErrors++;
          logger.warn(`Recharges sync error for account ${account.id} (${account.name}): ${accountError.message}`);
        }
      }, CONCURRENCY_LIMIT);

      logger.info(`Recharges sync done: ${synced} new/updated, ${accountsProcessed} accounts processed, ${accountErrors} errors`);
    } catch (error: any) {
      logger.error('Recharges sync failed: ' + error.message);
    }
  }

  // ========================================================
  // 5. Full sync
  // ========================================================
  async syncAll(): Promise<void> {
    await this.syncAllCampaigns();
    await this.syncBillingAccounts();
    await this.syncAccountCharges();
    await this.syncRecharges();
    await this.syncBillingHistory();
  }

  // ========================================================
  // Query methods (for API endpoints)
  // ========================================================
  async getCampaignDetails(countryId?: number): Promise<any[]> {
    let sql = `
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (campaign_id)
               campaign_id, snapshot_date, conversions, cost, clicks,
               impressions, ctr, remaining_budget, daily_budget, status
        FROM google_ads_snapshots
        ORDER BY campaign_id, snapshot_date DESC
      )
      SELECT c.id, c.google_ads_campaign_id, c.name, c.campaign_url,
             c.daily_budget, c.start_date, c.end_date, c.ads_status, c.last_synced_at,
             co.name as country_name, co.code as country_code,
             ls.conversions, ls.cost, ls.clicks, ls.impressions, ls.ctr,
             ls.remaining_budget, ls.snapshot_date
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN latest_snapshots ls ON ls.campaign_id = c.id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];
    if (countryId) {
      params.push(countryId);
      sql += ` AND c.country_id = $${params.length}`;
    }
    sql += ' ORDER BY co.name, c.name';
    const result = await query(sql, params);
    return result.rows;
  }

  async getCampaignsGroupedByAccount(countryId?: number, accountIds?: string[]): Promise<any[]> {
    let sql = `
      WITH latest_snapshots AS (
        SELECT DISTINCT ON (campaign_id)
               campaign_id, snapshot_date, conversions, cost, clicks,
               impressions, ctr, remaining_budget, daily_budget, status
        FROM google_ads_snapshots
        ORDER BY campaign_id, snapshot_date DESC
      )
      SELECT c.id, c.google_ads_campaign_id, c.name, c.campaign_url,
             c.daily_budget, c.ads_status, c.customer_account_id, c.customer_account_name,
             co.name as country_name, co.code as country_code,
             ls.conversions, ls.cost, ls.clicks, ls.impressions, ls.ctr,
             ls.remaining_budget, ls.snapshot_date
      FROM campaigns c
      JOIN countries co ON co.id = c.country_id
      LEFT JOIN latest_snapshots ls ON ls.campaign_id = c.id
      WHERE c.is_active = TRUE
    `;
    const params: any[] = [];
    if (countryId) {
      params.push(countryId);
      sql += ` AND c.country_id = $${params.length}`;
    }
    if (accountIds && accountIds.length > 0) {
      params.push(accountIds);
      sql += ` AND c.customer_account_id = ANY($${params.length})`;
    }
    sql += ' ORDER BY c.customer_account_name, c.name';

    // Build recharges query with optional account filter
    let rechargesSql = `
        WITH latest_recharges AS (
          SELECT DISTINCT ON (customer_account_id)
                 customer_account_id, recharge_amount, recharge_date
          FROM google_ads_recharges
          ORDER BY customer_account_id, recharge_date DESC
        ),
        recharges_summary AS (
          SELECT customer_account_id,
                 COUNT(*) as recharges_count,
                 COALESCE(SUM(recharge_amount), 0) as total_recharged
          FROM google_ads_recharges
          GROUP BY customer_account_id
        ),
        same_day_flags AS (
          SELECT DISTINCT customer_account_id
          FROM google_ads_recharges
          GROUP BY customer_account_id, DATE(recharge_date)
          HAVING COUNT(*) >= 2
        )
        SELECT rs.customer_account_id,
               rs.recharges_count,
               rs.total_recharged,
               lr.recharge_date as last_recharge_date,
               lr.recharge_amount as last_recharge_amount,
               (sdf.customer_account_id IS NOT NULL) as has_same_day_recharges
        FROM recharges_summary rs
        LEFT JOIN latest_recharges lr ON lr.customer_account_id = rs.customer_account_id
        LEFT JOIN same_day_flags sdf ON sdf.customer_account_id = rs.customer_account_id
      `;
    const rechargesParams: any[] = [];
    if (accountIds && accountIds.length > 0) {
      rechargesParams.push(accountIds);
      rechargesSql += ` WHERE rs.customer_account_id = ANY($${rechargesParams.length})`;
    }

    // Run campaigns query and recharges summary in parallel
    const [campaignsResult, rechargesResult] = await Promise.all([
      query(sql, params),
      query(rechargesSql, rechargesParams),
    ]);

    // Build recharges lookup: customer_account_id -> recharges summary
    const rechargesMap = new Map<string, any>();
    for (const row of rechargesResult.rows) {
      rechargesMap.set(row.customer_account_id, {
        recharges_count: parseInt(row.recharges_count),
        total_recharged: parseFloat(row.total_recharged),
        last_recharge_date: row.last_recharge_date,
        last_recharge_amount: row.last_recharge_amount ? parseFloat(row.last_recharge_amount) : null,
        has_same_day_recharges: row.has_same_day_recharges === true || row.has_same_day_recharges === 't',
      });
    }

    // Group campaigns by customer_account_id
    const accountMap = new Map<string, any>();
    for (const row of campaignsResult.rows) {
      const accountId = row.customer_account_id || 'unknown';
      if (!accountMap.has(accountId)) {
        const rechargeData = rechargesMap.get(row.customer_account_id) || {
          recharges_count: 0, total_recharged: 0, last_recharge_date: null, last_recharge_amount: null,
        };
        accountMap.set(accountId, {
          customer_account_id: row.customer_account_id || null,
          customer_account_name: row.customer_account_name || 'Sin cuenta asignada',
          total_daily_budget: 0,
          total_cost_today: 0,
          total_remaining: 0,
          total_clicks: 0,
          total_impressions: 0,
          total_conversions: 0,
          campaigns_count: 0,
          enabled_count: 0,
          paused_count: 0,
          ...rechargeData,
          campaigns: [],
        });
      }
      const acct = accountMap.get(accountId)!;
      acct.campaigns.push(row);
      acct.campaigns_count++;
      if (row.ads_status === 'ENABLED') acct.enabled_count++;
      if (row.ads_status === 'PAUSED') acct.paused_count++;
      acct.total_daily_budget += Number(row.daily_budget) || 0;
      acct.total_cost_today += Number(row.cost) || 0;
      acct.total_remaining += Number(row.remaining_budget) || 0;
      acct.total_clicks += Number(row.clicks) || 0;
      acct.total_impressions += Number(row.impressions) || 0;
      acct.total_conversions += Number(row.conversions) || 0;
    }

    return Array.from(accountMap.values());
  }

  async getCampaignHistory(campaignId: number, days = 30): Promise<any[]> {
    const result = await query(
      `SELECT snapshot_date, conversions, status, remaining_budget, daily_budget, cost, clicks, impressions, ctr
       FROM google_ads_snapshots
       WHERE campaign_id = $1 AND snapshot_date >= CURRENT_DATE - $2::INTEGER
       ORDER BY snapshot_date ASC`,
      [campaignId, days]
    );
    return result.rows;
  }

  async getBillingAccounts(): Promise<any[]> {
    const result = await query(
      `SELECT id, billing_id, name, currency_code, status,
              payments_profile_name, customer_account_id, customer_account_name,
              last_synced_at
       FROM google_ads_billing_accounts ORDER BY customer_account_name, name`
    );
    return result.rows;
  }

  async getAccountCharges(limit = 50, offset = 0): Promise<{ rows: any[], total: number }> {
    const countResult = await query('SELECT COUNT(*) FROM google_ads_account_charges');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT ac.id, ac.customer_account_id, ac.customer_account_name,
              ac.payments_account_id, ac.payments_profile_name,
              ac.currency_code, ac.budget_name, ac.budget_status,
              ac.budget_start_date, ac.budget_end_date,
              ac.purchase_order_number,
              ac.total_adjustments_micros,
              ac.amount_served_micros,
              ac.fetched_at,
              ba.name as billing_account_name,
              ba.billing_id as billing_account_billing_id
       FROM google_ads_account_charges ac
       LEFT JOIN google_ads_billing_accounts ba ON ba.id = ac.billing_account_id
       ORDER BY ac.customer_account_name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: result.rows, total };
  }

  async getRecharges(
    limit = 50, offset = 0,
    filters: { dateFrom?: string; dateTo?: string; account?: string; paymentProfile?: string; accountIds?: string[] } = {}
  ): Promise<{ rows: any[], total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${idx}`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${idx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      idx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${idx}`);
      params.push(`%${filters.account}%`);
      idx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${idx}`);
      params.push(`%${filters.paymentProfile}%`);
      idx++;
    }
    if (filters.accountIds && filters.accountIds.length > 0) {
      conditions.push(`customer_account_id = ANY($${idx})`);
      params.push(filters.accountIds);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const whereAliased = conditions.length > 0
      ? `WHERE ${conditions.map(c => 'r.' + c).join(' AND ')}`
      : '';

    const countResult = await query(`SELECT COUNT(*) FROM google_ads_recharges ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `WITH account_financials AS (
        SELECT c.customer_account_id,
               COALESCE(SUM(c.daily_budget), 0) as total_daily_budget,
               COALESCE(SUM(ls.remaining_budget), 0) as total_remaining
        FROM campaigns c
        LEFT JOIN (
          SELECT DISTINCT ON (campaign_id) campaign_id, remaining_budget
          FROM google_ads_snapshots
          ORDER BY campaign_id, snapshot_date DESC
        ) ls ON ls.campaign_id = c.id
        WHERE c.is_active = TRUE AND c.customer_account_id IS NOT NULL
        GROUP BY c.customer_account_id
      )
      SELECT r.id, r.customer_account_id, r.customer_account_name,
              r.payments_account_id, r.payments_profile_name,
              r.currency_code, r.recharge_amount, r.new_spending_limit,
              r.proposal_id, r.proposal_type, r.recharge_date, r.fetched_at,
              COUNT(*) OVER (PARTITION BY r.customer_account_id, DATE(r.recharge_date)) as same_day_count,
              COALESCE(af.total_daily_budget, 0) as total_daily_budget,
              COALESCE(af.total_remaining, 0) as total_remaining
       FROM google_ads_recharges r
       LEFT JOIN account_financials af ON af.customer_account_id = r.customer_account_id
       ${whereAliased}
       ORDER BY r.recharge_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return { rows: result.rows, total };
  }

  async exportRechargesCsv(
    filters: { dateFrom?: string; dateTo?: string; account?: string; paymentProfile?: string } = {}
  ): Promise<string> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${idx}`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${idx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      idx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${idx}`);
      params.push(`%${filters.account}%`);
      idx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${idx}`);
      params.push(`%${filters.paymentProfile}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT customer_account_id, customer_account_name,
              payments_account_id, payments_profile_name,
              currency_code, recharge_amount, new_spending_limit,
              proposal_type, recharge_date
       FROM google_ads_recharges ${where}
       ORDER BY recharge_date DESC`,
      params
    );

    const header = 'ID Cuenta,Nombre Cuenta,Cuenta de Pago,Perfil de Pago,Moneda,Monto Recarga,Nuevo Limite,Tipo,Fecha';
    const rows = result.rows.map(r => {
      const date = r.recharge_date
        ? new Date(r.recharge_date).toISOString().replace('T', ' ').substring(0, 19)
        : '';
      const typeLabel = r.proposal_type === 2 ? 'Inicial' : r.proposal_type === 3 ? 'Recarga' : r.proposal_type === 4 ? 'Cierre' : r.proposal_type;
      return [
        r.customer_account_id,
        `"${(r.customer_account_name || '').replace(/"/g, '""')}"`,
        r.payments_account_id || '',
        `"${(r.payments_profile_name || '').replace(/"/g, '""')}"`,
        r.currency_code || '',
        r.recharge_amount,
        r.new_spending_limit,
        typeLabel,
        date,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async getRechargesDashboard(filters: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    account?: string;
    paymentProfile?: string;
  } = {}): Promise<any> {
    // Build WHERE clause from filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.country) {
      conditions.push(`UPPER(customer_account_name) LIKE $${paramIdx}`);
      params.push(`%${filters.country.toUpperCase()}%`);
      paramIdx++;
    }
    if (filters.dateFrom) {
      conditions.push(`recharge_date >= $${paramIdx}`);
      params.push(filters.dateFrom);
      paramIdx++;
    }
    if (filters.dateTo) {
      conditions.push(`recharge_date <= $${paramIdx}::date + INTERVAL '1 day'`);
      params.push(filters.dateTo);
      paramIdx++;
    }
    if (filters.account) {
      conditions.push(`customer_account_name ILIKE $${paramIdx}`);
      params.push(`%${filters.account}%`);
      paramIdx++;
    }
    if (filters.paymentProfile) {
      conditions.push(`payments_profile_name ILIKE $${paramIdx}`);
      params.push(`%${filters.paymentProfile}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Country mapping SQL expression
    const countryCase = `
      CASE
        WHEN UPPER(customer_account_name) LIKE '%COLOMBIA%' THEN 'Colombia'
        WHEN UPPER(customer_account_name) LIKE '%CHILE%' THEN 'Chile'
        WHEN UPPER(customer_account_name) LIKE '%PERU%' OR UPPER(customer_account_name) LIKE '%PERÚ%' THEN 'Perú'
        WHEN UPPER(customer_account_name) LIKE '%MEXICO%' OR UPPER(customer_account_name) LIKE '%MÉXICO%' THEN 'México'
        WHEN UPPER(customer_account_name) LIKE '%PANAMA%' OR UPPER(customer_account_name) LIKE '%PANAMÁ%' THEN 'Panamá'
        WHEN UPPER(customer_account_name) LIKE '%ECUADOR%' THEN 'Ecuador'
        WHEN UPPER(customer_account_name) LIKE '%BOLIVIA%' THEN 'Bolivia'
        ELSE 'Otros'
      END`;

    // Execute all queries in parallel
    const [
      totalsResult,
      byCountryResult,
      dailyTrendResult,
      todayResult,
      yesterdayResult,
      thisWeekResult,
      lastWeekResult,
      thisMonthResult,
      lastMonthResult,
      filtersDataResult,
    ] = await Promise.all([
      // Overall totals
      query(`SELECT COUNT(*) as total_count, COALESCE(SUM(recharge_amount), 0) as total_amount
             FROM google_ads_recharges ${whereClause}`, params),

      // By country
      query(`SELECT ${countryCase} as country,
                    COUNT(*) as count,
                    COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges ${whereClause}
             GROUP BY country ORDER BY total DESC`, params),

      // Daily trend (last 30 days)
      query(`SELECT DATE(recharge_date) as date,
                    COUNT(*) as count,
                    COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY DATE(recharge_date) ORDER BY date`, params),

      // Today
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(recharge_date) = CURRENT_DATE`, params),

      // Yesterday
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(recharge_date) = CURRENT_DATE - 1`, params),

      // This week (Mon-Sun)
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('week', CURRENT_DATE)`, params),

      // Last week
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
             AND recharge_date < DATE_TRUNC('week', CURRENT_DATE)`, params),

      // This month
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('month', CURRENT_DATE)`, params),

      // Last month
      query(`SELECT COUNT(*) as count, COALESCE(SUM(recharge_amount), 0) as total
             FROM google_ads_recharges
             ${whereClause ? whereClause + ' AND' : 'WHERE'} recharge_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
             AND recharge_date < DATE_TRUNC('month', CURRENT_DATE)`, params),

      // Unique filter values for dropdowns
      query(`SELECT DISTINCT payments_profile_name FROM google_ads_recharges
             WHERE payments_profile_name IS NOT NULL ORDER BY payments_profile_name`),
    ]);

    const totalCount = parseInt(totalsResult.rows[0].total_count);
    const totalAmount = parseFloat(totalsResult.rows[0].total_amount);
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    // Comparison calculations
    const todayTotal = parseFloat(todayResult.rows[0].total);
    const yesterdayTotal = parseFloat(yesterdayResult.rows[0].total);
    const thisWeekTotal = parseFloat(thisWeekResult.rows[0].total);
    const lastWeekTotal = parseFloat(lastWeekResult.rows[0].total);
    const thisMonthTotal = parseFloat(thisMonthResult.rows[0].total);
    const lastMonthTotal = parseFloat(lastMonthResult.rows[0].total);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      kpis: {
        totalAmount,
        totalCount,
        avgAmount,
        todayTotal,
        todayCount: parseInt(todayResult.rows[0].count),
        todayChange: calcChange(todayTotal, yesterdayTotal),
        thisWeekTotal,
        thisWeekCount: parseInt(thisWeekResult.rows[0].count),
        weekChange: calcChange(thisWeekTotal, lastWeekTotal),
        thisMonthTotal,
        thisMonthCount: parseInt(thisMonthResult.rows[0].count),
        monthChange: calcChange(thisMonthTotal, lastMonthTotal),
      },
      byCountry: byCountryResult.rows.map(r => ({
        country: r.country,
        count: parseInt(r.count),
        total: parseFloat(r.total),
      })),
      dailyTrend: dailyTrendResult.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count),
        total: parseFloat(r.total),
      })),
      filters: {
        paymentProfiles: filtersDataResult.rows.map(r => r.payments_profile_name),
      },
    };
  }

  async getBillingHistory(limit = 50, offset = 0): Promise<{ rows: any[], total: number }> {
    const countResult = await query('SELECT COUNT(*) FROM google_ads_billing_history');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT bh.*, ba.name as account_name, ba.billing_id as account_billing_id
       FROM google_ads_billing_history bh
       LEFT JOIN google_ads_billing_accounts ba ON ba.id = bh.billing_account_id
       ORDER BY bh.issue_date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: result.rows, total };
  }
}

export const googleAdsSyncService = new GoogleAdsSyncService();
