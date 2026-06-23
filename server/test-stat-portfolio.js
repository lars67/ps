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
    const ws = new WebSocket('wss://localhost:3332', { rejectUnauthorized: false, headers: { 'ps2token': token } });
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
  const token = await authenticate('admin', 'Test4545,');
  console.log('✓ Authenticated');
  const result = await sendCommand(token, {
    command: 'tools.statistic',
    portfolio: '69dbf8672a9c23ba6ab4fb4b',
    msgId: 'test-stat-portfolio'
  });
  const s = result.data?.statistic;
  console.log('\nbenchmark:', result.data?.benchmark);
  console.log('beta:', s?.beta);
  console.log('alpha:', s?.alpha);
  console.log('correlation:', s?.correlation);
  console.log('tracking_error:', s?.tracking_error);
  console.log('information_ratio:', s?.information_ratio);
  console.log('up_capture:', s?.up_capture);
  console.log('down_capture:', s?.down_capture);
  console.log('ulcer_index:', s?.ulcer_index);
  console.log('martin_ratio:', s?.martin_ratio);
  console.log('gain_to_pain:', s?.gain_to_pain);
  console.log('pos_day_perc:', s?.pos_day_perc);
  console.log('avg_monthly_return:', s?.avg_monthly_return);
  console.log('winning_months_perc:', s?.winning_months_perc);
  console.log('max_drawdown_days:', s?.max_drawdown_days);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
