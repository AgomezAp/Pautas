require('dotenv').config();
const grpc = require('@grpc/grpc-js');

// Try using PaymentsAccountServiceClient directly from google-ads-node
const { PaymentsAccountServiceClient } = require('google-ads-node');

(async () => {
  console.log('=== PaymentsAccountServiceClient ===');

  // Check what methods are available
  const proto = Object.getOwnPropertyNames(PaymentsAccountServiceClient.prototype);
  console.log('Methods:', proto);

  // Check service definition
  if (PaymentsAccountServiceClient.service) {
    console.log('\nService definition keys:', Object.keys(PaymentsAccountServiceClient.service));
  }

  // Now try google-ads-api services to find PaymentsAccountService
  const { services } = require('google-ads-api');
  const paymentServices = Object.keys(services).filter(k => k.toLowerCase().includes('payment'));
  console.log('\nPayment services in google-ads-api:', paymentServices);

  // Check if we can use the raw services
  const allServices = Object.keys(services);
  console.log('\nAll services (' + allServices.length + '):', allServices.filter(k => k.includes('Payment') || k.includes('Billing') || k.includes('Account')));

})().catch(err => console.error('Fatal:', err.message));
