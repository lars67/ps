console.log('=== PS2 Connection Test Starting ===');

const WebSocket = require('ws');
console.log('WebSocket module loaded');

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const https = require('https');
console.log('All modules loaded');

// Debug logging
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Disable SSL verification for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
console.log('SSL verification disabled');

try {
    // Connect to local server first (which is running on port 3001)
    console.log('Attempting to connect to local server...');
    const ws = new WebSocket('ws://localhost:3001/ps2l');

    ws.on('open', () => {
        console.log('Connection opened successfully');
        
        // Send login message
        const loginMsg = {
            login: 'admin',
            password: '111111',
            cmd: 'login'
        };
        console.log('Sending login message:', loginMsg);
        ws.send(JSON.stringify(loginMsg));
    });

    ws.on('message', (data) => {
        console.log('Received message:', data.toString());
        try {
            const response = JSON.parse(data.toString());
            if (response.token) {
                console.log('Successfully authenticated');
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', (code, reason) => {
        console.log('Connection closed:', code, reason ? reason.toString() : 'No reason provided');
    });

    // Keep process alive
    process.on('SIGINT', () => {
        console.log('Closing connection...');
        ws.close();
        process.exit(0);
    });

} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}