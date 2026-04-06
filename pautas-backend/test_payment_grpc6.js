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

  const oauthCreds = grpc.credentials.createFromMetadataGenerator((params, callback) => {
    const metadata = new grpc.Metadata();
    metadata.set('authorization', `Bearer ${accessToken}`);
    metadata.set('developer-token', devToken);
    metadata.set('login-customer-id', managerId);
    callback(null, metadata);
  });

  const sslCreds = grpc.credentials.createSsl();
  const combinedCreds = grpc.credentials.combineChannelCredentials(sslCreds, oauthCreds);

  const client = new PaymentsAccountServiceClient({
    sslCreds: combinedCreds,
    servicePath: 'googleads.googleapis.com',
    port: 443,
  });

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

  // Try different customer ID formats
  const ids = [managerId, '4140534013', '414-053-4013', '4397866074'];
  for (const id of ids) {
    try {
      console.log(`\nTrying customerId: "${id}"`);
      const [response] = await client.listPaymentsAccounts(
        { customerId: id },
        {
          otherArgs: {
            headers: {
              'developer-token': devToken,
              'login-customer-id': managerId,
            },
          },
        }
      );
      console.log('SUCCESS! Response:');
      console.log(JSON.stringify(response, null, 2).substring(0, 2000));
      break;
    } catch(e) {
      console.log(`  Error ${e.code}: ${e.message?.substring(0, 200)}`);
    }
  }

})().catch(err => console.error('Fatal:', err.message));
