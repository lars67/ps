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
  console.log('\nFull result keys:', Object.keys(result.data || result));
  console.log('data.benchmark:', result.data?.benchmark);
  const s = result.data?.statistic;
  if (s) {
    const keys = Object.keys(s).filter(k => s[k] !== undefined && s[k] !== null);
    console.log('defined statistic fields:', keys.length, 'out of', Object.keys(s).length);
    // show last 20 fields
    const newFields = ['ulcer_index','martin_ratio','gain_to_pain','pos_day_perc','avg_monthly_return','winning_months_perc','max_drawdown_days','beta','alpha','correlation','tracking_error','information_ratio','up_capture','down_capture'];
    newFields.forEach(f => console.log(f, '=', s[f]));
  } else {
    console.log('No statistic in result:', JSON.stringify(result).slice(0, 300));
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
