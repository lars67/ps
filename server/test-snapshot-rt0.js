const WebSocket = require('ws');
const LOGIN = 'wss://localhost:3331';
const APP = 'wss://localhost:3332';
const MSGID = 'rt0test';
const PORTFOLIO = process.argv[2] || '69dbf8672a9c23ba6ab4fb4b';

function authenticate(username, password) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(LOGIN, { rejectUnauthorized: false, handshakeTimeout: 5000 });
    const t = setTimeout(() => { ws.close(); reject(new Error('login timeout')); }, 10000);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ login: username, password })));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.token) { clearTimeout(t); ws.close(); resolve(m.token); }
      else if (m.error) { clearTimeout(t); ws.close(); reject(new Error(m.error)); }
    });
  });
}
function fetchSnapshot(token, portfolioId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(APP, { rejectUnauthorized: false, headers: { ps2token: token }, handshakeTimeout: 5000 });
    const frags = {};
    const t = setTimeout(() => { ws.close(); reject(new Error('snapshot timeout')); }, 20000);
    const handle = (parsed) => {
      if (parsed && parsed.error) { clearTimeout(t); ws.close(); reject(new Error(parsed.error)); return; }
      if (parsed && Array.isArray(parsed.data)) { clearTimeout(t); setTimeout(() => ws.close(), 200); resolve(parsed.data); }
    };
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({
      command: 'portfolios.positions', _id: portfolioId, requestType: '0',
      marketPrice: '8', basePrice: '4', closed: 'no', includeAttribution: false, msgId: MSGID,
    })));
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.index !== undefined && msg.total !== undefined) {
        const key = msg.msgId;
        if (!frags[key]) frags[key] = new Array(msg.total).fill(null);
        frags[key][msg.index] = msg.data;
        if (frags[key].every((f) => f !== null)) { const full = JSON.parse(frags[key].join('')); delete frags[key]; handle(full); }
      } else { handle(msg); }
    });
  });
}
(async () => {
  const t0 = Date.now();
  const token = await authenticate('admin', 'Test4545,');
  const positions = await fetchSnapshot(token, PORTFOLIO);
  console.log(`\nGot ${positions.length} rows in ${Date.now() - t0}ms\n`);
  const holdings = positions.filter((p) => p.symbol && p.symbol.includes(':') && !p.symbol.endsWith(':FX'));
  let shells = 0;
  holdings.forEach((p) => {
    const baseEqSym = p.result != null && p.resultSymbol != null && p.currency !== 'EUR' && p.result === p.resultSymbol;
    const noPrice = !p.marketPrice;
    if (noPrice || baseEqSym) shells++;
    console.log(`${(noPrice || baseEqSym) ? '**' : 'ok'} ${p.symbol.padEnd(12)} ${String(p.currency).padEnd(4)} mp=${String(p.marketPrice).padEnd(9)} rate=${String(p.marketRate).padEnd(10)} result=${String(p.result).padEnd(12)} resultSym=${p.resultSymbol}`);
  });
  console.log(`\n${shells === 0 ? 'OK all priced, base result != symbol result' : 'BAD ' + shells + '/' + holdings.length + ' still shells'}\n`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
