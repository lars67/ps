#!/usr/bin/env node

/**
 * Test script to verify portfolio positions profiling system
 * This script tests the profiling functionality and generates a report
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.REACT_APP_WS_URL = 'wss://localhost';
process.env.REACT_APP_LOGIN_WS = 'wss://localhost:3331';
process.env.REACT_APP_WS = 'wss://localhost:3332';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const fs = require('fs');
const path = require('path');
const https = require('https');
const OriginalWebSocket = require('ws');

// Load SSL certificates (adjust path as needed for your environment)
let caBundle, finexBundle;
try {
    // First try relative path
    caBundle = fs.readFileSync(process.env.SSL_CERT_BUNDLE || path.join(__dirname, 'Cert', 'My_CA_Bundle.ca-bundle'));
    finexBundle = fs.readFileSync(process.env.SSL_CERT_FILE || path.join(__dirname, 'Cert', 'finex_dk.crt'));
} catch (e) {
    console.log('SSL cert files not found, using system certificates only');
    caBundle = null;
    finexBundle = null;
}

// Configure WebSocket with SSL
const tls = require('tls');
let wsConfig = {};
if (caBundle && finexBundle) {
    wsConfig = {
        ca: [
            ...tls.rootCertificates, // Include system root certificates
            caBundle,
            finexBundle
        ],
        agent: new https.Agent({
            ca: [
                ...tls.rootCertificates, // Include system root certificates
                caBundle,
                finexBundle
            ],
            rejectUnauthorized: false,
            secureProtocol: 'TLSv1_2_method'
        })
    };
}

// Create a custom WebSocket class that extends the original
class SecureWebSocket extends OriginalWebSocket {
    constructor(url, options = {}) {
        const mergedOptions = { ...wsConfig, ...options };
        super(url, mergedOptions);
    }
}

// Global WebSocket override
global.WebSocket = SecureWebSocket;

// Embedded PS2LoginHandler functionality
class PS2LoginHandler {
    constructor() {
        this.ws = null;
        this.token = null;
        this.userId = null;
        this.messageListeners = new Map();
        this.msgIdCounter = 0;
        this.lastSentMsgId = null;
    }

    generateMsgId(prefix = '') {
        return `${prefix}_${Date.now()}_${this.msgIdCounter++}`;
    }

    async connectWebSocket(endpoint = 'ps2l', suffix = '') {
        console.log(`Connecting to ${endpoint} endpoint...`);

        // Determine URL based on endpoint and environment
        const isDev = process.env.NODE_ENV === 'development';
        let baseUrl = '';

        if (endpoint === 'ps2l') {
            baseUrl = process.env.REACT_APP_LOGIN_WS + '/ps2l/';
        } else if (endpoint === 'ps2') {
            baseUrl = suffix ? process.env.REACT_APP_WS + `/ps2/?${suffix}` : process.env.REACT_APP_WS + '/ps2/';
        }

        return new Promise((resolve, reject) => {
            // Use plain WebSocket in development, SecureWebSocket in production
            if (isDev) {
                this.ws = new OriginalWebSocket(baseUrl);
            } else {
                this.ws = new SecureWebSocket(baseUrl);
            }

            this.ws.onopen = () => {
                console.log(`Connected to ${endpoint} endpoint`);
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error(`WebSocket error on ${endpoint}:`, error);
                reject(error);
            };

            this.ws.onclose = (event) => {
                console.log(`WebSocket ${endpoint} connection closed: ${event.code} ${event.reason}`);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.msgId && this.messageListeners.has(data.msgId)) {
                        this.messageListeners.get(data.msgId)(data);
                    } else if (data.token && this.lastSentMsgId) {
                        // Handle login responses that don't have msgId but have token
                        if (this.messageListeners.has(this.lastSentMsgId)) {
                            this.messageListeners.get(this.lastSentMsgId)(data);
                        }
                    } else if (this.lastSentMsgId && data.msgId === this.lastSentMsgId) {
                        // Fallback for messages with matching msgId to last sent
                        if (this.messageListeners.has(this.lastSentMsgId)) {
                            this.messageListeners.get(this.lastSentMsgId)(data);
                        }
                    }
                } catch (error) {
                    console.error('PS2 message processing error:', error.message);
                }
            };
        });
    }

    async sendMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve, reject) => {
            if (!message.msgId) {
                message.msgId = this.generateMsgId(message.command || 'msg');
            }

            const msgId = message.msgId;
            const timeout = setTimeout(() => {
                console.error(`Message timeout for ${msgId}`);
                this.messageListeners.delete(msgId);
                reject(new Error(`Timeout waiting for response to ${message.command}`));
            }, 30000);

            const cleanup = () => {
                if (timeout) clearTimeout(timeout);
                this.messageListeners.delete(msgId);
            };

            const handleResponse = (response) => {
                try {
                    // Handle login response immediately
                    if (message.command === 'login' && response.token) {
                        console.log('Login successful, token received');
                        cleanup();
                        resolve(response);
                        return;
                    }

                    if (message.command === 'portfolios.positions') {
                        // Handle snapshot message first
                        if (response.msg && response.msg.includes && response.msg.includes('snapshot')) {
                            console.log('Received positions snapshot response');
                            cleanup();
                            resolve(response);
                            return;
                        }
                    }

                    // Default response handling
                    cleanup();
                    resolve(response);
                } catch (error) {
                    console.error(`Error handling response for ${msgId}:`, error);
                    cleanup();
                    reject(error);
                }
            };

            this.messageListeners.set(msgId, handleResponse);
            this.lastSentMsgId = msgId; // Track last sent message for fallback matching

            console.log(`Sending ${message.command} (${msgId})`);
            this.ws.send(JSON.stringify(message));
        });
    }

    async login(email, password, isAdmin = false) {
        console.log(`Attempting login for ${email}${isAdmin ? ' (admin)' : ''}`);

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket('ps2l');
        }

        const loginMessage = {
            login: email,
            password,
            command: 'login',
            msgId: this.generateMsgId('login')
        };

        const response = await this.sendMessage(loginMessage);

        if (response.token) {
            this.token = response.token;

            // Decode token to get userId (simple JWT decode)
            try {
                const payload = JSON.parse(Buffer.from(response.token.split('.')[1], 'base64').toString());
                this.userId = payload.userId || payload.userID || payload.id;
                console.log('Login successful, userId:', this.userId);
            } catch (e) {
                console.warn('Could not decode userId from token');
            }

            return { success: true, ...response };
        } else {
            return { success: false, message: 'No token received' };
        }
    }

    async testPositionsWithProfiling(portfolioId) {
        if (!this.token) {
            throw new Error('Not logged in. Call login() first');
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket('ps2', this.token);
        }

        const message = {
            command: 'portfolios.positions',
            _id: portfolioId,
            requestType: '0', // Single snapshot request
            marketPrice: '4',
            basePrice: '4',
            closed: 'no',
            includeAttribution: false,
            token: this.token,
            msgId: this.generateMsgId('positions_test')
        };

        console.log('🚀 Starting portfolio positions test with profiling...');
        const startTime = Date.now();
        
        const response = await this.sendMessage(message);
        const endTime = Date.now();
        
        console.log(`✅ Portfolio positions completed in ${endTime - startTime}ms`);
        console.log('Response:', response);
        
        return response;
    }

    closeConnection() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.token = null;
        this.userId = null;
        this.messageListeners.clear();
        console.log('PS2 connection closed and cleaned up');
    }
}

// Function to check profiling files
function checkProfilingFiles() {
    const profilingDir = path.join(__dirname, 'server', 'logs', 'profiling');
    const today = new Date().toISOString().split('T')[0];
    const filename = `portfolio_positions_${today}.jsonl`;
    const filepath = path.join(profilingDir, filename);
    
    console.log('\n📊 Checking profiling output...');
    console.log(`Looking for: ${filepath}`);
    
    if (fs.existsSync(filepath)) {
        console.log('✅ Profiling file found!');
        
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            
            console.log(`📈 Found ${lines.length} profiling entries`);
            
            // Parse and analyze profiling data
            const entries = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.warn('Failed to parse line:', line);
                    return null;
                }
            }).filter(Boolean);
            
            if (entries.length > 0) {
                console.log('\n📋 Profiling Summary:');
                
                // Group by operation
                const operationStats = {};
                entries.forEach(entry => {
                    if (!operationStats[entry.operation]) {
                        operationStats[entry.operation] = {
                            count: 0,
                            totalDuration: 0,
                            avgDuration: 0,
                            maxDuration: 0,
                            minDuration: Infinity
                        };
                    }
                    
                    const stat = operationStats[entry.operation];
                    stat.count++;
                    stat.totalDuration += entry.duration;
                    stat.maxDuration = Math.max(stat.maxDuration, entry.duration);
                    stat.minDuration = Math.min(stat.minDuration, entry.duration);
                    stat.avgDuration = stat.totalDuration / stat.count;
                });
                
                // Display stats sorted by total duration
                Object.entries(operationStats)
                    .sort(([,a], [,b]) => b.totalDuration - a.totalDuration)
                    .forEach(([operation, stats]) => {
                        console.log(`  ${operation}:`);
                        console.log(`    Count: ${stats.count}`);
                        console.log(`    Avg: ${stats.avgDuration.toFixed(1)}ms`);
                        console.log(`    Max: ${stats.maxDuration.toFixed(1)}ms`);
                        console.log(`    Min: ${stats.minDuration === Infinity ? 'N/A' : stats.minDuration.toFixed(1)}ms`);
                        console.log(`    Total: ${stats.totalDuration.toFixed(1)}ms`);
                        console.log('');
                    });
                
                return entries;
            }
        } catch (error) {
            console.error('❌ Error reading profiling file:', error.message);
        }
    } else {
        console.log('❌ No profiling file found for today');
        console.log('   Make sure the server created profiling entries');
        
        // Try to list what files exist
        if (fs.existsSync(profilingDir)) {
            const files = fs.readdirSync(profilingDir);
            console.log(`   Available files in ${profilingDir}:`);
            files.forEach(file => console.log(`     - ${file}`));
        } else {
            console.log(`   Profiling directory doesn't exist: ${profilingDir}`);
        }
    }
    
    return null;
}

// Create singleton instance
const ps2Handler = new PS2LoginHandler();

async function testProfilingSystem() {
    const portfolioId = '694405d7143ab34c75be3aaa';

    try {
        console.log('🔍 Testing Portfolio Positions Profiling System');
        console.log('='.repeat(50));

        // Connect to PS2 and login as admin
        await ps2Handler.connectWebSocket('ps2l');
        const loginResult = await ps2Handler.login('admin', '111111', true);

        if (!loginResult.success) {
            throw new Error('Admin login failed: ' + loginResult.message);
        }

        console.log('✅ Admin login successful');

        // Connect to PS2 endpoint with token
        await ps2Handler.connectWebSocket('ps2', ps2Handler.token);
        console.log('✅ Connected to PS2 endpoint');

        // Test positions with profiling
        const result = await ps2Handler.testPositionsWithProfiling(portfolioId);
        
        // Wait a moment for profiling files to be written
        console.log('⏳ Waiting for profiling data to be written...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check profiling results
        const profilingData = checkProfilingFiles();
        
        // Close connection
        ps2Handler.closeConnection();
        
        if (profilingData && profilingData.length > 0) {
            console.log('\n🎉 Profiling system is working correctly!');
            console.log(`   Generated ${profilingData.length} profiling entries`);
            
            // Find the main positions operation
            const mainOp = profilingData.find(entry => entry.operation === 'positions.main');
            if (mainOp) {
                console.log(`   Main operation took: ${mainOp.duration.toFixed(1)}ms`);
                console.log(`   Test completed successfully!`);
            }
        } else {
            console.log('\n⚠️  Profiling system may not be working correctly');
            console.log('   No profiling data was found');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        ps2Handler.closeConnection();
        process.exit(1);
    }
}

testProfilingSystem();
