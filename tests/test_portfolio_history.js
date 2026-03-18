#!/usr/bin/env node
/**
 * Test: portfolios.history streaming (cached + incremental)
 *
 * Expects up to TWO responses per request when cache is stale:
 *   1st: { days: [...], cached: true }   — served immediately from DB
 *   2nd: { days: [...], update: true }   — new days appended
 *        OR { done: true }               — already up-to-date
 *
 * Usage:
 *   node test_portfolio_history.js [portfolioId1] [portfolioId2] ...
 *   node test_portfolio_history.js --concurrent [id1] [id2] ...
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const WebSocket = require('ws');

const LOGIN_URL = 'wss://localhost:3331/ps2l/';
const APP_URL   = 'wss://localhost:3332/ps2/';

const args = process.argv.slice(2);
const concurrent = args[0] === '--concurrent';
const portfolioIds = (concurrent ? args.slice(1) : args).filter(Boolean);
if (portfolioIds.length === 0) portfolioIds.push('69194e0499f9e462f3d38f7b');

// ── helpers ────────────────────────────────────────────────────────────────

function wsConnect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}

function doLogin(ws, user, pass) {
  return new Promise((res, rej) => {
    ws.once('message', raw => {
      const msg = JSON.parse(raw);
      if (msg.token) res(msg.token);
      else rej(new Error('Login failed: ' + JSON.stringify(msg)));
    });
    ws.send(JSON.stringify({ command: 'login', login: user, password: pass, msgId: `login_${Date.now()}` }));
  });
}

/**
 * Listen for all fragmented responses for a given msgId.
 * Resets fragment state on each index=0 (= start of new response).
 * Resolves when done/error/update is received, or on timeout.
 */
function collectResponses(ws, msgId, timeoutMs = 5 * 60 * 1000) {
  return new Promise((res, rej) => {
    const responses = [];
    let fragments = {};
    let expectedTotal = 0;

    const timer = setTimeout(() => {
      ws.off('message', handler);
      if (responses.length > 0) {
        console.log(`  [timeout] received ${responses.length} response(s) before timeout`);
        res(responses);
      } else {
        rej(new Error('Timeout: no response received'));
      }
    }, timeoutMs);

    function processMessage(parsed) {
      // parsed is the fully reassembled { command, msgId, data, error }
      const data = parsed.error
        ? { error: parsed.error }
        : (parsed.data || {});

      if (process.env.DEBUG_HISTORY) {
        console.log(`\n  [DEBUG] raw keys: ${Object.keys(data).join(', ')}  cached=${data.cached}  done=${data.done}  update=${data.update}  days=${data.days?.length}`);
      }

      responses.push(data);

      // Termination conditions:
      // - done / error → final
      // - update → final (second streaming response with new days)
      // - days present but NOT cached=true → full calculation result, final
      const isFinalResponse =
        data.done ||
        data.error ||
        data.update ||
        (data.days && !data.cached);  // full calc or non-streaming result

      if (isFinalResponse) {
        ws.off('message', handler);
        clearTimeout(timer);
        res(responses);
        return;
      }
      // cached=true with days → first streaming response, keep listening for second
    }

    function handler(raw) {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.msgId !== msgId) return;

      if (msg.total == null || msg.total === 0) {
        // Shouldn't happen, but handle non-fragmented
        processMessage(msg);
        return;
      }

      if (msg.total === 1) {
        // Single-fragment response — still goes through sendFragmented
        const body = msg.data || '';
        try { processMessage(JSON.parse(body)); } catch (e) {
          ws.off('message', handler);
          clearTimeout(timer);
          rej(new Error('Parse error: ' + e.message));
        }
        return;
      }

      // Multi-fragment: reset on index=0 (new response starting)
      if (msg.index === 0) {
        fragments = {};
        expectedTotal = msg.total;
      }
      fragments[msg.index] = msg.data || '';
      const received = Object.keys(fragments).length;

      process.stdout.write(`\r    [${msgId.slice(-8)}] fragment ${received}/${expectedTotal}   `);

      if (received < expectedTotal) return;

      // All fragments received — reassemble
      console.log('');
      const body = Array.from({ length: expectedTotal }, (_, i) => fragments[i] || '').join('');
      fragments = {};
      expectedTotal = 0;

      let assembled;
      try { assembled = JSON.parse(body); } catch (e) {
        ws.off('message', handler);
        clearTimeout(timer);
        return rej(new Error('Fragment reassembly parse error: ' + e.message));
      }
      processMessage(assembled);
    }

    ws.on('message', handler);
  });
}

