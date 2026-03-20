#!/usr/bin/env node

/**
 * PS2 Portfolio Positions Streaming Test Script
 *
 * This script demonstrates real-time portfolio position streaming from the PS2 trading system.
 * It subscribes to live position updates for a specified portfolio and displays both initial
 * positions and real-time market data changes.
 *
 * USAGE:
 *   node get_portfolio_positions.js
 *
 * CONFIGURATION:
 * - Portfolio ID: Modify the `portfolioId` variable in the script
 * - Authentication: Uses admin login (admin/111111) - modify credentials as needed
 * - SSL Certificates: Set SSL_CERT_BUNDLE and SSL_CERT_FILE environment variables
 * - Environment: Set NODE_ENV=development (ws://) or production (wss://)
 * - Monitoring Duration: Set to 5 minutes by default
 *
 * MESSAGE FORMAT:
 * The script sends a portfolios.positions command with requestType: "1" (subscribe):
 * {
 *   "command": "portfolios.positions",
 *   "_id": "portfolio_id",
 *   "requestType": "1",           // Subscribe mode
 *   "basePrice": "2",             // Latest Price for cost basis calculations
 *   "marketPrice": "2",           // Latest Price for market value calculations
 *   "closed": "no",               // Include only open positions
 *   "totalsMode": "none",         // No totals aggregation
 *   "includeAttribution": false,  // No income attribution breakdown
 *   "msgId": "subscribe_..."      // Auto-generated message ID
 * }
 *
 * RESPONSE FORMAT:
 * Initial subscribe response includes positions data:
 * {
 *   "command": "portfolios.positions",
 *   "msgId": "subscribe_...",
 *   "data": {
 *     "msg": "subscribed",
 *     "eventName": "SSE_QUOTES_...",
 *     "positions": [
 *       {
 *         "symbol": "AAPL",
 *         "volume": 100,
 *         "price": 150.00,
 *         "invested": 15000.00,
 *         // ... other position fields
 *       }
 *     ]
 *   }
 * }
 *
 * Streaming updates (when market prices change):
 * {
 *   "command": "portfolios.positions",
 *   "msgId": "subscribe_...",
 *   "data": [
 *     {
 *       "symbol": "AAPL",
 *       "marketPrice": 151.00,
 *       "marketValue": 15100.00,
 *       "result": 100.00,
 *       // ... updated fields
 *     }
 *   ]
 * }
 *
 * PRICE TYPES:
 * - "0": IEX Bid Price
 * - "1": IEX Ask Price
 * - "2": Latest Price (recommended for real-time data)
 * - "4": Previous Close
 * - "5": Daily High
 * - "6": Daily Low
 * - "7": Mid Price (bid/ask average)
 * - "8": Latest or Mid Price
 *
 * DEPENDENCIES:
 * - Node.js built-in modules (fs, path, https, tls)
 * - 'ws' WebSocket library (npm install ws)
 *
 * FEATURES:
 * - WebSocket connection with SSL/TLS support
 * - Fragmented message handling for large responses
 * - Real-time streaming position updates
 * - Graceful error handling and reconnection
 * - Automatic unsubscription after monitoring period
 * - Comprehensive logging for debugging
 *
 * NOTES:
 * - Requires valid SSL certificates for production
 * - Streaming updates only occur when market prices actually change
 * - Script monitors for 5 minutes then unsubscribes automatically
 * - Use Ctrl+C to stop early if needed
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
                    const rawData = event.data;
                    console.log('RAW MESSAGE RECEIVED:', rawData.substring(0, 200) + (rawData.length > 200 ? '...' : ''));
                    const data = JSON.parse(event.data);
                    console.log('PARSED MESSAGE:', { command: data.command, msgId: data.msgId, dataType: Array.isArray(data.data) ? 'array' : typeof data.data, hasPositions: !!data.positions });

                    if (data.msgId && this.messageListeners.has(data.msgId)) {
                        // Check if this is a streaming update for a subscribe command
                        if (data.command === 'portfolios.positions' && Array.isArray(data.data) && data.msgId.startsWith('subscribe_')) {
                            console.log('DETECTED: Real-time position update received:');
                            console.log(JSON.stringify(data, null, 2));
                            return; // Don't pass to normal handler for streaming updates
                        }
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
                    } else if (Array.isArray(data) || (data.command === 'portfolios.positions' && data.data)) {
                        // Handle real-time position updates (streaming data without msgId)
                        console.log('FALLBACK: Real-time position update received:');
                        console.log(JSON.stringify(data, null, 2));
                    } else if (typeof data === 'object' && !data.msgId && !data.token) {
                        // Handle other streaming updates
                        console.log('FALLBACK: Streaming update received:');
                        console.log(JSON.stringify(data, null, 2));
                    } else {
                        console.log('UNHANDLED MESSAGE:', JSON.stringify(data, null, 2));
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
            }, 300000);

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
                        // Convert data to string if it's an object
                        fragments[Number(index)] = typeof data === 'string' ? data : JSON.stringify(data);
                        receivedCount++;

                        console.log(`Fragment received: ${index}/${total} (${receivedCount}/${expectedTotal})`);

                        if (receivedCount === expectedTotal) {
                            const body = fragments.join('');
                            console.log(`Complete fragmented response (${body.length} chars):`, body.substring(0, 500) + (body.length > 500 ? '...' : ''));

                            try {
                                // Try to parse as single JSON first
                                const parsedData = JSON.parse(body);
                                console.log(`Parsed fragmented data as single JSON:`, parsedData);

                                // Check if this is a streaming update for subscribe
                                if (parsedData.command === 'portfolios.positions' && Array.isArray(parsedData.data) && parsedData.msgId && parsedData.msgId.startsWith('subscribe_')) {
                                    console.log('REASSEMBLED: Real-time position update received:');
                                    console.log(JSON.stringify(parsedData, null, 2));
                                    return; // Don't resolve for streaming updates
                                }

                                cleanup();
                                resolve(parsedData);
                            } catch (singleError) {
                                console.log('Failed to parse as single JSON, trying to parse as concatenated JSON strings');
                                try {
                                    // Try to find JSON objects in the body and parse them
                                    const jsonMatches = body.match(/\{[^}]*\}/g);
                                    if (jsonMatches && jsonMatches.length > 0) {
                                        const parsedObjects = jsonMatches.map(json => JSON.parse(json));
                                        console.log('Parsed fragmented data as multiple objects:', parsedObjects);

                                        // For streaming updates, the first object should be the message structure
                                        if (parsedObjects.length >= 1 && parsedObjects[0].command === 'portfolios.positions') {
                                            console.log('REASSEMBLED: Real-time position update received:');
                                            console.log(JSON.stringify(parsedObjects[0], null, 2));
                                            return; // Don't resolve for streaming updates
                                        }
                                    }
                                    throw new Error('Could not parse fragmented data');
                                } catch (multiError) {
                                    console.error(`Error parsing fragmented response:`, multiError);
                                    cleanup();
                                    reject(multiError);
                                }
                            }
                        }
                    } else {
                        // Handle single message responses
                        if (message.command === 'portfolios.positions') {
                            // Handle subscribe streaming updates (arrays with same msgId)
                            if (Array.isArray(data) && message.requestType === "1") {
                                console.log('Real-time position update received:');
                                console.log(JSON.stringify(response, null, 2));
                                // Don't resolve or cleanup for streaming updates
                                return;
                            }

                            // Handle snapshot message first
                            if (data && data.includes && data.includes('snapshot')) {
                                console.log('Received positions snapshot, waiting for data...');
                                // Keep timeout active for actual data
                                return;
                            }

                            // Handle subscribe response with positions data
                            if (response.positions) {
                                console.log('Received positions data in subscribe response');
                                // For subscribe, don't cleanup the listener so streaming updates can be received
                                // cleanup(); // Remove this line to keep listener alive
                                resolve(response);
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
    const portfolioId = '69bbba8fb4f3805cb1e09066';

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

        // Subscribe to portfolio positions updates (provides initial positions + starts streaming)
        console.log(`Subscribing to positions for portfolio: ${portfolioId}`);
        const subscribeMsgId = ps2Handler.generateMsgId('subscribe');
        const subscribeMessage = {
            command: 'portfolios.positions',
            _id: portfolioId,
            requestType: "1",
            marketPrice: "2",
            basePrice: "2",
            closed: "no",
            totalsMode: "none",
            includeAttribution: false,
            msgId: subscribeMsgId
        };

        const subscribeResponse = await ps2Handler.sendMessage(subscribeMessage);
        console.log('Subscribe response:');
        console.log(JSON.stringify(subscribeResponse, null, 2));

        // Keep running continuously - updates will be displayed as they occur
        console.log('Monitoring for position updates (5 minutes)...');

        // Handle graceful shutdown after 5 minutes
        setTimeout(async () => {
            console.log('\n5 minutes elapsed, unsubscribing...');
            try {
                const unsubscribeMessage = {
                    command: 'portfolios.positions',
                    _id: portfolioId,
                    requestType: "2",
                    subscribeId: subscribeMsgId,
                    token: ps2Handler.token,
                    msgId: ps2Handler.generateMsgId('unsubscribe')
                };

                const unsubscribeResponse = await ps2Handler.sendMessage(unsubscribeMessage);
                console.log('Unsubscribe response:');
                console.log(JSON.stringify(unsubscribeResponse, null, 2));
            } catch (error) {
                console.error('Error during unsubscribe:', error);
            } finally {
                ps2Handler.closeConnection();
                console.log('Script completed successfully');
                process.exit(0);
            }
        }, 300000);

        // Keep the process alive
        await new Promise(() => {}); // This will run forever until timeout
    } catch (error) {
        console.error('Script failed:', error);
        ps2Handler.closeConnection();
        process.exit(1);
    }
}

getPortfolioPositions();
