const WebSocket = require('ws');

const GUEST_WS_URL = 'wss://localhost:3334'; // Guest WebSocket endpoint

console.log('Testing tools.statistics command in guest mode...');

// Create WebSocket with SSL verification disabled for localhost testing
const ws = new WebSocket(GUEST_WS_URL, {
  rejectUnauthorized: false
});

ws.on('open', function open() {
  console.log('Connected to guest WebSocket');

  // Test the tools.statistics command
  const testCommand = {
    command: 'tools.statistic',
    history: '',
    portfolio: '6946582829e76d67083c94e6', // Using the portfolio ID from your example
    from: '',
    till: '',
    msgId: 'test-123'
  };

  console.log('Sending command:', JSON.stringify(testCommand, null, 2));
  ws.send(JSON.stringify(testCommand));
});

ws.on('message', function message(data) {
  console.log('Received response:');
  try {
    const response = JSON.parse(data.toString());
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('Raw response:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close(code, reason) {
  console.log('WebSocket closed:', code, reason.toString());
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('Test timeout - closing connection');
  ws.close();
}, 30000);
