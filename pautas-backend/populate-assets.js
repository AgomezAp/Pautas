const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pautas',
  user: process.env.DB_USER || 'pautas_app',
  password: process.env.DB_PASSWORD || '',
});

async function run() {
  const before = await pool.query('SELECT COUNT(*) as cnt FROM google_ads_asset_snapshots');
  console.log('Assets before:', before.rows[0].cnt);

  // Bulk insert headlines from ad_snapshots
  const r1 = await pool.query(`
    INSERT INTO google_ads_asset_snapshots (campaign_id, ad_group_id, asset_id, asset_type, asset_text, clicks, impressions, cost, conversions, snapshot_date)
    SELECT
      a.campaign_id,
      a.ad_group_id,
      a.ad_id || '_H' || (idx - 1),
      'HEADLINE',
      elem->>'text',
      ROUND((COALESCE(a.clicks, 0)::numeric / GREATEST(jsonb_array_length(a.headlines::jsonb), 1))),
      ROUND((COALESCE(a.impressions, 0)::numeric / GREATEST(jsonb_array_length(a.headlines::jsonb), 1))),
      ROUND((COALESCE(a.cost, 0)::numeric / GREATEST(jsonb_array_length(a.headlines::jsonb), 1)), 2),
      ROUND((COALESCE(a.conversions, 0)::numeric / GREATEST(jsonb_array_length(a.headlines::jsonb), 1)), 2),
      a.snapshot_date
    FROM google_ads_ad_snapshots a,
         LATERAL jsonb_array_elements(a.headlines::jsonb) WITH ORDINALITY AS t(elem, idx)
    WHERE a.headlines IS NOT NULL
      AND a.headlines != 'null'
      AND a.headlines != '[]'
      AND elem->>'text' IS NOT NULL
    ON CONFLICT (campaign_id, asset_id, snapshot_date) DO UPDATE SET
      asset_text = EXCLUDED.asset_text,
      clicks = EXCLUDED.clicks,
      impressions = EXCLUDED.impressions,
      cost = EXCLUDED.cost,
      conversions = EXCLUDED.conversions
  `);
  console.log('Headlines inserted:', r1.rowCount);

  // Bulk insert descriptions from ad_snapshots
  const r2 = await pool.query(`
    INSERT INTO google_ads_asset_snapshots (campaign_id, ad_group_id, asset_id, asset_type, asset_text, clicks, impressions, cost, conversions, snapshot_date)
    SELECT
      a.campaign_id,
      a.ad_group_id,
      a.ad_id || '_D' || (idx - 1),
      'DESCRIPTION',
      elem->>'text',
      ROUND((COALESCE(a.clicks, 0)::numeric / GREATEST(jsonb_array_length(a.descriptions::jsonb), 1))),
      ROUND((COALESCE(a.impressions, 0)::numeric / GREATEST(jsonb_array_length(a.descriptions::jsonb), 1))),
      ROUND((COALESCE(a.cost, 0)::numeric / GREATEST(jsonb_array_length(a.descriptions::jsonb), 1)), 2),
      ROUND((COALESCE(a.conversions, 0)::numeric / GREATEST(jsonb_array_length(a.descriptions::jsonb), 1)), 2),
      a.snapshot_date
    FROM google_ads_ad_snapshots a,
         LATERAL jsonb_array_elements(a.descriptions::jsonb) WITH ORDINALITY AS t(elem, idx)
    WHERE a.descriptions IS NOT NULL
      AND a.descriptions != 'null'
      AND a.descriptions != '[]'
      AND elem->>'text' IS NOT NULL
    ON CONFLICT (campaign_id, asset_id, snapshot_date) DO UPDATE SET
      asset_text = EXCLUDED.asset_text,
      clicks = EXCLUDED.clicks,
      impressions = EXCLUDED.impressions,
      cost = EXCLUDED.cost,
      conversions = EXCLUDED.conversions
  `);
  console.log('Descriptions inserted:', r2.rowCount);

  // Verify
  const after = await pool.query('SELECT COUNT(*) as cnt FROM google_ads_asset_snapshots');
  console.log('Total assets now:', after.rows[0].cnt);

  const summary = await pool.query('SELECT asset_type, COUNT(*) as cnt FROM google_ads_asset_snapshots GROUP BY asset_type ORDER BY cnt DESC');
  console.log('By type:', summary.rows);

  const dateRange = await pool.query('SELECT MIN(snapshot_date) as min_date, MAX(snapshot_date) as max_date FROM google_ads_asset_snapshots');
  console.log('Date range:', dateRange.rows[0]);

  pool.end();
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
