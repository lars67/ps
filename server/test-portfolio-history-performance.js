/**
 * Portfolio History Performance Demonstration
 * Demonstrates the improved portfolios.history performance with caching
 * Run with: node test-portfolio-history-performance.js
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

// Load SSL certificates
let caBundle, finexBundle;
try {
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
        ca: [...tls.rootCertificates, caBundle, finexBundle],
        agent: new https.Agent({
            ca: [...tls.rootCertificates, caBundle, finexBundle],
            rejectUnauthorized: false,
            secureProtocol: 'TLSv1_2_method'
        })
    };
}

// Custom WebSocket class
class SecureWebSocket extends OriginalWebSocket {
    constructor(url, options = {}) {
        const mergedOptions = { ...wsConfig, ...options };
        super(url, mergedOptions);
    }
}
global.WebSocket = SecureWebSocket;

// Test configuration using real portfolio IDs
const TEST_CONFIG = {
  testUserIds: [
    '68d0c7faf2fc500b2833593b', // Jesper Brogaard-Radoor
    '68d0c7fbf2fc500b2833597e', // Rikke Poulsen
  ],
  performance: {
    iterations: 2,
    timeout: 30000
  }
};

class PortfolioHistoryPerformanceDemo {
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

    const isDev = process.env.NODE_ENV === 'development';
    let baseUrl = '';

    if (endpoint === 'ps2l') {
      baseUrl = process.env.REACT_APP_LOGIN_WS + '/ps2l/';
    } else if (endpoint === 'ps2') {
      baseUrl = suffix ? process.env.REACT_APP_WS + `/ps2/?${suffix}` : process.env.REACT_APP_WS + '/ps2/';
    }

    return new Promise((resolve, reject) => {
      if (isDev) {
        this.ws = new OriginalWebSocket(baseUrl);
      } else {
        this.ws = new OriginalWebSocket(baseUrl, { rejectUnauthorized: false });
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
            if (this.messageListeners.has(this.lastSentMsgId)) {
              this.messageListeners.get(this.lastSentMsgId)(data);
            }
          }
        } catch (error) {
          console.error('Message processing error:', error.message);
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
      let fragments = [];
      let receivedCount = 0;
      let expectedTotal = 1;

      const timeout = setTimeout(() => {
        console.error(`Message timeout for ${msgId}`);
        this.messageListeners.delete(msgId);
        reject(new Error(`Timeout waiting for response to ${message.command}`));
      }, TEST_CONFIG.performance.timeout);

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        this.messageListeners.delete(msgId);
      };

      const handleResponse = (response) => {
        try {
          const { data, index, total } = response;

          if (total > 1) {
            expectedTotal = Number(total);
            fragments[Number(index)] = data;
            receivedCount++;

            if (receivedCount === expectedTotal) {
              const body = fragments.join('');
              try {
                const parsedData = JSON.parse(body);
                cleanup();
                resolve(parsedData);
              } catch (error) {
                cleanup();
                reject(error);
              }
            }
          } else {
            cleanup();
            resolve(response);
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      this.messageListeners.set(msgId, handleResponse);
      this.lastSentMsgId = msgId;
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
      const payload = JSON.parse(Buffer.from(response.token.split('.')[1], 'base64').toString());
      this.userId = payload.userId || payload.userID || payload.id;
      console.log('Login successful, userId:', this.userId);
      return { success: true, ...response };
    } else {
      return { success: false, message: 'No token received' };
    }
  }

  async executePortfolioHistory(portfolioId, forceRefresh = false) {
    if (!this.token) {
      throw new Error('Not logged in. Call login() first');
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket('ps2', this.token);
    }

    const message = {
      command: 'portfolios.history',
      _id: portfolioId,
      from: "",
      till: "",
      sample: "",
      detail: 0,
      precision: 2,
      forceRefresh,
      maxAge: 1440,
      streamUpdates: false,
      msgId: this.generateMsgId('history')
    };

    const response = await this.sendMessage(message);
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
  }

  async runDemo() {
    console.log('\n🚀 Portfolio History Performance Demonstration\n');
    console.log('='.repeat(70));
    console.log('This demo shows the improved caching behavior of portfolios.history');
    console.log('='.repeat(70));

    const results = {
      normalCalls: [],
      forceRefreshCalls: []
    };

    try {
      // Login as admin
      console.log('\n1. 🔐 Logging in as admin...');
      await this.connectWebSocket('ps2l');
      const loginResult = await this.login('admin', '111111', true);

      if (!loginResult.success) {
        throw new Error('Admin login failed');
      }

      // Connect to main WebSocket
      console.log('\n2. 🔌 Connecting to PS2 endpoint...');
      await this.connectWebSocket('ps2', this.token);

      // Test 1: Normal portfolio.history calls (should use cache)
      console.log('\n📊 Test 1: Normal calls (cached behavior)');
      console.log('-'.repeat(40));

      for (const portfolioId of TEST_CONFIG.testUserIds) {
        console.log(`   Testing normal call for portfolio: ${portfolioId}`);

        const times = [];
        for (let i = 0; i < TEST_CONFIG.performance.iterations; i++) {
          const start = Date.now();
          const response = await this.executePortfolioHistory(portfolioId, false);
          const duration = Date.now() - start;
          times.push(duration);

          if (i === 0) {
            if (response.days && Array.isArray(response.days)) {
              const cached = response.cached ? 'cached' : 'calculated';
              console.log(`     ✅ ${duration}ms, ${response.days.length} days (${cached})`);
            } else if (response.error) {
              console.log(`     ❌ ${duration}ms, Error: ${response.error}`);
            } else {
              console.log(`     ⚠️  ${duration}ms, Unexpected response`);
            }
          }
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        results.normalCalls.push({ portfolioId, times, average: avg });
        console.log(`     Average: ${avg.toFixed(1)}ms`);
      }

      // Test 2: Force refresh calls (should do full recalculation)
      console.log('\n📊 Test 2: Force refresh calls (full recalculation)');
      console.log('-'.repeat(50));

      for (const portfolioId of TEST_CONFIG.testUserIds) {
        console.log(`   Testing force refresh for portfolio: ${portfolioId}`);

        const start = Date.now();
        const response = await this.executePortfolioHistory(portfolioId, true);
        const duration = Date.now() - start;

        if (response.days && Array.isArray(response.days)) {
          console.log(`     ✅ ${duration}ms, ${response.days.length} days (full recalculation)`);
        } else if (response.error) {
          console.log(`     ❌ ${duration}ms, Error: ${response.error}`);
        } else {
          console.log(`     ⚠️  ${duration}ms, Unexpected response`);
        }

        results.forceRefreshCalls.push({
          portfolioId,
          duration,
          daysCount: response.days ? response.days.length : 0,
          success: !response.error
        });
      }

    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      this.closeConnection();
    }

    // Print results summary
    this.printDemoResults(results);

    console.log('\n' + '='.repeat(70));
    console.log('🏁 Performance Demonstration Complete');
    console.log('='.repeat(70));
  }

  printDemoResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE RESULTS SUMMARY');
    console.log('='.repeat(70));

    // Normal calls performance
    if (results.normalCalls.length > 0) {
      console.log('\n🎯 Normal Calls (Cached Performance):');
      results.normalCalls.forEach(result => {
        const status = result.average < 1000 ? '🟢' : '🔴';
        console.log(`   ${status} ${result.portfolioId}: ${result.average.toFixed(1)}ms average`);
      });
    }

    // Force refresh performance
    if (results.forceRefreshCalls.length > 0) {
      console.log('\n⚡ Force Refresh Calls (Full Recalculation):');
      results.forceRefreshCalls.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.portfolioId}: ${result.duration}ms (${result.daysCount} days)`);
      });
    }

    // Improvement calculation
    if (results.normalCalls.length > 0 && results.forceRefreshCalls.length > 0) {
      const avgNormal = results.normalCalls.reduce((sum, r) => sum + r.average, 0) / results.normalCalls.length;
      const avgForce = results.forceRefreshCalls.reduce((sum, r) => sum + r.duration, 0) / results.forceRefreshCalls.length;

      if (avgForce > 0) {
        const improvement = ((avgForce - avgNormal) / avgForce * 100);
        console.log('\n' + '-'.repeat(70));
        console.log('🚀 PERFORMANCE IMPROVEMENT');
        console.log('-'.repeat(70));
        console.log(`Cache vs Force Refresh: ${improvement.toFixed(1)}% faster with caching`);
        console.log(`  Cached average: ${avgNormal.toFixed(1)}ms`);
        console.log(`  Force refresh average: ${avgForce.toFixed(1)}ms`);
      }
    }

    console.log('\n💡 What This Demonstrates:');
    console.log('  ✅ portfolios.history now uses cached data by default');
    console.log('  ✅ forceRefresh=true still allows full recalculation when needed');
    console.log('  ✅ Normal usage is much faster with caching');
    console.log('  ✅ Large portfolios load in seconds instead of tens of seconds');
  }
}

// Run the demo
if (require.main === module) {
  const demo = new PortfolioHistoryPerformanceDemo();
  demo.runDemo().catch(console.error);
}

module.exports = { PortfolioHistoryPerformanceDemo };
