// Backfill script - fetches LAST_30_DAYS for all enhanced tables
require('dotenv').config();
const { googleAdsSyncService } = require('./dist/services/google-ads-sync.service');
const { Pool } = require('pg');

async function main() {
  console.log('=== BACKFILL: Enhanced Analytics (LAST_30_DAYS) ===');
  console.log('Started at:', new Date().toISOString());
  console.log('This will fetch 30 days of historical data for all enhanced tables.');
  console.log('This will take a while with 226 accounts...\n');

  try {
    await googleAdsSyncService.syncEnhancedAnalytics(true); // backfill = true
    console.log('\nEnhanced analytics backfill completed!');
  } catch (err) {
    console.error('Backfill error:', err.message);
  }

  try {
    await googleAdsSyncService.syncAuctionInsights();
    console.log('Auction insights sync completed!');
  } catch (err) {
    console.error('Auction insights error:', err.message);
  }

  // Check results
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const client = await pool.connect();
  console.log('\n=== Results ===');
  const tables = [
    'google_ads_keyword_snapshots',
    'google_ads_device_snapshots',
    'google_ads_geo_snapshots',
    'google_ads_hourly_snapshots',
    'google_ads_search_term_snapshots',
    'google_ads_ad_snapshots',
    'google_ads_auction_insights',
    'google_ads_demographics_snapshots',
  ];
  for (const t of tables) {
    const r = await client.query(`SELECT COUNT(*) as total FROM ${t}`);
    console.log(`${t}: ${r.rows[0].total} rows`);
  }
  client.release();
  await pool.end();

  console.log('\nCompleted at:', new Date().toISOString());
  process.exit(0);
}

main();
