/**
 * Test script for portfolios.history command
 * Usage: node test-history.js [portfolioId]
 *
 * Checks DB trade data and fires the history command, collecting all responses.
 */

const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');

const PORTFOLIO_ID = process.argv[2] || '6a292bb0f4c97f0698a701e9';
const MONGO_URI = 'mongodb://127.0.0.1:27017/ps2';
const LOGIN_URL = 'wss://localhost:3331';
const APP_URL = 'wss://localhost:3332';

async function checkDB(portfolioId) {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    const portfolio = await db.collection('portfolios').findOne({ _id: new ObjectId(portfolioId) });
    if (!portfolio) {
      console.log('❌ Portfolio not found in DB');
      return;
    }
    console.log(`\n📁 Portfolio: "${portfolio.name}" (type=${portfolio.portfolioType || 'normal'}, currency=${portfolio.currency})`);
    console.log(`   Created: ${new ObjectId(portfolioId).getTimestamp().toISOString().split('T')[0]}`);

    const trades = await db.collection('trades').find({ portfolioId }).toArray();
    console.log(`\n📊 Trades: ${trades.length} total`);

    if (trades.length > 0) {
      const byState = {};
      for (const t of trades) {
        byState[t.state] = (byState[t.state] || 0) + 1;
      }
      console.log(`   States: ${JSON.stringify(byState)}`);

      const activeTrades = trades.filter(t => t.state === '1' || t.state === 1);
      if (activeTrades.length > 0) {
        const dates = activeTrades.map(t => t.tradeTime.split('T')[0]).sort();
        const unique = [...new Set(dates)];
        console.log(`   Active trades: ${activeTrades.length}`);
        console.log(`   Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
        console.log(`   Distinct trade days: ${unique.length} (${unique.join(', ')})`);
        console.log(`   ⚠️  Expected history days: ${unique.length} (one per trading day)`);
      } else {
        console.log('   ⚠️  No active trades (state="1") — history will be empty');
      }
    }

    const histCount = await db.collection('portfolio_histories').countDocuments({ portfolioId });
    if (histCount > 0) {
      const records = await db.collection('portfolio_histories').find({ portfolioId }).sort({ date: 1 }).toArray();
      console.log(`\n📅 Cached history: ${histCount} records (${records[0].date} → ${records[histCount - 1].date})`);
    } else {
      console.log('\n📅 Cached history: none');
    }
  } finally {
    await client.close();
  }
}

async function authenticate() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(LOGIN_URL, { rejectUnauthorized: false });
    const timeout = setTimeout(() => reject(new Error('Login timeout')), 10000);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ login: 'admin', password: 'Test4545,' })));
    ws.on('message', (data) => {
      clearTimeout(timeout);
      const msg = JSON.parse(data.toString());
      ws.close();
      if (msg.token) resolve(msg.token);
      else reject(new Error(msg.error || 'Auth failed'));
    });
  });
}

async function sendHistoryCommand(token, portfolioId, forceRefresh = true) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(APP_URL, { rejectUnauthorized: false, headers: { 'ps2token': token } });
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout waiting for history response'));
    }, 120000);

    const responses = [];
    const fragmentBuffers = {};

    const cmd = {
      command: 'portfolios.history',
      _id: portfolioId,
      from: '',
      till: '',
      sample: '',
      detail: 0,
      precision: 2,
      forceRefresh,
      maxAge: 1440,
      streamUpdates: false,
      msgId: `test-history-${Date.now()}`
    };

    ws.on('error', reject);
    ws.on('open', () => {
      console.log(`\n📤 Sending: portfolios.history (forceRefresh=${forceRefresh})`);
      ws.send(JSON.stringify(cmd));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const { msgId = '', total = '1', index = '0' } = msg;

      if (!fragmentBuffers[msgId]) fragmentBuffers[msgId] = [];
      fragmentBuffers[msgId][Number(index)] = msg.data;

      if (fragmentBuffers[msgId].filter(Boolean).length === Number(total)) {
        const data = JSON.parse(fragmentBuffers[msgId].join(''));
        responses.push(data);

        const days = data.days || [];
        console.log(`\n📥 Response #${responses.length}:`);
        console.log(`   days: ${days.length}, cached: ${data.cached}, update: ${data.update || false}`);
        if (data.error) console.log(`   ❌ error: ${data.error}`);
        if (data.done) console.log('   ✅ done');
        if (data.info) console.log(`   ℹ️  ${data.info}`);
        if (days.length > 0) {
          console.log(`   First day: ${days[0].date}  nav=${days[0].nav}  invested=${days[0].invested}  cash=${days[0].cash}`);
          console.log(`   Last day:  ${days[days.length - 1].date}  nav=${days[days.length - 1].nav}`);
        }

        // Done when we get a 'done' flag or two responses (cached + update)
        if (data.done || (data.error) || responses.length >= 3) {
          clearTimeout(timeout);
          ws.close();
          resolve(responses);
        }
      }
    });

    // Close after no more messages for 5s
    ws.on('message', () => {
      clearTimeout(ws._idleTimeout);
      ws._idleTimeout = setTimeout(() => {
        clearTimeout(timeout);
        ws.close();
        resolve(responses);
      }, 5000);
    });
  });
}

(async () => {
  console.log(`🔍 Testing portfolios.history for: ${PORTFOLIO_ID}`);

  await checkDB(PORTFOLIO_ID);

  const token = await authenticate();
  console.log('\n✓ Authenticated');

  await sendHistoryCommand(token, PORTFOLIO_ID, true);

  console.log('\n✅ Done');
  process.exit(0);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
