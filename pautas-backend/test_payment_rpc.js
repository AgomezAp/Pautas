require('dotenv').config();
const { GoogleAdsApi, services } = require('google-ads-api');
const { PaymentsAccountServiceClient } = require('google-ads-node');
const { GoogleAuth, OAuth2Client } = require('google-auth-library');

(async () => {
  // Create OAuth2 credentials
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  // Get access token
  const { token } = await oauth2Client.getAccessToken();
  console.log('Got access token');

  // Create the service client
  const client = new PaymentsAccountServiceClient({
    sslCreds: require('@grpc/grpc-js').credentials.createSsl(),
    authClient: oauth2Client,
  });

  console.log('Client created');

  // Try listPaymentsAccounts
  try {
    const [response] = await client.listPaymentsAccounts({
      customerId: '4140534013',
    }, {
      otherArgs: {
        headers: {
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'login-customer-id': process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID,
        },
      },
    });
    console.log('\nPayments Accounts Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch(e) {
    console.log('Error:', e.message?.substring(0, 500));
    console.log('Code:', e.code);

    // Try alternative approach - direct with metadata
    try {
      console.log('\n=== Trying alternative approach ===');
      const [response2] = await client.listPaymentsAccounts({
        customerId: '4140534013',
      });
      console.log('Response:', JSON.stringify(response2, null, 2));
    } catch(e2) {
      console.log('Alt error:', e2.message?.substring(0, 500));
    }
  }

})().catch(err => console.error('Fatal:', err.message?.substring(0, 500)));
