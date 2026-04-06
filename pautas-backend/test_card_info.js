require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

const api = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const managerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;

// Query MCC for all client accounts
const mccCustomer = api.Customer({
  customer_id: managerId,
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
});

(async () => {
  // Get first 20 client accounts
  const clients = await mccCustomer.query(`
    SELECT customer_client.id, customer_client.descriptive_name, customer_client.status
    FROM customer_client
    WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'
    LIMIT 20
  `);

  console.log('Checking billing_setup for first 20 accounts...\n');
  const paymentNames = new Set();

  for (const c of clients) {
    const accId = String(c.customer_client.id);
    const accName = c.customer_client.descriptive_name;
    try {
      const customer = api.Customer({
        customer_id: accId,
        login_customer_id: managerId,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      });
      const bs = await customer.query(`
        SELECT
          billing_setup.payments_account_info.payments_account_id,
          billing_setup.payments_account_info.payments_account_name,
          billing_setup.payments_account_info.payments_profile_name
        FROM billing_setup
      `);
      if (bs.length > 0) {
        const info = bs[0].billing_setup.payments_account_info;
        const payAccId = info.payments_account_id || '';
        const payAccName = info.payments_account_name || '';
        const profileName = info.payments_profile_name || '';
        const last4 = payAccId.replace(/-/g, '').slice(-4);
        paymentNames.add(payAccName);
        console.log(`${accName} (${accId}): card_id=${payAccId} last4=${last4} name="${payAccName}" profile="${profileName}"`);
      }
    } catch (e) {
      // skip
    }
  }

  console.log('\nUnique payment account names:', [...paymentNames]);
})().catch(err => console.error('Fatal:', err.message));
