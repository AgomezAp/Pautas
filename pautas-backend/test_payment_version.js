require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const { OAuth2Client } = require('google-auth-library');

(async () => {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN });
  const { token: accessToken } = await oauth2Client.getAccessToken();

  const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Check google-ads-node version and proto paths
  const nodePackage = require('google-ads-node/package.json');
  console.log('google-ads-node version:', nodePackage.version);

  // Check google-ads-api version
  const apiPackage = require('google-ads-api/package.json');
  console.log('google-ads-api version:', apiPackage.version);

  // Check what the PaymentsAccount resource looks like in google-ads-node
  const resources = require('google-ads-node');
  const paymentKeys = Object.keys(resources).filter(k => k.includes('PaymentsAccount') || k.includes('Payment'));
  console.log('\nPayment-related exports:', paymentKeys);

  // Check if PaymentsAccount resource type exists
  if (resources.PaymentsAccount) {
    console.log('\nPaymentsAccount fields:', Object.keys(new resources.PaymentsAccount()));
  }

  // Check ListPaymentsAccountsResponse
  if (resources.ListPaymentsAccountsResponse) {
    console.log('\nListPaymentsAccountsResponse fields:', Object.keys(new resources.ListPaymentsAccountsResponse()));
  }

  // Let's look at what's in the services export from google-ads-api
  const { services: svc } = require('google-ads-api');
  if (svc.PaymentsAccountService) {
    console.log('\nPaymentsAccountService:', Object.keys(svc.PaymentsAccountService));
  }
  if (svc.ListPaymentsAccountsRequest) {
    console.log('ListPaymentsAccountsRequest:', Object.keys(new svc.ListPaymentsAccountsRequest()));
  }

})().catch(err => console.error('Fatal:', err.message));
