/**
 * PS2 MCP Smoke Test
 *
 * Exercises every PS2 API command in a realistic end-to-end sequence:
 *   create portfolio → fund it → trade → inspect → modify → clean up
 *
 * Usage:
 *   PS2_LOGIN=yourlogin PS2_PASSWORD=yourpass npx tsx test/smoke.ts
 *
 * Optional env overrides:
 *   PS2_HOST        (default: top.softcapital.com)
 *   PS2_LOGIN_PORT  (default: 3331)
 *   PS2_APP_PORT    (default: 3332)
 *   PS2_SSL         (default: true;  set to "false" for local HTTP dev server)
 *   PS2_TIMEOUT     (default: 30000)
 */

import { PS2Client, configFromEnv } from '../src/client.ts';

// ─── Tiny test harness ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function ok(label: string, value: unknown): void {
  if (value) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}  (got: ${JSON.stringify(value)})`);
    failed++;
    errors.push(label);
  }
}

function section(title: string): void {
  console.log(`\n━━━ ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasField(obj: unknown, field: string): boolean {
  return typeof obj === 'object' && obj !== null && field in (obj as Record<string, unknown>);
}

function isNonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function getField(obj: unknown, field: string): unknown {
  if (typeof obj === 'object' && obj !== null) {
    return (obj as Record<string, unknown>)[field];
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const client = new PS2Client(configFromEnv());
const PORTFOLIO_NAME = `_smoke_${Date.now()}`;

console.log(`\nPS2 Smoke Test — portfolio: ${PORTFOLIO_NAME}`);
console.log(`Server: ${process.env.PS2_SSL !== 'false' ? 'wss' : 'ws'}://${process.env.PS2_HOST ?? 'top.softcapital.com'}`);

// Track IDs across steps
let portfolioId = '';
let trade1Id = '';   // first buy — will be updated then removed
let trade2Id = '';   // second buy — kept through removeAll
let trade3Id = '';   // sell trade

try {
  // ── 1. PORTFOLIOS.LIST (baseline) ─────────────────────────────────────────
  section('portfolios.list — baseline');
  {
    const list = await client.send('portfolios.list', { filter: {} });
    ok('returns an array', Array.isArray(list));
    console.log(`     ${(list as unknown[]).length} existing portfolio(s)`);
  }

  // ── 2. PORTFOLIOS.ADD ──────────────────────────────────────────────────────
  section('portfolios.add');
  {
    const p = await client.send('portfolios.add', {
      name: PORTFOLIO_NAME,
      currency: 'USD',
      baseInstrument: 'SPY',
      description: 'Created by MCP smoke test',
    });
    ok('has _id', hasField(p, '_id'));
    ok('name matches', getField(p, 'name') === PORTFOLIO_NAME);
    ok('currency is USD', getField(p, 'currency') === 'USD');
    portfolioId = getField(p, '_id') as string;
    console.log(`     portfolioId: ${portfolioId}`);
  }

  // ── 3. PORTFOLIOS.LIST (filtered) ─────────────────────────────────────────
  section('portfolios.list — filtered by name');
  {
    const list = await client.send('portfolios.list', { filter: { name: PORTFOLIO_NAME } });
    ok('finds exactly 1', Array.isArray(list) && (list as unknown[]).length === 1);
    ok('_id matches', getField((list as unknown[])[0], '_id') === portfolioId);
  }

  // ── 4. PORTFOLIOS.UPDATE ───────────────────────────────────────────────────
  section('portfolios.update');
  {
    const updated = await client.send('portfolios.update', {
      _id: portfolioId,
      description: 'Updated by smoke test',
      baseInstrument: 'QQQ',
    });
    ok('returns object', typeof updated === 'object' && updated !== null);
    console.log(`     ${JSON.stringify(updated).slice(0, 80)}`);
  }

  // ── 5. PORTFOLIOS.PUT_CASH — initial investment ────────────────────────────
  section('portfolios.putCash — seed investment');
  {
    const cash = await client.send('portfolios.putCash', {
      portfolioId,
      amount: 100000,
      currency: 'USD',
      tradeTime: '2024-01-01T08:00:00',
      description: 'Initial investment',
      tradeType: 'investment',
    });
    ok('returns object', typeof cash === 'object' && cash !== null);
    console.log(`     ${JSON.stringify(cash).slice(0, 120)}`);
  }

  // ── 6. TRADES.ADD — buy AAPL ──────────────────────────────────────────────
  section('trades.add — buy AAPL');
  {
    const t = await client.send('trades.add', {
      portfolioId,
      tradeType: '1',
      side: 'B',
      symbol: 'AAPL',
      volume: 50,
      price: 182.68,
      currency: 'USD',
      rate: 1,
      fee: 2.74,
      tradeTime: '2024-01-10T09:30:00',
      description: 'Buy AAPL',
    });
    ok('has _id', hasField(t, '_id'));
    trade1Id = getField(t, '_id') as string;
    console.log(`     trade1Id: ${trade1Id}`);
  }

  // ── 7. TRADES.ADD — buy INTC ──────────────────────────────────────────────
  section('trades.add — buy INTC');
  {
    const t = await client.send('trades.add', {
      portfolioId,
      tradeType: '1',
      side: 'B',
      symbol: 'INTC',
      volume: 200,
      price: 47.25,
      currency: 'USD',
      rate: 1,
      fee: 3.78,
      tradeTime: '2024-01-10T09:31:00',
      description: 'Buy INTC',
    });
    ok('has _id', hasField(t, '_id'));
    trade2Id = getField(t, '_id') as string;
    console.log(`     trade2Id: ${trade2Id}`);
  }

  // ── 8. TRADES.ADD — buy SPY ───────────────────────────────────────────────
  section('trades.add — buy SPY');
  {
    const t = await client.send('trades.add', {
      portfolioId,
      tradeType: '1',
      side: 'B',
      symbol: 'SPY',
      volume: 30,
      price: 476.07,
      currency: 'USD',
      rate: 1,
      fee: 5.71,
      tradeTime: '2024-01-10T09:32:00',
    });
    ok('has _id', hasField(t, '_id'));
    trade3Id = getField(t, '_id') as string;
  }

  // ── 9. TRADES.LIST ────────────────────────────────────────────────────────
  section('trades.list — filter by portfolioId');
  {
    const trades = await client.send('trades.list', { filter: { portfolioId } });
    ok('returns array', Array.isArray(trades));
    ok('has trades', (trades as unknown[]).length >= 3);
    console.log(`     ${(trades as unknown[]).length} trade(s) returned`);
  }

  // ── 9b. PORTFOLIOS.TRADES ─────────────────────────────────────────────────
  section('portfolio.trades');
  {
    const trades = await client.send('portfolio.trades', { _id: portfolioId });
    ok('returns array', Array.isArray(trades));
    console.log(`     ${(trades as unknown[]).length} trade(s) returned`);
  }

  // ── 10. PRICES.HISTORICAL — single date ───────────────────────────────────
  section('prices.historical — single date');
  {
    const prices = await client.send('prices.historical', {
      symbols: 'AAPL,INTC,SPY',
      date: '2024-01-10',
    });
    ok('has AAPL', hasField(prices, 'AAPL'));
    ok('has INTC', hasField(prices, 'INTC'));
    ok('has SPY', hasField(prices, 'SPY'));
    console.log(`     ${JSON.stringify(prices)}`);
  }

  // ── 11. PRICES.HISTORICAL — date range ────────────────────────────────────
  section('prices.historical — date range');
  {
    const prices = await client.send('prices.historical', {
      symbols: 'AAPL,SPY',
      from: '2024-01-08',
      till: '2024-01-12',
    });
    ok('returns array', Array.isArray(prices));
    ok('entries have date', isNonEmptyArray(prices) &&
      hasField((prices as unknown[])[0], 'date'));
    console.log(`     ${(prices as unknown[]).length} date entries`);
  }

  // ── 12. PORTFOLIOS.POSITIONS ───────────────────────────────────────────────
  section('portfolios.positions');
  {
    const pos = await client.send('portfolios.positions', {
      _id: portfolioId,
      requestType: '0',
      marketType: 4,
    });
    ok('returns object', typeof pos === 'object' && pos !== null);
    console.log(`     positions keys: ${Object.keys(pos as object).join(', ')}`);
  }

  // ── 13. PORTFOLIOS.HISTORY ─────────────────────────────────────────────────
  section('portfolios.history — summary');
  {
    const hist = await client.send('portfolios.history', {
      _id: portfolioId,
      from: '2024-01-01',
      till: '2024-01-31',
      sample: 1,
      detail: 0,
    });
    ok('has days array', hasField(hist, 'days'));
    const days = getField(hist, 'days') as unknown[];
    ok('days is array', Array.isArray(days));
    console.log(`     ${days?.length} day entries`);
  }

  // ── 14. PORTFOLIOS.HISTORY with detail ────────────────────────────────────
  section('portfolios.history — detail=1');
  {
    const hist = await client.send('portfolios.history', {
      _id: portfolioId,
      from: '2024-01-01',
      sample: 0,
      detail: 1,
    });
    ok('has days', hasField(hist, 'days'));
    ok('has details', hasField(hist, 'details'));
  }

  // ── 15. TRADES.ADD — sell half AAPL ──────────────────────────────────────
  section('trades.add — sell AAPL (partial)');
  {
    const t = await client.send('trades.add', {
      portfolioId,
      tradeType: '1',
      side: 'S',
      symbol: 'AAPL',
      volume: 25,
      price: 193.12,
      currency: 'USD',
      rate: 1,
      fee: 1.93,
      tradeTime: '2024-01-29T10:00:00',
      description: 'Partial sell AAPL',
    });
    ok('has _id', hasField(t, '_id'));
    console.log(`     sell trade _id: ${getField(t, '_id')}`);
  }

  // ── 16. PORTFOLIOS.PUT_CASH — additional deposit ──────────────────────────
  section('portfolios.putCash — additional deposit');
  {
    const r = await client.send('portfolios.putCash', {
      portfolioId,
      amount: 25000,
      currency: 'USD',
      tradeTime: '2024-02-01T08:00:00',
      description: 'Top-up',
    });
    ok('returns object', typeof r === 'object' && r !== null);
  }

  // ── 17. PORTFOLIOS.PUT_DIVIDENDS ──────────────────────────────────────────
  section('portfolios.putDividends — AAPL dividend');
  {
    const r = await client.send('portfolios.putDividends', {
      portfolioId,
      symbol: 'AAPL',
      amount: 0.24,
      currency: 'USD',
      tradeTime: '2024-02-15T00:00:00',
      description: 'Q1 dividend',
    });
    ok('returns object', typeof r === 'object' && r !== null);
    console.log(`     ${JSON.stringify(r).slice(0, 100)}`);
  }

  // ── 18. TRADES.UPDATE ─────────────────────────────────────────────────────
  section('trades.update — correct AAPL buy fee');
  {
    const r = await client.send('trades.update', {
      _id: trade1Id,
      fee: 2.00,
      description: 'Buy AAPL (corrected fee)',
    });
    ok('returns object', typeof r === 'object' && r !== null);
    console.log(`     ${JSON.stringify(r).slice(0, 100)}`);
  }

  // ── 19. TOOLS.STATISTIC — portfolio ───────────────────────────────────────
  section('tools.statistic — portfolio');
  {
    const stats = await client.send('tools.statistic', { portfolio: portfolioId });
    ok('returns object', typeof stats === 'object' && stats !== null);
    console.log(`     stats keys: ${Object.keys(stats as object).join(', ')}`);
  }

  // ── 20. TOOLS.STATISTIC — historical symbol ───────────────────────────────
  section('tools.statistic — SPY historical');
  {
    const stats = await client.send('tools.statistic', {
      history: 'SPY',
      from: '2022-01-03',
      till: '2023-12-29',
    });
    ok('returns object', typeof stats === 'object' && stats !== null);
    console.log(`     stats keys: ${Object.keys(stats as object).join(', ')}`);
  }

  // ── 21. TRADES.REMOVE — remove one trade ──────────────────────────────────
  section('trades.remove — remove INTC trade');
  {
    const r = await client.send('trades.remove', { _id: trade2Id });
    ok('returns object', typeof r === 'object' && r !== null);
    console.log(`     removed: ${JSON.stringify(r).slice(0, 80)}`);
  }

  // ── 22. PORTFOLIO.TRADES — verify removal ─────────────────────────────────
  section('portfolio.trades — verify INTC removed');
  {
    const trades = await client.send('portfolio.trades', { _id: portfolioId });
    const ids = (trades as Array<Record<string, unknown>>).map((t) => t._id);
    ok('trade2Id no longer present', !ids.includes(trade2Id));
    console.log(`     ${(trades as unknown[]).length} trade(s) remaining`);
  }

  // ── 23. TRADES.REMOVE_ALL ─────────────────────────────────────────────────
  section('trades.removeAll — wipe portfolio');
  {
    const r = await client.send('trades.removeAll', { portfolioId });
    ok('returns object', typeof r === 'object' && r !== null);
    console.log(`     ${JSON.stringify(r).slice(0, 80)}`);
  }

  // ── 24. PORTFOLIO.TRADES — verify empty ───────────────────────────────────
  section('portfolio.trades — verify empty after removeAll');
  {
    const trades = await client.send('portfolio.trades', { _id: portfolioId });
    ok('empty array', Array.isArray(trades) && (trades as unknown[]).length === 0);
  }

  // ── 25. PORTFOLIOS.REMOVE ─────────────────────────────────────────────────
  section('portfolios.remove — clean up test portfolio');
  {
    const r = await client.send('portfolios.remove', { _id: portfolioId });
    ok('removed _id matches', getField(r, '_id') === portfolioId);
    console.log(`     removed: ${getField(r, 'name')}`);
  }

  // ── 26. PORTFOLIOS.LIST — confirm gone ────────────────────────────────────
  section('portfolios.list — confirm portfolio deleted');
  {
    const list = await client.send('portfolios.list', { filter: { name: PORTFOLIO_NAME } });
    ok('portfolio no longer found', Array.isArray(list) && (list as unknown[]).length === 0);
  }

} catch (err) {
  console.error('\n💥 Unexpected error:', err);
  failed++;
} finally {
  client.disconnect();
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed assertions:');
  errors.forEach((e) => console.log(`  • ${e}`));
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
