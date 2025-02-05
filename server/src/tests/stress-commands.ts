import WebSocket from 'ws';

const endpoint = "wss://top.softcapital.com/ps2l/";
const numberOfConnections = process.argv[2] ? parseInt(process.argv[2]) : 20;
const intervalMs = 10; // reduced interval for a higher frequency of commands (10 ms)
const durationMs = 60000; // increased duration to 60 seconds per connection

console.log(`Starting stress commands test with ${numberOfConnections} concurrent connections...`);

function getRandomCommand(i: number): any {
  // Force subscribeQuotes command exclusively to stress the quotes subscription functionality
  return { 
    login: "admin", 
    password: "111111", 
    cmd: "subscribeQuotes", 
    id: i,
    symbols: "DAB:XCSE,AQP:XCSE,AT1:XETR,FTK:XETR,NFLX,ED,MRO,OHI,EDR,EQC,EURDKK:FX,USDDKK:FX,DKKEUR:FX,DKKUSD:FX"
  };
}

function openConnection(i: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(endpoint, { rejectUnauthorized: false });
    let intervalId: NodeJS.Timeout;

    ws.on('open', () => {
      console.log(`Connection ${i} opened`);
      // Send commands every 10 ms for 60 seconds
      intervalId = setInterval(() => {
        const command = getRandomCommand(i);
        console.log(`Connection ${i} sending command:`, command);
        ws.send(JSON.stringify(command));
      }, intervalMs);
      // After durationMs, stop sending commands and close the connection
      setTimeout(() => {
        clearInterval(intervalId);
        ws.close();
        resolve();
      }, durationMs);
    });

    ws.on('message', (data) => {
      console.log(`Connection ${i} received response:`, data.toString());
    });

    ws.on('error', (error) => {
      console.error(`Connection ${i} encountered error:`, error);
      clearInterval(intervalId);
      ws.close();
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
    console.log("Stress commands test completed successfully.");
  } catch (err) {
    console.error("Stress commands test encountered errors:", err);
  }
}

runStressTest();
