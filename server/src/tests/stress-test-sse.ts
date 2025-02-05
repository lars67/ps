import WebSocket from 'ws';

const endpoint = "wss://top.softcapital.com/ps2l/";
const numberOfConnections = process.argv[2] ? parseInt(process.argv[2]) : 50;
console.log(`Starting stress test with ${numberOfConnections} concurrent connections...`);

function openConnection(i: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(endpoint, { rejectUnauthorized: false });
    ws.on('open', () => {
      console.log(`Connection ${i} opened`);
      const testMsg = { login: 'admin', password: '111111', cmd: 'stressTest', id: i, payload: "test message" };
      ws.send(JSON.stringify(testMsg));
    });
    ws.on('message', (data) => {
      console.log(`Connection ${i} received: ${data.toString()}`);
      ws.close();
      resolve();
    });
    ws.on('error', (error) => {
      console.error(`Connection ${i} error:`, error);
      reject(error);
    });
    ws.on('close', () => {
      console.log(`Connection ${i} closed`);
    });
  });
}

async function runStressTest() {
  const promises = [];
  for (let i = 0; i < numberOfConnections; i++) {
    promises.push(openConnection(i));
  }
  try {
    await Promise.all(promises);
    console.log('Stress test completed successfully.');
  } catch (err) {
    console.error('Stress test encountered errors:', err);
  }
}

runStressTest();