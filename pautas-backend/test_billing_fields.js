require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = api.Customer({
  customer_id: '8287238874',
  login_customer_id: process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

(async () => {
  // 1. Check billing_setup fields
  console.log('=== BILLING SETUP ===');
  try {
    const billingSetup = await customer.query(`
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
    `);
    billingSetup.forEach((row, i) => {
      console.log(`\nBilling Setup ${i+1}:`, JSON.stringify(row.billing_setup, null, 2));
    });
  } catch (e) {
    console.log('billing_setup error:', e.message?.substring(0, 300));
  }

  // 2. Check account_budget for payment info
  console.log('\n=== ACCOUNT BUDGET ===');
  try {
    const budgets = await customer.query(`
      SELECT
        account_budget.id,
        account_budget.name,
        account_budget.status,
        account_budget.amount_served_micros,
        account_budget.total_adjustments_micros,
        account_budget.approved_spending_limit_micros,
        account_budget.purchase_order_number,
        account_budget.notes
      FROM account_budget
      LIMIT 3
    `);
    budgets.forEach((row, i) => {
      console.log(`\nBudget ${i+1}:`, JSON.stringify(row.account_budget, null, 2));
    });
  } catch (e) {
    console.log('account_budget error:', e.message?.substring(0, 300));
  }

  // 3. Check account_budget_proposal for more fields
  console.log('\n=== ACCOUNT BUDGET PROPOSALS (last 5) ===');
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
        account_budget_proposal.account_budget
      FROM account_budget_proposal
      ORDER BY account_budget_proposal.creation_date_time DESC
      LIMIT 5
    `);
    proposals.forEach((row, i) => {
      console.log(`\nProposal ${i+1}:`, JSON.stringify(row.account_budget_proposal, null, 2));
    });
  } catch (e) {
    console.log('proposals error:', e.message?.substring(0, 500));
  }

  // 4. Try to get customer payment info
  console.log('\n=== CUSTOMER INFO ===');
  try {
    const custInfo = await customer.query(`
      SELECT
        customer.descriptive_name,
        customer.currency_code,
        customer.auto_tagging_enabled,
        customer.pay_per_conversion_eligibility_failure_reasons
      FROM customer
    `);
    custInfo.forEach((row) => {
      console.log('Customer:', JSON.stringify(row.customer, null, 2));
    });
  } catch (e) {
    console.log('customer error:', e.message?.substring(0, 300));
  }
})().catch(err => console.error('Fatal:', err.message));
