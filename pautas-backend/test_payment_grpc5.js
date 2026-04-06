require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const { OAuth2Client } = require('google-auth-library');
const { PaymentsAccountServiceClient } = require('google-ads-node');

(async () => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Create call credentials that add OAuth2 token
  const oauthCreds = grpc.credentials.createFromMetadataGenerator((params, callback) => {
    const metadata = new grpc.Metadata();
    metadata.set('authorization', `Bearer ${accessToken}`);
    metadata.set('developer-token', devToken);
    callback(null, metadata);
  });

  // Combine SSL + OAuth2
  const sslCreds = grpc.credentials.createSsl();
  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, oauthCreds);

  // Create client with combined credentials
  const client = new PaymentsAccountServiceClient({
    sslCreds: combinedCreds,
    servicePath: 'googleads.googleapis.com',
    port: 443,
  });

  // Override internal auth
  client.auth = {
    getClient: async () => ({
      getRequestHeaders: async () => ({
        'authorization': `Bearer ${accessToken}`,
        'developer-token': devToken,
        'login-customer-id': managerId,
      }),
    }),
  };

  await client.initialize();
  console.log('Client initialized with custom auth');

  try {
    const [response] = await client.listPaymentsAccounts(
      { customerId: managerId },
      {
        otherArgs: {
          headers: {
            'developer-token': devToken,
            'login-customer-id': managerId,
          },
        },
      }
    );
    console.log('\n=== PAYMENTS ACCOUNTS ===');
    if (response?.paymentsAccounts) {
      response.paymentsAccounts.forEach((acc, i) => {
        console.log(`\nAccount ${i+1}: ${JSON.stringify(acc, null, 2)}`);
      });
    } else {
      console.log(JSON.stringify(response, null, 2));
    }
  } catch(e) {
    console.log('Error code:', e.code);
    console.log('Error:', e.message?.substring(0, 500));
  }

})().catch(err => console.error('Fatal:', err.message));
