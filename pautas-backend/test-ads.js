const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

async function main() {
  // Test 1: List accessible customers
  console.log('=== Accessible Customers ===');
  try {
    const accessible = await client.listAccessibleCustomers(process.env.GOOGLE_ADS_REFRESH_TOKEN);
    console.log(JSON.stringify(accessible, null, 2));
  } catch (err) {
    console.error('Error listing:', err.errors ? err.errors[0].message : err.message || err);
  }

  // Test 2: Try querying the MCC directly for customer_client
  console.log('\n=== MCC Customer Clients ===');
  const mcc = client.Customer({
    customer_id: '4397866074',
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
  try {
    const results = await mcc.query(
      "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status FROM customer_client"
    );
    console.log('Customer clients:', results.length);
    results.forEach((row, i) => {
      console.log(`${i+1}. ID: ${row.customer_client.id} | Name: ${row.customer_client.descriptive_name} | Manager: ${row.customer_client.manager} | Status: ${row.customer_client.status}`);
    });
  } catch (err) {
    console.error('Error querying MCC:', err.errors ? err.errors[0].message : err.message || err);
  }

  // Test 3: Try querying the MCC for campaigns directly
  console.log('\n=== MCC Campaigns ===');
  try {
    const results = await mcc.query(
      "SELECT campaign.id, campaign.name, campaign.status FROM campaign"
    );
    console.log('Campaigns:', results.length);
    results.forEach((row, i) => {
      console.log(`${i+1}. ${row.campaign.name} | Status: ${row.campaign.status}`);
    });
  } catch (err) {
    console.error('Error querying MCC campaigns:', err.errors ? err.errors[0].message : err.message || err);
  }

  // Test 4: Try querying the other account directly (without login_customer_id)
  console.log('\n=== Account 9061405345 (direct) ===');
  const other = client.Customer({
    customer_id: '9061405345',
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
  try {
    const results = await other.query(
      "SELECT campaign.id, campaign.name, campaign.status FROM campaign"
    );
    console.log('Campaigns:', results.length);
    results.forEach((row, i) => {
      console.log(`${i+1}. ${row.campaign.name} | Status: ${row.campaign.status}`);
    });
  } catch (err) {
    console.error('Error querying 9061405345:', err.errors ? err.errors[0].message : err.message || err);
  }
}

main();
