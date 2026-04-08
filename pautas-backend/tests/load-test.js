/**
 * Load Test Script - Pautas Backend
 * Simula 50 usuarios concurrentes contra los endpoints principales.
 *
 * Uso: node tests/load-test.js
 *
 * REQUISITOS:
 *   - Backend corriendo en localhost:3000
 *   - Usuario admin con contraseña admin123
 */

const autocannon = require('autocannon');

const BASE_URL = 'http://localhost:3000';
const DURATION = 30; // seconds per test
const CONNECTIONS = 50; // concurrent users

// ─── HELPERS ───────────────────────────────────────────────────

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login ${username} failed: ${res.status}`);
  const data = await res.json();
  return data.data.accessToken;
}

async function createTestUser(adminToken) {
  const res = await fetch(`${BASE_URL}/api/v1/gestion/conglomerado-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      username: '_loadtest_user',
      full_name: 'Load Test User',
      country_id: 1,
      password: 'LoadTest2026!',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('duplicate') || body.includes('ya existe') || body.includes('23505')) {
      return null; // already exists
    }
    throw new Error(`Create test user failed: ${res.status} ${body}`);
  }
  return (await res.json()).data;
}

function run(opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

function fmt(r) {
  return [
    `  Requests total:  ${r.requests.total}`,
    `  Req/seg (avg):   ${r.requests.average}`,
    `  Latencia avg:    ${r.latency.average} ms`,
    `  Latencia p50:    ${r.latency.p50} ms`,
    `  Latencia p90:    ${r.latency.p90} ms`,
    `  Latencia p99:    ${r.latency.p99} ms`,
    `  Latencia max:    ${r.latency.max} ms`,
    `  Errores:         ${r.errors}`,
    `  Timeouts:        ${r.timeouts}`,
    `  2xx:             ${r['2xx']}`,
    `  Non-2xx:         ${r.non2xx}`,
  ].join('\n');
}

function header(n, title, endpoint) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST ${n}: ${title}`);
  console.log(`  ${endpoint}`);
  console.log(`  ${CONNECTIONS} conexiones, ${DURATION}s`);
  console.log('='.repeat(60) + '\n');
}

// ─── MAIN ──────────────────────────────────────────────────────

async function main() {
  console.log('============================================================');
  console.log('      PRUEBAS DE CARGA - PAUTAS BACKEND');
  console.log('      50 usuarios concurrentes / 30s por test');
  console.log('============================================================');

  // ─── STEP 1: Authenticate ──────────────────────────────────
  console.log('\n[SETUP] Obteniendo tokens...');
  const adminToken = await login('admin', 'admin123');
  console.log('  Admin token OK');

  // Create or login as conglomerado test user
  let congToken;
  try {
    await createTestUser(adminToken);
    await new Promise(r => setTimeout(r, 1500));
    congToken = await login('_loadtest_user', 'LoadTest2026!');
    console.log('  Conglomerado token OK');
  } catch (e) {
    console.warn(`  Conglomerado user setup: ${e.message}`);
    console.log('  Usando admin para tests posibles');
    congToken = null;
  }

  const results = {};

  // ─── TEST 1: Health (no auth, baseline) ────────────────────
  header(1, 'Health Check (sin auth, baseline)', 'GET /api/v1/health');
  results['1_health'] = await run({
    url: `${BASE_URL}/api/v1/health`,
    connections: CONNECTIONS,
    duration: DURATION,
  });
  console.log(fmt(results['1_health']));

  // ─── TEST 2: Auth /me (JWT decode + DB) ────────────────────
  header(2, 'Auth /me (JWT verify + DB query)', 'GET /api/v1/auth/me');
  results['2_auth_me'] = await run({
    url: `${BASE_URL}/api/v1/auth/me`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(fmt(results['2_auth_me']));

  // ─── TEST 3: Admin stats (multiple COUNT queries) ──────────
  header(3, 'Admin Stats (multiples COUNT + JOIN)', 'GET /api/v1/admin/stats');
  results['3_admin_stats'] = await run({
    url: `${BASE_URL}/api/v1/admin/stats`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(fmt(results['3_admin_stats']));

  // ─── TEST 4: Admin conglomerado entries (paginated) ────────
  header(4, 'Admin Entries (JOIN paginado)', 'GET /api/v1/admin/conglomerado-entries');
  results['4_admin_entries'] = await run({
    url: `${BASE_URL}/api/v1/admin/conglomerado-entries`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(fmt(results['4_admin_entries']));

  // ─── TEST 5: Soporte Images (JOIN heavy) ───────────────────
  header(5, 'Soporte Images (JOIN entries + images)', 'GET /api/v1/gestion/soporte-images');
  results['5_soporte_images'] = await run({
    url: `${BASE_URL}/api/v1/gestion/soporte-images`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(fmt(results['5_soporte_images']));

  // ─── TEST 6: Conglomerado check today ──────────────────────
  if (congToken) {
    header(6, 'Check Today Entry (alta frecuencia)', 'GET /api/v1/conglomerado/entry/today');
    results['6_check_today'] = await run({
      url: `${BASE_URL}/api/v1/conglomerado/entry/today`,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: { Authorization: `Bearer ${congToken}` },
    });
    console.log(fmt(results['6_check_today']));

    // ─── TEST 7: Conglomerado entries ────────────────────────
    header(7, 'Conglomerado Entries (lista propia)', 'GET /api/v1/conglomerado/entries');
    results['7_cong_entries'] = await run({
      url: `${BASE_URL}/api/v1/conglomerado/entries`,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: { Authorization: `Bearer ${congToken}` },
    });
    console.log(fmt(results['7_cong_entries']));

    // ─── TEST 8: Weekly Summary ──────────────────────────────
    header(8, 'Weekly Summary (SQL aggregation)', 'GET /api/v1/conglomerado/weekly-summary');
    results['8_weekly_summary'] = await run({
      url: `${BASE_URL}/api/v1/conglomerado/weekly-summary`,
      connections: CONNECTIONS,
      duration: DURATION,
      headers: { Authorization: `Bearer ${congToken}` },
    });
    console.log(fmt(results['8_weekly_summary']));
  }

  // ─── SUMMARY ───────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(70));
  console.log('                    RESUMEN DE RESULTADOS');
  console.log('='.repeat(70));

  const rows = [];
  for (const [name, r] of Object.entries(results)) {
    const issues = [];
    if (r.latency.p99 > 2000) issues.push('p99 alto');
    if (r.latency.average > 500) issues.push('avg alto');
    if (r.errors > 0) issues.push(`${r.errors} err`);
    if (r.timeouts > 0) issues.push(`${r.timeouts} timeout`);
    if (r.non2xx > 10) issues.push(`${r.non2xx} non-2xx`);

    rows.push({
      test: name.replace(/^\d+_/, ''),
      'req/s': r.requests.average,
      'avg(ms)': r.latency.average,
      'p99(ms)': r.latency.p99,
      errors: r.errors,
      non2xx: r.non2xx,
      status: issues.length === 0 ? 'OK' : issues.join(', '),
    });
  }
  console.table(rows);

  // ─── ANALYSIS ──────────────────────────────────────────────
  console.log('\n-- ANALISIS PARA 150 USUARIOS (50 CONCURRENTES) --\n');

  let critical = false;
  for (const [name, r] of Object.entries(results)) {
    const label = name.replace(/^\d+_/, '');
    if (r.errors > 0 || r.timeouts > 0) {
      console.log(`  [CRITICO] ${label}: ${r.errors} errores, ${r.timeouts} timeouts`);
      console.log(`            -> Pool de conexiones (20) insuficiente o query lenta`);
      critical = true;
    }
    if (r.latency.p99 > 3000) {
      console.log(`  [CRITICO] ${label}: p99=${r.latency.p99}ms - inaceptable`);
      critical = true;
    } else if (r.latency.p99 > 1000) {
      console.log(`  [ALERTA]  ${label}: p99=${r.latency.p99}ms - lentitud perceptible`);
    }
    if (r.non2xx > r.requests.total * 0.01) {
      console.log(`  [ALERTA]  ${label}: ${(r.non2xx / r.requests.total * 100).toFixed(1)}% non-2xx`);
    }
  }

  if (!critical) {
    console.log('  [OK] No se encontraron problemas criticos bajo esta carga.\n');
  }

  console.log('\n-- RECOMENDACIONES --\n');
  console.log('  1. DB_MAX_CONNECTIONS: Actual=20. Para 50 concurrentes, subir a 30-50');
  console.log('  2. Agregar indices si queries de reports son lentas');
  console.log('  3. Considerar Redis para cache de dashboard/KPIs si latencia > 500ms');
  console.log('  4. En produccion, usar PM2 con cluster mode (multiples workers)');
  console.log('  5. Monitorear uso de CPU/RAM durante carga real\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
