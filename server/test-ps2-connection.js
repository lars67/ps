console.log('=== PS2 Login Test Starting ===');

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('Modules loaded');
console.log('Current directory:', process.cwd());

const certificatePath = path.join(__dirname, '..', 'Certificate', 'STAR.softcapital.com.ca.pem');
console.log('Certificate path:', certificatePath);

const ws = new WebSocket('wss://top.softcapital.com/ps2l/', {
    rejectUnauthorized: false,
    ca: fs.readFileSync(certificatePath)
});

console.log('Connecting to login server...');

ws.on('open', () => {
    console.log('Connected to login server');
    
    const loginMsg = {
        login: 'admin',
        password: '111111'
    };
    
    console.log('Sending login message:', loginMsg);
    ws.send(JSON.stringify(loginMsg));
});

ws.on('message', (data) => {
    console.log('Received message:', data.toString());
    ws.close();
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Connection closed');
});