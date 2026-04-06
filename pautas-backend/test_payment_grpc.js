require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const { OAuth2Client } = require('google-auth-library');
const { PaymentsAccountServiceClient } = require('google-ads-node');

(async () => {
  // Get access token
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { token: accessToken } = await oauth2Client.getAccessToken();
  console.log('Access token obtained');

  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Create gRPC metadata with auth
  const metadata = new grpc.Metadata();
  metadata.set('authorization', `Bearer ${accessToken}`);
  metadata.set('developer-token', devToken);
  metadata.set('login-customer-id', managerId);

  // Create client with SSL
  const client = new PaymentsAccountServiceClient({
    sslCreds: grpc.credentials.createSsl(),
  });

  // Initialize and get the inner gRPC client
  await client.initialize();
  console.log('Client initialized');

  // Call listPaymentsAccounts with metadata
  const innerClient = client.paymentsAccountServiceStub;
  if (innerClient) {
    console.log('Inner client methods:', Object.keys(innerClient));
  }

  // Use the proper method with call options
  try {
    const [response] = await client.listPaymentsAccounts(
      { customerId: '4140534013' },
      { otherArgs: { headers: { 'x-goog-request-params': `customer_id=4140534013` } } }
    );
    console.log('\nResponse:', JSON.stringify(response, null, 2));
  } catch(e) {
    console.log('\nDirect call error:', e.message?.substring(0, 300));

    // Try with raw inner API
    try {
      const request = { customerId: '4140534013' };
      const callOptions = {
        otherArgs: {
          headers: {
            'x-goog-request-params': 'customer_id=4140534013',
            'authorization': `Bearer ${accessToken}`,
            'developer-token': devToken,
            'login-customer-id': managerId,
          },
        },
      };
      const [resp] = await client.listPaymentsAccounts(request, callOptions);
      console.log('Response:', JSON.stringify(resp, null, 2));
    } catch(e2) {
      console.log('Call with headers error:', e2.message?.substring(0, 500));
    }
  }

})().catch(err => console.error('Fatal:', err.message));
