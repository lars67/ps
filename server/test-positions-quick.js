const WebSocket = require('ws');

/**
 * Quick Test: Portfolio Positions
 *
 * Fast test to verify portfolios.positions returns marketPrice field
 *
 * Usage:
 *   node test-positions-quick.js
 *
 * Uses defaults:
 *   Portfolio: 69dbf8672a9c23ba6ab4fb4b
 *   User: admin / Test4545,
 */

async function quickTest() {
  try {
    // Login
    const token = await new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://localhost:3331', { rejectUnauthorized: false });
      const timeout = setTimeout(() => reject(new Error('Login timeout')), 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ login: 'admin', password: 'Test4545,' }));
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        const msg = JSON.parse(data.toString());
        ws.close();
        msg.token ? resolve(msg.token) : reject(new Error(msg.error));
      });

      ws.on('error', reject);
    });

    // Get positions
    const positions = await new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://localhost:3332', {
        rejectUnauthorized: false,
        headers: { 'ps2token': token }
      });
      const timeout = setTimeout(() => reject(new Error('Positions timeout')), 8000);
      const fragments = {};

      ws.on('open', () => {
        ws.send(JSON.stringify({
          command: 'portfolios.positions',
          _id: '69dbf8672a9c23ba6ab4fb4b',
          requestType: '1',
          marketPrice: '4',
          basePrice: '4',
          msgId: 'quick-test'
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.index !== undefined && msg.total !== undefined) {
          if (!fragments[msg.msgId]) fragments[msg.msgId] = new Array(msg.total).fill('');
          fragments[msg.msgId][msg.index] = msg.data;

          if (fragments[msg.msgId].every(f => f !== '')) {
            const fullMsg = JSON.parse(fragments[msg.msgId].join(''));
            clearTimeout(timeout);
            ws.close();
            fullMsg.data?.positions ? resolve(fullMsg.data.positions) : reject(new Error(fullMsg.error));
          }
        } else {
          clearTimeout(timeout);
          ws.close();
          msg.data?.positions ? resolve(msg.data.positions) : reject(new Error(msg.error));
        }
      });

      ws.on('error', reject);
    });

    // Analyze - real stocks have exchange codes (SYMBOL:EXCHANGE)
    const stocks = positions.filter(p => p.symbol && p.symbol.includes(':'));
    const withMP = stocks.filter(p => 'marketPrice' in p).length;

    console.log(`\n✓ Got ${stocks.length} stocks`);
    console.log(`✓ ${withMP}/${stocks.length} have marketPrice field`);

    if (withMP === stocks.length) {
      console.log('\n🎉 SUCCESS: All stocks have marketPrice!\n');
      process.exit(0);
    } else {
      console.log(`\n❌ ISSUE: ${stocks.length - withMP} missing marketPrice\n`);
      process.exit(1);
    }
  } catch (err) {
    console.log(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

quickTest();
