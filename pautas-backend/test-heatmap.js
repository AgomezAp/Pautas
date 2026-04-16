require('dotenv').config();
const pg = require('pg');
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function test() {
  try {
    // Check hourly data distribution by day_of_week
    const r1 = await pool.query(`
      SELECT EXTRACT(DOW FROM hs.snapshot_date) AS day_of_week,
        TO_CHAR(hs.snapshot_date, 'Dy') AS day_name,
        hs.snapshot_date,
        COUNT(*) AS records,
        SUM(hs.clicks) AS total_clicks
      FROM google_ads_hourly_snapshots hs
      GROUP BY hs.snapshot_date, EXTRACT(DOW FROM hs.snapshot_date), TO_CHAR(hs.snapshot_date, 'Dy')
      ORDER BY hs.snapshot_date
    `);
    console.log('Hourly data by date:');
    r1.rows.forEach(r => console.log(`  ${r.snapshot_date.toISOString().split('T')[0]} (${r.day_name}, DOW=${r.day_of_week}): ${r.records} records, ${r.total_clicks} clicks`));

    // Also check column day_of_week in the table itself
    const r2 = await pool.query(`
      SELECT DISTINCT hs.day_of_week, COUNT(*) as cnt
      FROM google_ads_hourly_snapshots hs
      GROUP BY hs.day_of_week
      ORDER BY hs.day_of_week
    `);
    console.log('\nStored day_of_week column values:');
    r2.rows.forEach(r => console.log(`  day_of_week=${r.day_of_week}: ${r.cnt} records`));

  } catch(e) { console.error('ERROR:', e.message); }
  pool.end();
}
test();
