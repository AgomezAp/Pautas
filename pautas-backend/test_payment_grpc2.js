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

  // Create client with proper auth - use GoogleAuth from google-gax
  const client = new PaymentsAccountServiceClient({
    // Pass credentials directly
    credentials: {
      client_email: '',
      private_key: '',
    },
    // We'll intercept and set the token manually
  });

  await client.initialize();

  // Access the internal gRPC transport
  const stub = client.innerApiCalls;
  console.log('Inner API calls:', Object.keys(stub));

  if (stub.listPaymentsAccounts) {
    try {
      // Call with proper gRPC metadata
      const callOptions = {
        otherArgs: {
          headers: {
            'authorization': `Bearer ${accessToken}`,
            'developer-token': devToken,
            'login-customer-id': managerId,
            'x-goog-request-params': 'customer_id=4140534013',
          },
        },
      };

      const [response] = await stub.listPaymentsAccounts(
        { customerId: '4140534013' },
        callOptions
      );
      console.log('\nPayments Accounts:');
      if (response && response.paymentsAccounts) {
        response.paymentsAccounts.forEach((acc, i) => {
          console.log(`\n  Account ${i+1}:`);
          console.log(`  Resource: ${acc.resourceName}`);
          console.log(`  ID: ${acc.paymentsAccountId}`);
          console.log(`  Name: ${acc.name}`);
          console.log(`  Currency: ${acc.currencyCode}`);
          console.log(`  Profile ID: ${acc.paymentsProfileId}`);
          console.log(`  ALL FIELDS:`, JSON.stringify(acc, null, 4));
        });
      } else {
        console.log('Raw response:', JSON.stringify(response, null, 2));
      }
    } catch(e) {
      console.log('Error:', e.message?.substring(0, 500));
      console.log('Code:', e.code);
      console.log('Details:', e.details?.substring(0, 500));
    }
  }

})().catch(err => console.error('Fatal:', err.message));
