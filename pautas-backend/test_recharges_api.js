const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers: { 'Authorization': 'Bearer ' + token } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.end();
  });
}

(async () => {
  const login = await post('http://localhost:3000/api/v1/auth/login', { username: 'admin', password: 'admin123' });
  const token = login.data.accessToken || login.data.token;

  const result = await get('http://localhost:3000/api/v1/pautadores/google-ads/billing/recharges?page=1&limit=5', token);
  console.log('Total recharges:', result.meta?.total);
  console.log('Showing', result.data?.length, 'records\n');

  if (result.data) {
    result.data.forEach((r, i) => {
      const last4 = (r.payments_account_id || '').replace(/-/g, '').slice(-4);
      const date = new Date(r.recharge_date);
      const fecha = date.toLocaleDateString('es-CO');
      const hora = date.toLocaleTimeString('es-CO');
      const tipo = r.proposal_type === 3 ? 'Recarga Manual' : r.proposal_type === 2 ? 'Pago Inicial' : 'Otro';
      console.log(`${i+1}. ${r.customer_account_name} | ID: ${r.customer_account_id} | ${fecha} ${hora} | $${r.recharge_amount} ${r.currency_code} | ····${last4} | ${tipo} | Perfil: ${r.payments_profile_name}`);
    });
  }
})().catch(console.error);