function sendHistory(ws, portfolioId, extra = {}) {
  const msgId = `hist_${portfolioId.slice(-6)}_${Date.now()}`;
  ws.send(JSON.stringify({ command: 'portfolios.history', _id: portfolioId, msgId, detail: '0', ...extra }));
  return msgId;
}

function summarize(resp, label) {
  const days = resp.days || [];
  const flags = [
    resp.cached ? `cached` : null,
    resp.update ? `update` : null,
    resp.done   ? `done`   : null,
    resp.error  ? `ERROR: ${resp.error}` : null,
    resp.info   ? resp.info : null,
  ].filter(Boolean).join(', ');

  if (days.length > 0) {
    const first = days[0], last = days[days.length - 1];
    const cacheStr = resp.cacheAge != null ? `  cacheAge=${resp.cacheAge}min` : '';
    console.log(`  ${label}: ${days.length} days  [${first.date} → ${last.date}]  ${flags}${cacheStr}`);
    console.log(`    last day: nav=${last.nav}  invested=${last.invested}  cash=${last.cash}  perfShare=${last.perfShare}`);
  } else {
    console.log(`  ${label}: (no days)  ${flags || '(empty)'}`);
  }
}

// ── single portfolio test ──────────────────────────────────────────────────

async function testPortfolio(ws, portfolioId) {
  const label = portfolioId.slice(-6);

  // A: Normal (cache-first + incremental)
  console.log(`\n[${label}] TEST A: normal (forceRefresh=false)`);
  let t = Date.now();
  const msgA = sendHistory(ws, portfolioId);
  const rA = await collectResponses(ws, msgA);
  console.log(`  ${rA.length} response(s) in ${((Date.now()-t)/1000).toFixed(1)}s`);
  rA.forEach((r, i) => summarize(r, `  R${i+1}`));

  // B: Force full recalculation
  console.log(`\n[${label}] TEST B: forceRefresh=true (full recalc, may be slow)`);
  t = Date.now();
  const msgB = sendHistory(ws, portfolioId, { forceRefresh: true });
  const rB = await collectResponses(ws, msgB);
  console.log(`  ${rB.length} response(s) in ${((Date.now()-t)/1000).toFixed(1)}s`);
  rB.forEach((r, i) => summarize(r, `  R${i+1}`));

  // C: Repeat — should be fully cached, single response
  console.log(`\n[${label}] TEST C: repeat normal (should be cached, fast)`);
  t = Date.now();
  const msgC = sendHistory(ws, portfolioId);
  const rC = await collectResponses(ws, msgC);
  console.log(`  ${rC.length} response(s) in ${((Date.now()-t)/1000).toFixed(1)}s`);
  rC.forEach((r, i) => summarize(r, `  R${i+1}`));
}

// ── concurrent multi-portfolio test ───────────────────────────────────────

async function testConcurrent(ws, ids) {
  console.log(`\n=== CONCURRENT TEST: ${ids.length} portfolios in parallel ===`);
  const t = Date.now();

  const tasks = ids.map(id => {
    const msgId = sendHistory(ws, id);
    return collectResponses(ws, msgId).then(responses => ({ id, responses }));
  });

  const results = await Promise.all(tasks);
  const elapsed = ((Date.now() - t) / 1000).toFixed(1);

  console.log(`\nAll ${ids.length} completed in ${elapsed}s total`);
  for (const { id, responses } of results) {
    console.log(`\n  Portfolio ${id.slice(-6)}:`);
    responses.forEach((r, i) => summarize(r, `    R${i+1}`));
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== portfolios.history test ===`);
  console.log(`Portfolios: ${portfolioIds.join(', ')}`);
  console.log(`Mode: ${concurrent ? 'concurrent' : 'sequential'}\n`);

  // Login
  process.stdout.write('Logging in... ');
  const loginWs = await wsConnect(LOGIN_URL);
  const token = await doLogin(loginWs, 'admin', '111111');
  loginWs.close();
  console.log('OK');

  // App WS
  process.stdout.write('Connecting to app... ');
  const appWs = await wsConnect(APP_URL + `?${token}`);
  console.log('OK\n');

  try {
    if (concurrent) {
      await testConcurrent(appWs, portfolioIds);
    } else {
      for (const id of portfolioIds) {
        await testPortfolio(appWs, id);
        console.log('');
      }
    }
  } finally {
    appWs.close();
  }

  console.log('\n=== Done ===\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
