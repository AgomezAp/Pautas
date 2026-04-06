require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');

(async () => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Use google-ads-api's internal mechanism - create a customer and use its querier
  // to call PaymentsAccountService indirectly
  const { GoogleAdsApi } = require('google-ads-api');
  const api = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: devToken,
  });

  const customer = api.Customer({
    customer_id: managerId, // Use MCC to list payment accounts
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  // Access internal service cache to get authenticated gRPC channels
  console.log('Service cache keys:', Object.keys(customer.serviceCache || {}));
  console.log('Customer keys:', Object.keys(customer));

  // Try doing a dummy query first to populate service cache
  await customer.query('SELECT customer.id FROM customer LIMIT 1');
  console.log('After query - Service cache keys:', Object.keys(customer.serviceCache || {}));

  // Now try access raw gRPC
  const clientOptions = customer.clientOptions;
  console.log('\nClient options:', JSON.stringify(clientOptions, null, 2));

})().catch(err => console.error('Fatal:', err.message));
