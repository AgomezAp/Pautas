require('dotenv').config();
const https = require('https');
const { OAuth2Client } = require('google-auth-library');

(async () => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { token } = await oauth2Client.getAccessToken();

  const customerId = '4140534013';
  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

  // Use the search endpoint with GAQL to find all fields in billing_setup
  const searchUrl = `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`;

  const queries = [
    // Check all billing_setup fields available
    `SELECT billing_setup.id, billing_setup.status, billing_setup.payments_account_info.payments_account_id, billing_setup.payments_account_info.payments_account_name, billing_setup.payments_account_info.payments_profile_id, billing_setup.payments_account_info.payments_profile_name, billing_setup.payments_account_info.secondary_payments_profile_id, billing_setup.payments_account FROM billing_setup`,
  ];

  for (const q of queries) {
    console.log(`\nQuery: ${q.substring(0, 80)}...`);
    const body = JSON.stringify({ query: q });
    const result = await new Promise((resolve, reject) => {
      const req = https.request(searchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'login-customer-id': managerId,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    console.log('Status:', result.status);
    if (result.data.startsWith('[') || result.data.startsWith('{')) {
      const parsed = JSON.parse(result.data);
      console.log(JSON.stringify(parsed, null, 2).substring(0, 1500));
    }
  }

  // Now try the PaymentsAccountService via REST
  // The correct REST mapping for PaymentsAccountService.ListPaymentsAccounts
  const paymentsUrls = [
    `https://googleads.googleapis.com/v18/customers/${customerId}/paymentsAccounts`,
    `https://googleads.googleapis.com/v17/customers/${customerId}/paymentsAccounts`,
    `https://googleads.googleapis.com/v16/customers/${customerId}/paymentsAccounts`,
  ];

  for (const url of paymentsUrls) {
    console.log(`\nTrying: ${url}`);
    const result = await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'login-customer-id': managerId,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });
    console.log('Status:', result.status);
    if (result.status === 200 && result.data.startsWith('{')) {
      console.log(JSON.stringify(JSON.parse(result.data), null, 2).substring(0, 2000));
      break;
    } else if (result.data.startsWith('{')) {
      console.log(JSON.stringify(JSON.parse(result.data), null, 2).substring(0, 500));
    }
  }

})().catch(err => console.error('Fatal:', err.message));
