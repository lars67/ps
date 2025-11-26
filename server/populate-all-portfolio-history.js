/**
 * Populate Initial History Data for All Portfolios
 * Runs portfolios.history for each portfolio to generate initial cached data
 * Required before incremental updates can work properly
 * Run with: node populate-all-portfolio-history.js
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

// All portfolio IDs from portfolios.list
const ALL_PORTFOLIO_IDS = [
  "68d0c7faf2fc500b2833593b",
  "68d0c7fbf2fc500b2833597e",
  "68d0c7fcf2fc500b283359c1",
  "68d0c7fdf2fc500b28335a04",
  "68d0c7fef2fc500b28335a47",
  "68d0c7fff2fc500b28335a8a",
  "68d0c800f2fc500b28335acd",
  "68d0c801f2fc500b28335b10",
  "68d0c802f2fc500b28335b53",
  "68d0c803f2fc500b28335b96",
  "68d0c804f2fc500b28335bd9",
  "68d0c805f2fc500b28335c1c",
  "68d0c806f2fc500b28335c5f",
  "68d0c807f2fc500b28335ca2",
  "68d0c808f2fc500b28335ce5",
  "68d0c809f2fc500b28335d28",
  "68d0c80af2fc500b28335d6b",
  "68d0c80bf2fc500b28335dae",
  "68d0c80cf2fc500b28335df1",
  "68d0c80cf2fc500b28335e34",
  "68d0c80df2fc500b28335e77",
  "68d0c80ef2fc500b28335eba",
  "68d0c80ff2fc500b28335efd",
  "68d0c810f2fc500b28335f40",
  "68d0c811f2fc500b28335f83",
  "68d0c812f2fc500b28335fc6",
  "68d0c813f2fc500b28336009",
  "68d0c814f2fc500b2833604c",
  "68d0c815f2fc500b2833608f",
  "68d0c816f2fc500b283360d2",
  "68d0c817f2fc500b28336115",
  "68d0c818f2fc500b28336158",
  "68d0c819f2fc500b2833619b",
  "68d0c81af2fc500b283361de",
  "68d0c81bf2fc500b28336221",
  "68d0c81cf2fc500b28336264",
  "68d0c81df2fc500b283362a7",
  "68d0c81ef2fc500b283362ea",
  "68d0c81ff2fc500b2833632d",
  "68d0c820f2fc500b28336370",
  "68d0c821f2fc500b283363b3",
  "68d0c822f2fc500b283363f6",
  "68d0c822f2fc500b28336439",
  "68d0c823f2fc500b2833647c",
  "68d0c824f2fc500b283364bf",
  "68d0c825f2fc500b28336502",
  "68d0c826f2fc500b28336545",
  "68d0c827f2fc500b28336588",
  "68d0c828f2fc500b283365cb",
  "68d0c829f2fc500b2833660e",
  "68d0c82af2fc500b28336651",
  "68d0c82bf2fc500b28336694",
  "68d0c82cf2fc500b283366d7",
  "68d0c82df2fc500b2833671a",
  "68d0c82ef2fc500b2833675d",
  "68d0c82ff2fc500b283367a0",
  "68d0c830f2fc500b283367e3",
  "68d0c831f2fc500b28336826",
  "68d0c832f2fc500b28336869",
  "68d0c833f2fc500b283368ac",
  "68d0c834f2fc500b283368ef",
  "68d0c835f2fc500b28336932",
  "68d0c835f2fc500b28336975",
  "68d0c836f2fc500b283369b8",
  "68d0c837f2fc500b283369fb",
  "68d0c838f2fc500b28336a3e",
  "68d0c839f2fc500b28336a81",
  "68d0c83af2fc500b28336ac4",
  "68d0c83bf2fc500b28336b07",
  "68d0c83cf2fc500b28336b4a",
  "68d0c83df2fc500b28336b8d",
  "68d0c83ef2fc500b28336bd0",
  "68d0c83ff2fc500b28336c13",
  "68d0c840f2fc500b28336c56",
  "68d0c841f2fc500b28336c99",
  "68d0c842f2fc500b28336cdc",
  "68d0c843f2fc500b28336d1f",
  "68d0c844f2fc500b28336d62",
  "68d0c845f2fc500b28336da5",
  "68d0c846f2fc500b28336de8",
  "68d0c847f2fc500b28336e2b",
  "68d0c848f2fc500b28336e6e",
  "68d0c849f2fc500b28336eb1",
  "68d0c84af2fc500b28336ef4",
  "68d0c84bf2fc500b28336f37",
  "68d0c84cf2fc500b28336f7a",
  "68d0c84df2fc500b28336fbd",
  "68d0c84ef2fc500b28337000",
  "68d0c84ff2fc500b28337043",
  "68d0c84ff2fc500b28337086",
  "68d0c850f2fc500b283370c9",
  "68d0c851f2fc500b2833710c",
  "68d0c852f2fc500b2833714f",
  "68d0c853f2fc500b28337192",
  "68d0c854f2fc500b283371d5",
  "68d0c855f2fc500b28337218",
  "68d0c856f2fc500b2833725b",
  "68d0c857f2fc500b2833729e",
  "68d0c858f2fc500b283372e1",
  "68d0c859f2fc500b28337324",
  "68d0c85af2fc500b28337367",
  "68d0c85bf2fc500b283373aa",
  "68d0c85cf2fc500b283373ed",
  "68d0c85df2fc500b28337430",
  "68d0c85ef2fc500b28337473",
  "68d0c85ff2fc500b283374b6",
  "68d0c85ff2fc500b283374f9",
  "68d0c860f2fc500b2833753c",
  "68d0c861f2fc500b2833757f",
  "68d0c862f2fc500b283375c2",
  "68d0c863f2fc500b28337605",
  "68d0c864f2fc500b28337648",
  "68d0c865f2fc500b2833768b",
  "68d0c866f2fc500b283376ce",
  "68d0c867f2fc500b28337711",
  "68d0c868f2fc500b28337754",
  "68d0c869f2fc500b28337797",
  "68d0c86af2fc500b283377da",
  "68d0c86bf2fc500b2833781d",
  "68d0c86cf2fc500b28337860",
  "68d0c86df2fc500b283378a3",
  "68d0c86ef2fc500b283378e6",
  "68d0c86ff2fc500b28337929",
  "68d0c86ff2fc500b2833796c",
  "68d0c870f2fc500b283379af",
  "68d0c871f2fc500b283379f2",
  "68d0c872f2fc500b28337a35",
  "68d0c873f2fc500b28337a78",
  "68d0c874f2fc500b28337abb",
  "68d0c875f2fc500b28337afe",
  "68d0c876f2fc500b28337b41",
  "68d0c877f2fc500b28337b84",
  "68d0c878f2fc500b28337bc7",
  "68d0c879f2fc500b28337c0a",
  "68d0c87af2fc500b28337c4d",
  "68d0c87bf2fc500b28337c90",
  "68d0c87cf2fc500b28337cd3",
  "68d0c87df2fc500b28337d16",
  "68d0c87ef2fc500b28337d59",
  "68d0c87ff2fc500b28337d9c",
  "68d0c880f2fc500b28337ddf",
  "68d0c881f2fc500b28337e22",
  "68d0c882f2fc500b28337e65",
  "68d0c883f2fc500b28337ea8",
  "68d0c884f2fc500b28337eeb",
  "68d0c885f2fc500b28337f2e",
  "68d0c885f2fc500b28337f71",
  "68d0c886f2fc500b28337fb4",
  "68d0c887f2fc500b28337ff7",
  "68d0c888f2fc500b2833803a",
  "68d0c889f2fc500b2833807d",
  "68d0c88af2fc500b283380c0",
  "68d0c88bf2fc500b28338103",
  "68d0c88cf2fc500b28338146",
  "68d0c88df2fc500b28338189",
  "68d0c88ef2fc500b283381cc",
  "68d0c88ff2fc500b2833820f",
  "68d0c890f2fc500b28338252",
  "68d0c891f2fc500b28338295",
  "68d0c892f2fc500b283382d8",
  "68d0c893f2fc500b2833831b",
  "68d0c894f2fc500b2833835e",
  "68d0c894f2fc500b283383a1",
  "68d0c895f2fc500b283383e4",
  "68d0c896f2fc500b28338427",
  "68d0c897f2fc500b2833846a",
  "68d0c898f2fc500b283384ad",
  "68d0c899f2fc500b283384f0",
  "68d0c89af2fc500b28338533",
  "68d0c89bf2fc500b28338576",
  "68d0c89cf2fc500b283385b9",
  "68d0c89df2fc500b283385fc",
  "68d0c89ef2fc500b2833863f",
  "68d0c89ff2fc500b28338682",
  "68d0c8a0f2fc500b283386c5",
  "68d0c8a1f2fc500b28338708",
  "68d0c8a2f2fc500b2833874b",
  "68d0c8a2f2fc500b2833878e",
  "68d0c8a3f2fc500b283387d1",
  "68d0c8a4f2fc500b28338814",
  "68d0c8a5f2fc500b28338857",
  "68d0c8a6f2fc500b2833889a",
  "68d0c8a7f2fc500b283388dd",
  "68d0c8a8f2fc500b28338920",
  "68d0c8a9f2fc500b28338963",
  "68d0c8aaf2fc500b283389a6",
  "68d0c8abf2fc500b283389e9",
  "68d0c8acf2fc500b28338a2c",
  "68d0c8adf2fc500b28338a6f",
  "68d0c8aef2fc500b28338ab2",
  "68d0c8aff2fc500b28338af5",
  "68d0c8b0f2fc500b28338b38",
  "68d0c8b0f2fc500b28338b7b",
  "68d0c8b1f2fc500b28338bbe",
  "68d0c8b2f2fc500b28338c01",
  "68d0c8b3f2fc500b28338c44",
  "68d0c8b4f2fc500b28338c87",
  "68d0c8b5f2fc500b28338cca",
  "68d0c8b6f2fc500b28338d0d",
  "68d0c8b7f2fc500b28338d50",
  "68d0c8b8f2fc500b28338d93",
  "68d0c8b9f2fc500b28338dd6",
  "68d0c8baf2fc500b28338e19",
  "68d0c8bbf2fc500b28338e5c",
  "68d0c8bcf2fc500b28338e9e",
  "68d0c8bef2fc500b28338f23",
  "68d0c8bef2fc500b28338f33",
  "68e63bc53f60bad3c35424dd",
  "68e6d6463f60bad3c3542596",
  "68e748a33f60bad3c35425be",
  "68e8e2a75d8d5e6c43ecdb41",
  "68e961725d8d5e6c43ecf716",
  "68e9ddbd5d8d5e6c43ecf95c",
  "68ea06755d8d5e6c43ecff65",
  "68fa5a99b55731a081077860",
  "6901d6ab7225611b61d36e0c",
  "6901fb597225611b61d396ea",
  "690207ef49a013b6016e75a6",
  "690997c221e4d25864f064fe",
  "690f3b24d7ccb4757221128c",
  "690f4707d8f29e52141fdd15",
  "6911b024b6bd8d08e5235964",
  "6911bb54efa5a901f33813e6",
  "69194e0499f9e462f3d38f7b",
  "691ab9c6ec4b06ab7fc55e08",
  "6922b45dd9a106954b83a650"
];

const SLEEP_MS = 2000; // 2 seconds between requests

class PortfolioHistoryPopulator {
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
      }, 60000); // 60 seconds timeout

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
      detail: 0,
      precision: 2,
      forceRefresh,
      maxAge: forceRefresh ? 0 : 1440, // Disable cache age check when forcing refresh
      msgId: this.generateMsgId('history')
    };

    console.log(`Processing portfolio ${portfolioId}${forceRefresh ? ' (FORCE REFRESH, maxAge=0)' : ''}...`);
    const response = await this.sendMessage(message);
    return response;
  }

  async populateAllPortfolios() {
    console.log('\n🚀 FORCE REFRESHING Portfolio History Data for ALL Portfolios\n');
    console.log('='.repeat(80));
    console.log(`Total portfolios to process: ${ALL_PORTFOLIO_IDS.length}`);
    console.log(`Sleep interval: ${SLEEP_MS}ms between requests`);
    console.log(`Mode: FORCE REFRESH (full recalculation)`);
    console.log('='.repeat(80));

    try {
      // Login as admin
      console.log('\n🔐 Logging in as admin...');
      await this.connectWebSocket('ps2l');
      const loginResult = await this.login('admin', '111111', true);

      if (!loginResult.success) {
        throw new Error('Admin login failed');
      }

      // Connect to main WebSocket
      console.log('\n🔌 Connecting to PS2 endpoint...');
      await this.connectWebSocket('ps2', this.token);

      console.log('\n📊 Processing portfolios...\n');

      const results = {
        successful: 0,
        failed: 0,
        totalTime: 0
      };

      // Process each portfolio
      for (let i = 0; i < ALL_PORTFOLIO_IDS.length; i++) {
        const portfolioId = ALL_PORTFOLIO_IDS[i];
        const startTime = Date.now();

        try {
          console.log(`[${i + 1}/${ALL_PORTFOLIO_IDS.length}] Processing ${portfolioId}...`);

          const response = await this.executePortfolioHistory(portfolioId, true);

          if (response.error) {
            console.log(`   ❌ Error: ${response.error}`);
            results.failed++;
          } else if (response.data && response.data.days && Array.isArray(response.data.days)) {
            console.log(`   ✅ Success: ${response.data.days.length} days cached`);
            results.successful++;
          } else {
            // Log the actual response to debug
            console.log(`   ⚠️  Unexpected response format - Actual response:`, JSON.stringify(response, null, 2).substring(0, 200));
            results.failed++;
          }

        } catch (error) {
          console.log(`   ❌ Exception: ${error.message}`);
          results.failed++;
        }

        const duration = Date.now() - startTime;
        results.totalTime += duration;

        console.log(`   ⏱️  ${duration}ms\n`);

        // Sleep between requests (except for the last one)
        if (i < ALL_PORTFOLIO_IDS.length - 1) {
          console.log(`💤 Sleeping ${SLEEP_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
        }
      }

      // Print final summary
      console.log('\n' + '='.repeat(80));
      console.log('🏁 POPULATION COMPLETE');
      console.log('='.repeat(80));
      console.log('📊 Final Results:');
      console.log(`   ✅ Successful: ${results.successful}`);
      console.log(`   ❌ Failed: ${results.failed}`);
      console.log(`   📈 Total Time: ${Math.round(results.totalTime / 1000)} seconds`);
      console.log(`   📈 Average Time: ${Math.round(results.totalTime / ALL_PORTFOLIO_IDS.length)}ms per portfolio`);
      console.log('\n💡 All portfolios now have cached history data.');
      console.log('   Daily incremental updates can begin!');

    } catch (error) {
      console.error('❌ Population process failed:', error);
    } finally {
      this.closeConnection();
    }
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
}

// Run the population process
if (require.main === module) {
  const populator = new PortfolioHistoryPopulator();
  populator.populateAllPortfolios().catch(console.error);
}

module.exports = { PortfolioHistoryPopulator };
