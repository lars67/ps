#!/usr/bin/env node

/**
 * Standalone PS2 Portfolio Positions Script
 *
 * This script connects to PS2 (Portfolio Management System) and fetches portfolio positions.
 *
 * Usage:
 *   node get_portfolio_positions.js
 *
 * Configuration:
 * - Set SSL_CERT_BUNDLE and SSL_CERT_FILE environment variables to point to your SSL certificates
 * - Modify the portfolioId and credentials as needed
 * - For development: set NODE_ENV=development to use ws://
 * - For production: set NODE_ENV=production to use wss:// and proper certificates
 *
 * Dependencies: only requires 'ws' and built-in Node.js modules
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
    caBundle = fs.readFileSync(process.env.SSL_CERT_BUNDLE || path.join(__dirname, '..', 'Cert', 'My_CA_Bundle.ca-bundle'));
    finexBundle = fs.readFileSync(process.env.SSL_CERT_FILE || path.join(__dirname, '..', 'Cert', 'finex_dk.crt'));
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

// Embedded PS2LoginHandler functionality with fragmented message support
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
        let baseUrl = isDev ? 'ws://localhost:3000' : 'wss://finex.dk';

        if (endpoint === 'ps2l') {
            baseUrl += '/ps2l/';
        } else if (endpoint === 'ps2') {
            baseUrl += suffix ? `/ps2/?${suffix}` : '/ps2/';
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

            // Fragmented message handling variables
            let fragments = [];
            let receivedCount = 0;
            let expectedTotal = 1;

            const timeout = setTimeout(() => {
                console.error(`Message timeout for ${msgId}`);
                this.messageListeners.delete(msgId);
                reject(new Error(`Timeout waiting for response to ${message.command}`));
            }, 60000);

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

                    /**
                     * PS2 WebSocket Response Handling Overview
                     *
                     * PS2 uses fragmented responses for large payloads to avoid WebSocket message size limits.
                     * When a response exceeds a threshold, it's split into multiple fragments.
                     *
                     * Fragmented Response Structure:
                     * Each fragment is a WebSocket message containing JSON with:
                     * - msgId: Unique message ID (same for all fragments of one response)
                     * - index: Fragment sequence number (0-based)
                     * - total: Total number of fragments for this response
                     * - data: String containing partial JSON data
                     *
                     * Decoding Fragments:
                     * 1. Collect all fragments with the same msgId
                     * 2. Concatenate 'data' strings in order: fragments[0].data + fragments[1].data + ...
                     * 3. Parse the combined string as JSON: JSON.parse(combinedData)
                     * 4. Result is the complete command response
                     *
                     * Example Fragment Sequence:
                     * Fragment 0/3: {"msgId":"msg_123","index":0,"total":3,"data":"{\"command\":\"portfolios.positions\",\"data\":["}
                     * Fragment 1/3: {"msgId":"msg_123","index":1,"total":3,"data":"{\"symbol\":\"AAPL\",\"volume\":100},"}
                     * Fragment 2/3: {"msgId":"msg_123","index":2,"total":3,"data":"{\"symbol\":\"GOOGL\",\"volume\":50}]}"}
                     *
                     * Combined JSON: {"command":"portfolios.positions","data":[{"symbol":"AAPL","volume":100},{"symbol":"GOOGL","volume":50}]}
                     */

                    const { data, index, total } = response;

                    // Handle fragmented messages
                    if (total > 1) {
                        expectedTotal = Number(total);
                        fragments[Number(index)] = data;
                        receivedCount++;

                        console.log(`Fragment received: ${index}/${total} (${receivedCount}/${expectedTotal})`);

                        if (receivedCount === expectedTotal) {
                            const body = fragments.join('');
                            console.log(`Complete fragmented response (${body.length} chars)`);

                            try {
                                const parsedData = JSON.parse(body);
                                console.log(`Parsed fragmented data:`, parsedData);
                                cleanup();
                                resolve(parsedData);
                            } catch (error) {
                                console.error(`Error parsing fragmented response:`, error);
                                cleanup();
                                reject(error);
                            }
                        }
                    } else {
                        // Handle single message responses
                        if (message.command === 'portfolios.positions') {
                            // Handle snapshot message first
                            if (data && data.includes && data.includes('snapshot')) {
                                console.log('Received positions snapshot, waiting for data...');
                                // Keep timeout active for actual data
                                return;
                            }

                            // Parse position data
                            if (data && typeof data === 'string') {
                                try {
                                    const parsedData = JSON.parse(data);
                                    console.log('Parsed position data from string');
                                    cleanup();
                                    resolve(parsedData);
                                } catch (e) {
                                    console.error('Failed to parse position data string:', e);
                                    cleanup();
                                    reject(e);
                                }
                            } else if (Array.isArray(data)) {
                                console.log('Received position data array directly');
                                cleanup();
                                resolve({ data });
                            } else {
                                console.log('Received other position response format');
                                cleanup();
                                resolve(response);
                            }
                        } else {
                            // Default response handling
                            cleanup();
                            resolve(response);
                        }
                    }
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

    async fetchPositions(portfolioId) {
        if (!this.token) {
            throw new Error('Not logged in. Call login() first');
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connectWebSocket('ps2', this.token);
        }

        const message = {
            command: 'portfolios.positions',
            _id: portfolioId,
            token: this.token,
            msgId: this.generateMsgId('positions')
        };

        const response = await this.sendMessage(message);
        return response.data || response;
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

// Create singleton instance
const ps2Handler = new PS2LoginHandler();

async function getPortfolioPositions() {
    const portfolioId = '6915feb01d51dd1539179a0c';

    try {
        console.log('Logging into PS2...');

        // Connect to PS2 and login as admin
        await ps2Handler.connectWebSocket('ps2l');
        const loginResult = await ps2Handler.login('admin', '111111', true);

        if (!loginResult.success) {
            throw new Error('Admin login failed: ' + loginResult.message);
        }

        console.log('Admin login successful');

        // Connect to PS2 endpoint with token
        await ps2Handler.connectWebSocket('ps2', ps2Handler.token);
        console.log('Connected to PS2 endpoint');

        // Fetch portfolio positions
        console.log(`Fetching positions for portfolio: ${portfolioId}`);
        const positions = await ps2Handler.fetchPositions(portfolioId);

        console.log('Portfolio positions result:');
        console.log(JSON.stringify(positions, null, 2));

        // Close connection
        ps2Handler.closeConnection();

        console.log('Script completed successfully');
    } catch (error) {
        console.error('Script failed:', error);
        ps2Handler.closeConnection();
        process.exit(1);
    }
}

getPortfolioPositions();
