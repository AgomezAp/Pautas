require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

const customer = api.Customer({
  customer_id: '4140534013',
  login_customer_id: managerId,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

(async () => {
  // Try to access the underlying gRPC client for PaymentsAccountService
  console.log('=== API object keys ===');
  const apiKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(api));
  console.log(apiKeys);

  // Check if there are internal service clients
  console.log('\n=== API instance keys ===');
  console.log(Object.keys(api));

  // Try to find PaymentsAccountService in the module
  console.log('\n=== google-ads-api module exports ===');
  const gadsModule = require('google-ads-api');
  const exports = Object.keys(gadsModule).filter(k =>
    k.toLowerCase().includes('pay') || k.toLowerCase().includes('service')
  );
  console.log('Payment/Service exports:', exports.length > 0 ? exports : 'none found');

  // Show all exports
  console.log('\nAll exports:', Object.keys(gadsModule).slice(0, 30));

  // Check the protos package
  console.log('\n=== Check google-ads-node for PaymentsAccount ===');
  try {
    const services = require('google-ads-node');
    const paymentKeys = Object.keys(services).filter(k =>
      k.toLowerCase().includes('payment')
    );
    console.log('Payment keys:', paymentKeys);
  } catch(e) {
    console.log('google-ads-node not found:', e.message?.substring(0, 100));
  }

  // Direct gRPC approach - try to get the service through the customer's internal client
  console.log('\n=== Customer internal properties ===');
  const custKeys = Object.keys(customer);
  console.log(custKeys);

  // Check if creds/client is accessible
  if (customer.credentials) {
    console.log('\nCredentials:', Object.keys(customer.credentials));
  }

})().catch(err => console.error('Fatal:', err.message));
