import WebSocket from 'ws';
import path from 'path';

// Log current directory for debugging
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

const ws = new WebSocket('wss://127.0.0.1:3331', {
    rejectUnauthorized: false,
    ca: require('fs').readFileSync(path.join(__dirname, '../../Certificate/STAR.softcapital.com.ca.pem'))
});

console.log('Connecting to login server...');

ws.on('open', () => {
    console.log('Connected to login server');
    
    const loginData = {
        login: 'admin',
        password: '111111'
    };
    
    console.log('Sending login request...');
    ws.send(JSON.stringify(loginData));
});

ws.on('message', (data) => {
    console.log('Received response:', data.toString());
    ws.close();
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Connection closed');
});
