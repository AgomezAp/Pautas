require('dotenv').config();
const https = require('https');
const { OAuth2Client } = require('google-auth-library');

(async () => {
  // Get OAuth2 access token
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
  const { token } = await oauth2Client.getAccessToken();
  console.log('Access token obtained');

  const customerId = '4140534013';
  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

  // Call Google Ads REST API: listPaymentsAccounts
  const url = `https://googleads.googleapis.com/v18/customers/${customerId}/paymentsAccounts:list`;

  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': managerId,
      'Content-Type': 'application/json',
    },
  };

  const result = await new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });

  try {
    const parsed = JSON.parse(result);
    console.log('\nPayments Accounts:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch(e) {
    console.log('\nRaw response:', result.substring(0, 1000));
  }

})().catch(err => console.error('Fatal:', err.message));
