require('dotenv').config();
const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const { PaymentsAccountServiceClient } = require('google-ads-node');

(async () => {
  // Create a custom auth client that wraps OAuth2
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });

  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Create client using the auth client directly
  const client = new PaymentsAccountServiceClient({
    authClient: oauth2Client,
    projectId: 'google-ads-client',
  });

  await client.initialize();
  console.log('Client initialized');

  // Override the auth to use OAuth2 credentials
  client.auth = {
    getClient: async () => oauth2Client,
  };

  try {
    const request = { customerId: '4140534013' };
    const options = {
      otherArgs: {
        headers: {
          'developer-token': devToken,
          'login-customer-id': managerId,
        },
      },
    };

    const [response] = await client.listPaymentsAccounts(request, options);
    console.log('\n=== SUCCESS ===');
    console.log('Payments accounts:', JSON.stringify(response, null, 2));
  } catch(e) {
    console.log('Error:', e.code, e.message?.substring(0, 500));
  }

})().catch(err => console.error('Fatal:', err.message));
