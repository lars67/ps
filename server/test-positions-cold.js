const WebSocket = require('ws');

/**
 * Cold/warm snapshot test for portfolios.positions (requestType "1", subscribe).
 *
 * Unlike test-portfolio-positions.js, this harness:
 *   - sends the exact params the web client sends (forceRefresh/maxAge/closed/...),
 *   - ignores the synchronous {msg:"subscribed"} ack,
 *   - reassembles fragments and waits for the actual snapshot (data is the
 *     positions ARRAY, sent asynchronously once quotes resolve),
 *   - flags any holding (SYMBOL:EXCHANGE) missing volume or marketPrice,
 *   - unsubscribes and exits.
 *
 * Usage: node test-positions-cold.js [portfolioId] [username] [password]
 */

const LOGIN = 'wss://localhost:3331';
const APP = 'wss://localhost:3332';
const MSGID = 'portfolioPositions';

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
    const ws = new WebSocket(APP, {
      rejectUnauthorized: false, headers: { ps2token: token }, handshakeTimeout: 5000,
    });
    const frags = {};
    const t = setTimeout(() => { ws.close(); reject(new Error('snapshot timeout (no array payload received)')); }, 15000);

    const handle = (parsed) => {
      // Ack for the subscribe / unsubscribe; keep waiting for the array snapshot.
      if (parsed && parsed.data && !Array.isArray(parsed.data)) return;
      if (parsed && parsed.error) { clearTimeout(t); ws.close(); reject(new Error(parsed.error)); return; }
      if (parsed && Array.isArray(parsed.data)) {
        clearTimeout(t);
        ws.send(JSON.stringify({ command: 'portfolios.positions', requestType: '2', subscribeId: MSGID, msgId: MSGID }));
        setTimeout(() => ws.close(), 200);
        resolve(parsed.data);
      }
    };

    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({
      command: 'portfolios.positions', _id: portfolioId, requestType: '1',
      marketPrice: '4', basePrice: '4', closed: 'no', totalsMode: 'all',
      includeAttribution: false, forceRefresh: true, maxAge: 0, msgId: MSGID,
    })));

    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.index !== undefined && msg.total !== undefined) {
        const key = msg.msgId;
        if (!frags[key]) frags[key] = new Array(msg.total).fill(null);
        frags[key][msg.index] = msg.data;
        if (frags[key].every((f) => f !== null)) {
          const full = JSON.parse(frags[key].join(''));
          delete frags[key];
          handle(full);
        }
      } else {
        handle(msg);
      }
    });
  });
}

function analyze(positions) {
  const holdings = positions.filter((p) => p.symbol && p.symbol.includes(':') && !p.symbol.endsWith(':FX'));
  console.log(`\nReceived ${positions.length} rows; ${holdings.length} holdings (SYMBOL:EXCHANGE)\n`);
  let bad = 0;
  holdings.forEach((p) => {
    const hasVol = p.volume !== undefined && p.volume !== null;
    const hasMP = p.marketPrice !== undefined && p.marketPrice !== null;
    const ok = hasVol && hasMP;
    if (!ok) bad++;
    console.log(
      `${ok ? '  ok ' : '  ** '}${p.symbol.padEnd(14)} ` +
      `vol=${hasVol ? p.volume : 'MISSING'}  ` +
      `mp=${hasMP ? p.marketPrice : 'MISSING'}  ` +
      `mvSym=${p.marketValueSymbol ?? 'MISSING'}`,
    );
  });
  console.log(`\n${bad === 0 ? '✅ All holdings complete (volume + marketPrice)' : `❌ ${bad}/${holdings.length} holdings are empty shells`}\n`);
  return bad;
}

(async () => {
  const [portfolioId = '6a292b45f4c97f0698a6ff65', username = 'admin', password = 'Test4545,'] = process.argv.slice(2);
  console.log('Login...');
  const token = await authenticate(username, password);
  console.log('Requesting snapshot (requestType 1, forceRefresh, maxAge 0)...');
  const positions = await fetchSnapshot(token, portfolioId);
  const bad = analyze(positions);
  process.exit(bad === 0 ? 0 : 2);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
