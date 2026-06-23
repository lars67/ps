const WebSocket = require('ws');

async function authenticate(username, password) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://localhost:3331', { rejectUnauthorized: false });
    const timeout = setTimeout(() => reject(new Error('Login timeout')), 10000);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ login: username, password })));
    ws.on('message', (data) => {
      clearTimeout(timeout);
      const msg = JSON.parse(data.toString());
      ws.close();
      if (msg.token) resolve(msg.token);
      else reject(new Error(msg.error || 'Auth failed'));
    });
  });
}

async function sendCommand(token, cmd) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://localhost:3332', {
      rejectUnauthorized: false,
      headers: { 'ps2token': token }
    });
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Timeout')); }, 30000);
    const fragments = {};

    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify(cmd)));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      const { msgId = '', total, index } = msg;
      if (!fragments[msgId]) fragments[msgId] = [];
      fragments[msgId][index] = msg.data;
      if (fragments[msgId].length === Number(total)) {
        clearTimeout(timeout);
        ws.close();
        resolve(JSON.parse(fragments[msgId].join('')));
      }
    });
  });
}

(async () => {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'Test4545,';
  const symbol   = process.argv[4] || 'STIIAM.CO';
  const from     = process.argv[5] || '2024-01-01';

  console.log(`\nTesting tools.statistic — history: "${symbol}", from: "${from}"\n`);

  try {
    const token = await authenticate(username, password);
    console.log('✓ Authenticated');

    const result = await sendCommand(token, {
      command: 'tools.statistic',
      history: symbol,
      from,
      msgId: 'test-statistic-1'
    });

    console.log('\nResult:\n', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
