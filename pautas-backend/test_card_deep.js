require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

// Use the account from the screenshot: LY ESPAÑA MEIGA = 4140534013
const customer = api.Customer({
  customer_id: '4140534013',
  login_customer_id: managerId,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

(async () => {
  // 1. Try ListPaymentsAccounts (special RPC, not GAQL)
  console.log('=== ListPaymentsAccounts ===');
  try {
    const accounts = await customer.listAccessibleCustomers();
    console.log('Accessible customers:', accounts);
  } catch(e) {
    console.log('listAccessible error:', e.message?.substring(0, 200));
  }

  // 2. Try querying ALL billing_setup fields
  console.log('\n=== ALL billing_setup fields ===');
  try {
    const bs = await customer.query(`
      SELECT
        billing_setup.id,
        billing_setup.status,
        billing_setup.start_date_time,
        billing_setup.end_date_time,
        billing_setup.end_time_type,
        billing_setup.payments_account,
        billing_setup.payments_account_info.payments_account_id,
        billing_setup.payments_account_info.payments_account_name,
        billing_setup.payments_account_info.payments_profile_id,
        billing_setup.payments_account_info.payments_profile_name,
        billing_setup.payments_account_info.secondary_payments_profile_id
      FROM billing_setup
    `);
    bs.forEach((row, i) => {
      console.log(`Setup ${i+1}:`, JSON.stringify(row, null, 2));
    });
  } catch (e) {
    console.log('billing_setup error:', e.message?.substring(0, 300));
  }

  // 3. Check account_budget with ALL fields
  console.log('\n=== ALL account_budget fields ===');
  try {
    const budgets = await customer.query(`
      SELECT
        account_budget.id,
        account_budget.name,
        account_budget.status,
        account_budget.billing_setup,
        account_budget.amount_served_micros,
        account_budget.total_adjustments_micros,
        account_budget.approved_spending_limit_micros,
        account_budget.proposed_spending_limit_micros,
        account_budget.adjusted_spending_limit_micros,
        account_budget.purchase_order_number,
        account_budget.notes,
        account_budget.approved_start_date_time,
        account_budget.approved_end_date_time
      FROM account_budget
    `);
    budgets.forEach((row, i) => {
      console.log(`Budget ${i+1}:`, JSON.stringify(row, null, 2));
    });
  } catch (e) {
    console.log('account_budget error:', e.message?.substring(0, 300));
  }

  // 4. Check account_budget_proposal with billing_setup reference
  console.log('\n=== account_budget_proposal with billing_setup (last 3) ===');
  try {
    const proposals = await customer.query(`
      SELECT
        account_budget_proposal.id,
        account_budget_proposal.proposal_type,
        account_budget_proposal.status,
        account_budget_proposal.proposed_spending_limit_micros,
        account_budget_proposal.approved_spending_limit_micros,
        account_budget_proposal.creation_date_time,
        account_budget_proposal.approval_date_time,
        account_budget_proposal.proposed_name,
        account_budget_proposal.proposed_notes,
        account_budget_proposal.proposed_purchase_order_number,
        account_budget_proposal.account_budget,
        account_budget_proposal.billing_setup
      FROM account_budget_proposal
      ORDER BY account_budget_proposal.creation_date_time DESC
      LIMIT 3
    `);
    proposals.forEach((row, i) => {
      console.log(`Proposal ${i+1}:`, JSON.stringify(row, null, 2));
    });
  } catch (e) {
    console.log('proposals error:', e.message?.substring(0, 500));
  }

  // 5. Try to access change_event for billing changes
  console.log('\n=== change_event for BILLING ===');
  try {
    const changes = await customer.query(`
      SELECT
        change_event.change_date_time,
        change_event.change_resource_type,
        change_event.change_resource_name,
        change_event.client_type,
        change_event.user_email,
        change_event.old_resource,
        change_event.new_resource
      FROM change_event
      WHERE change_event.change_date_time >= '2026-03-20'
        AND change_event.change_resource_type = 'CAMPAIGN_BUDGET'
      ORDER BY change_event.change_date_time DESC
      LIMIT 3
    `);
    changes.forEach((row, i) => {
      console.log(`Change ${i+1}:`, JSON.stringify(row, null, 2));
    });
  } catch (e) {
    console.log('change_event error:', e.message?.substring(0, 300));
  }

})().catch(err => console.error('Fatal:', err.message?.substring(0, 300)));
