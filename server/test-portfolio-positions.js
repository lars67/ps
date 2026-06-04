const WebSocket = require('ws');

/**
 * Test: Portfolio Positions with marketPrice
 *
 * Tests the portfolios.positions command with marketPrice: "4" (latestPrice or close + change)
 * Validates that all stock positions include marketPrice, price, and volume fields
 *
 * Usage:
 *   node test-portfolio-positions.js [portfolioId] [username] [password]
 *
 * Example:
 *   node test-portfolio-positions.js 69dbf8672a9c23ba6ab4fb4b admin "Test4545,"
 */

async function testPortfolioPositions(portfolioId, username, password) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       Portfolio Positions - marketPrice Test              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Step 1: Authenticate
  console.log('[1/3] Authenticating...');
  const token = await authenticate(username, password);
  if (!token) {
    console.error('❌ Authentication failed');
    process.exit(1);
  }
  console.log('✓ Authenticated\n');

  // Step 2: Request portfolio positions
  console.log('[2/3] Fetching portfolio positions...');
  console.log(`    Portfolio: ${portfolioId}`);
  console.log(`    marketPrice: "4" (latestPrice or close + change)`);
  console.log(`    basePrice: "4"\n`);

  const positions = await fetchPortfolioPositions(token, portfolioId);
  if (!positions) {
    console.error('❌ Failed to fetch positions');
    process.exit(1);
  }

  // Step 3: Analyze results
  console.log('[3/3] Analyzing results...\n');
  analyzePositions(positions);
}

async function authenticate(username, password) {
  return new Promise((resolve, reject) => {
    const loginWs = new WebSocket('wss://localhost:3331', {
      rejectUnauthorized: false,
      handshakeTimeout: 5000
    });

    const timeout = setTimeout(() => {
      reject(new Error('Login timeout'));
    }, 10000);

    loginWs.on('error', reject);
    loginWs.on('open', () => {
      loginWs.send(JSON.stringify({ login: username, password }));
    });

    loginWs.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const msg = JSON.parse(data.toString());
        if (msg.token) {
          loginWs.close();
          resolve(msg.token);
        } else if (msg.error) {
          loginWs.close();
          reject(new Error(msg.error));
        }
      } catch (err) {
        loginWs.close();
        reject(err);
      }
    });
  });
}

async function fetchPortfolioPositions(token, portfolioId) {
  return new Promise((resolve, reject) => {
    const appWs = new WebSocket('wss://localhost:3332', {
      rejectUnauthorized: false,
      headers: { 'ps2token': token },
      handshakeTimeout: 5000
    });

    const timeout = setTimeout(() => {
      appWs.close();
      reject(new Error('Portfolio request timeout'));
    }, 10000);

    const fragments = {};

    appWs.on('error', reject);

    appWs.on('open', () => {
      appWs.send(JSON.stringify({
        command: 'portfolios.positions',
        _id: portfolioId,
        requestType: '1',
        marketPrice: '4',
        basePrice: '4',
        msgId: 'test-portfolio-positions'
      }));
    });

    appWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle fragmented messages
        if (msg.index !== undefined && msg.total !== undefined) {
          if (!fragments[msg.msgId]) {
            fragments[msg.msgId] = new Array(msg.total).fill('');
          }
          fragments[msg.msgId][msg.index] = msg.data;

          // Check if all fragments received
          if (fragments[msg.msgId].every(f => f !== '')) {
            const fullData = fragments[msg.msgId].join('');
            const fullMsg = JSON.parse(fullData);
            clearTimeout(timeout);
            appWs.close();

            if (fullMsg.data && fullMsg.data.positions) {
              resolve(fullMsg.data.positions);
            } else if (fullMsg.error) {
              reject(new Error(fullMsg.error));
            }
            delete fragments[msg.msgId];
          }
        } else {
          // Non-fragmented message
          clearTimeout(timeout);
          appWs.close();

          if (msg.data && msg.data.positions) {
            resolve(msg.data.positions);
          } else if (msg.error) {
            reject(new Error(msg.error));
          }
        }
      } catch (err) {
        clearTimeout(timeout);
        appWs.close();
        reject(err);
      }
    });
  });
}

function analyzePositions(positions) {
  // Separate stocks from totals
  // Real stocks have exchange codes (format: SYMBOL:EXCHANGE)
  const stocks = positions.filter(p => p.symbol && p.symbol.includes(':'));
  const totals = positions.filter(p => !p.symbol || !p.symbol.includes(':'));

  console.log(`📊 Portfolio Structure:`);
  console.log(`   Total positions: ${positions.length}`);
  console.log(`   Stocks: ${stocks.length}`);
  console.log(`   Aggregates: ${totals.length}\n`);

  // Analyze stocks
  let stockStats = analyzeGroup('Stock Positions', stocks);

  // Analyze totals (these legitimately don't have marketPrice)
  let totalStats = { complete: totals.length, incomplete: 0 };

  console.log(`\n📈 Summary:\n`);
  console.log(`Stocks (actual holdings):`);
  console.log(`   ✓ Complete: ${stockStats.complete}/${stocks.length}`);
  if (stockStats.incomplete > 0) {
    console.log(`   ❌ Incomplete: ${stockStats.incomplete}`);
  }

  console.log(`\nAggregates (summation rows):`);
  console.log(`   ${totals.length} summary rows (legitimately no individual market prices)`);

  // Overall status
  console.log(`\n${'─'.repeat(60)}`);
  if (stockStats.complete === stocks.length && stocks.length > 0) {
    console.log('🎉 SUCCESS: All stock positions have marketPrice field!');
  } else if (stockStats.complete > 0) {
    console.log(`⚠️  PARTIAL: ${stockStats.complete}/${stocks.length} stocks have complete data`);
  } else {
    console.log('❌ ISSUE: Stock positions missing marketPrice');
  }
  console.log(`${'─'.repeat(60)}\n`);
}

function analyzeGroup(groupName, positions) {
  let complete = 0;
  let incomplete = 0;
  const issues = [];

  positions.forEach((pos) => {
    const hasMarketPrice = 'marketPrice' in pos;
    const hasPrice = 'price' in pos || 'bprice' in pos;
    const hasVolume = 'volume' in pos;

    if (hasMarketPrice && hasPrice && hasVolume) {
      complete++;
    } else {
      incomplete++;
      const missing = [];
      if (!hasMarketPrice) missing.push('marketPrice');
      if (!hasPrice) missing.push('price');
      if (!hasVolume) missing.push('volume');

      issues.push({
        symbol: pos.symbol,
        missing: missing.join(', '),
        fields: Object.keys(pos).length
      });
    }
  });

  // Display detailed output
  if (complete > 0) {
    console.log(`\n${groupName}:`);
    console.log(`   ✓ ${complete} with complete data (${Object.keys(positions[0] || {}).length} fields each)`);
  }

  if (incomplete > 0) {
    console.log(`   ❌ ${incomplete} incomplete:`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`      • ${issue.symbol}: missing ${issue.missing}`);
    });
    if (issues.length > 5) {
      console.log(`      ... and ${issues.length - 5} more`);
    }
  }

  return { complete, incomplete };
}

// Parse command line arguments
const args = process.argv.slice(2);
const portfolioId = args[0] || '69dbf8672a9c23ba6ab4fb4b';
const username = args[1] || 'admin';
const password = args[2] || 'Test4545,';

// Run test
testPortfolioPositions(portfolioId, username, password)
  .then(() => {
    console.log('✅ Test complete\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err.message, '\n');
    process.exit(1);
  });
