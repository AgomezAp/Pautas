require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

const customer = api.Customer({
  customer_id: '4140534013',
  login_customer_id: managerId,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

(async () => {
  // 1. List all methods on customer object to find PaymentsAccount service
  console.log('=== Customer methods related to payment ===');
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(customer))
    .filter(m => m.toLowerCase().includes('pay') || m.toLowerCase().includes('bill') || m.toLowerCase().includes('list'));
  console.log(methods);

  // 2. Try listPaymentsAccounts if it exists
  if (typeof customer.listPaymentsAccounts === 'function') {
    console.log('\n=== listPaymentsAccounts ===');
    try {
      const result = await customer.listPaymentsAccounts();
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Error:', e.message?.substring(0, 300));
    }
  }

  // 3. Try querying payments_account resource via GAQL
  console.log('\n=== Try GAQL payments_account ===');
  try {
    const result = await customer.query(`SELECT payments_account.resource_name FROM payments_account`);
    console.log(JSON.stringify(result, null, 2));
  } catch(e) {
    console.log('GAQL payments_account error:', e.message?.substring(0, 300));
  }

  // 4. Try to find all GAQL queryable resources
  console.log('\n=== Customer object keys (first 50) ===');
  const allKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(customer)).sort();
  console.log(allKeys.slice(0, 50));
  console.log('...');
  console.log('Total methods:', allKeys.length);

})().catch(err => console.error('Fatal:', err.message));
