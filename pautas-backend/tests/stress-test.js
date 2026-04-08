/**
 * Stress Test Script - Pautas Backend
 * Escala conexiones: 100 -> 150 -> 200 -> 300 concurrentes
 * para encontrar el punto de quiebre.
 *
 * Uso: node tests/stress-test.js
 */

const autocannon = require('autocannon');

const BASE_URL = 'http://localhost:3000';
const DURATION = 30;
const LEVELS = [100, 150, 200, 300];

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.data.accessToken;
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
    `  Req total:     ${r.requests.total}`,
    `  Req/seg avg:   ${r.requests.average}`,
    `  Lat avg:       ${r.latency.average} ms`,
    `  Lat p50:       ${r.latency.p50} ms`,
    `  Lat p90:       ${r.latency.p90} ms`,
    `  Lat p99:       ${r.latency.p99} ms`,
    `  Lat max:       ${r.latency.max} ms`,
    `  Errores:       ${r.errors}`,
    `  Timeouts:      ${r.timeouts}`,
    `  2xx:           ${r['2xx']}`,
    `  Non-2xx:       ${r.non2xx}`,
  ].join('\n');
}

const ENDPOINTS = [
  { name: 'health',         path: '/api/v1/health',                    auth: false },
  { name: 'auth_me',        path: '/api/v1/auth/me',                   auth: true  },
  { name: 'admin_stats',    path: '/api/v1/admin/stats',               auth: true  },
  { name: 'admin_entries',  path: '/api/v1/admin/conglomerado-entries', auth: true  },
  { name: 'soporte_images', path: '/api/v1/gestion/soporte-images',    auth: true  },
];

async function main() {
  console.log('============================================================');
  console.log('      STRESS TEST - PAUTAS BACKEND');
  console.log(`      Niveles: ${LEVELS.join(', ')} conexiones`);
  console.log(`      ${DURATION}s por test`);
  console.log('============================================================');

  console.log('\n[SETUP] Obteniendo token...');
  const token = await login('admin', 'admin123');
  console.log('  Token OK\n');

  const allResults = {};

  for (const conns of LEVELS) {
    console.log('\n' + '#'.repeat(70));
    console.log(`##  NIVEL: ${conns} CONEXIONES CONCURRENTES`);
    console.log('#'.repeat(70));

    allResults[conns] = {};

    for (const ep of ENDPOINTS) {
      console.log(`\n--- ${ep.name} | ${conns} conexiones | ${DURATION}s ---`);
      console.log(`    ${ep.path}\n`);

      const opts = {
        url: `${BASE_URL}${ep.path}`,
        connections: conns,
        duration: DURATION,
      };
      if (ep.auth) {
        opts.headers = { Authorization: `Bearer ${token}` };
      }

      try {
        const result = await run(opts);
        allResults[conns][ep.name] = result;
        console.log(fmt(result));

        // If we got massive errors, warn but continue
        if (result.errors > 100 || result.timeouts > 50) {
          console.log(`\n  *** ALERTA: Muchos errores/timeouts en ${conns} conexiones ***`);
        }
      } catch (err) {
        console.error(`  ERROR ejecutando test: ${err.message}`);
        allResults[conns][ep.name] = null;
      }
    }
  }

  // ─── FINAL COMPARISON TABLE ──────────────────────────────
  console.log('\n\n' + '='.repeat(80));
  console.log('              COMPARATIVA POR NIVEL DE CARGA');
  console.log('='.repeat(80));

  for (const ep of ENDPOINTS) {
    console.log(`\n>> ${ep.name} (${ep.path})`);
    const rows = [];
    for (const conns of LEVELS) {
      const r = allResults[conns]?.[ep.name];
      if (!r) {
        rows.push({ conexiones: conns, 'req/s': 'FALLO', 'avg(ms)': '-', 'p99(ms)': '-', errors: '-', timeouts: '-', non2xx: '-' });
        continue;
      }
      rows.push({
        conexiones: conns,
        'req/s': r.requests.average,
        'avg(ms)': r.latency.average,
        'p99(ms)': r.latency.p99,
        errors: r.errors,
        timeouts: r.timeouts,
        non2xx: r.non2xx,
      });
    }
    console.table(rows);
  }

  // ─── ANALYSIS ──────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('              DIAGNOSTICO');
  console.log('='.repeat(80) + '\n');

  for (const conns of LEVELS) {
    let hasProblems = false;
    const issues = [];

    for (const ep of ENDPOINTS) {
      const r = allResults[conns]?.[ep.name];
      if (!r) { issues.push(`${ep.name}: TEST FALLO`); hasProblems = true; continue; }

      if (r.errors > 0) issues.push(`${ep.name}: ${r.errors} errores conexion`);
      if (r.timeouts > 0) issues.push(`${ep.name}: ${r.timeouts} timeouts`);
      if (r.latency.p99 > 5000) issues.push(`${ep.name}: p99=${r.latency.p99}ms (>5s)`);
      else if (r.latency.p99 > 3000) issues.push(`${ep.name}: p99=${r.latency.p99}ms (>3s)`);
      if (r.non2xx > r.requests.total * 0.05) issues.push(`${ep.name}: ${(r.non2xx/r.requests.total*100).toFixed(1)}% fallos`);

      if (r.errors > 0 || r.timeouts > 0 || r.latency.p99 > 5000) hasProblems = true;
    }

    if (issues.length === 0) {
      console.log(`  ${conns} conexiones: OK - sin problemas`);
    } else {
      console.log(`  ${conns} conexiones: ${hasProblems ? 'PROBLEMAS' : 'ALERTAS'}`);
      for (const i of issues) console.log(`    - ${i}`);
    }
  }

  console.log('\n-- LIMITES DEL SISTEMA --\n');
  console.log('  Pool DB:        40 conexiones (DB_MAX_CONNECTIONS)');
  console.log('  Node.js:        Single-threaded (1 CPU core)');
  console.log('  statement_timeout: 30s');
  console.log('  connection_timeout: 5s');
  console.log('\n  Si hay errores con 150+ conexiones, considere:');
  console.log('  1. PM2 cluster mode (usa todos los cores)');
  console.log('  2. Aumentar DB_MAX_CONNECTIONS a 60-80');
  console.log('  3. Nginx como reverse proxy con connection pooling');
  console.log('  4. PgBouncer para pooling de conexiones externo\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
