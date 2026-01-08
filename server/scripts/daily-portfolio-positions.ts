import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { connect, connection } from 'mongoose';
import { PortfolioModel } from '../src/models/portfolio';

// MongoDB connection string - should match your .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// PS2 WebSocket URLs
const LOGIN_WS_URL = process.env.LOGIN_WS_URL || 'wss://localhost:3331/ps2l/';
const MAIN_WS_URL = process.env.MAIN_WS_URL || 'wss://localhost:3332/ps2/';

// Admin credentials for authentication
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '111111';

// Certificate path
const CERT_PATH = path.join(__dirname, '../../Certificate/STAR.softcapital.com.ca.pem');

// Check if certificate exists, fallback for development
let certExists = false;
try {
  fs.accessSync(CERT_PATH);
  certExists = true;
} catch (error) {
  console.log('Certificate file not found, trying alternative path...');
}

interface PortfolioPosition {
  symbol: string;
  name: string;
  volume: number;
  invested: number;
  currency: string;
  marketValue?: number;
  result?: number;
  weight?: number;
  // Add other fields as needed
}

interface PositionsResponse {
  [key: string]: any;
  positions?: PortfolioPosition[];
}

class DailyPortfolioPositionsCollector {
  private loginWs: WebSocket | null = null;
  private mainWs: WebSocket | null = null;
  private jwtToken: string = '';
  private responsePromises: Map<string, { resolve: Function; reject: Function }> = new Map();
  private positionsPromises: Map<string, { resolve: Function; reject: Function }> = new Map();
  private messageFragments: Map<string, { fragments: string[]; total: number; received: number; resolve?: Function; reject?: Function }> = new Map();

  constructor() {
    this.connectToMongoDB();
  }

  private async connectToMongoDB() {
    try {
      await connect(MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  private createWebSocket(url: string): WebSocket {
    if (certExists) {
      const ca = fs.readFileSync(CERT_PATH);
      return new WebSocket(url, {
        rejectUnauthorized: false,
        ca: ca
      });
    } else {
      // For development without certificates
      return new WebSocket(url, {
        rejectUnauthorized: false
      });
    }
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Connecting to login WebSocket...');
      this.loginWs = this.createWebSocket(LOGIN_WS_URL);

      this.loginWs.on('open', () => {
        console.log('Connected to login server');

        const loginData = {
          login: ADMIN_LOGIN,
          password: ADMIN_PASSWORD
        };

        console.log('Sending login request...');
        this.loginWs!.send(JSON.stringify(loginData));
      });

      this.loginWs.on('message', (data) => {
        const response = JSON.parse(data.toString());
        console.log('Login response:', response);

        if (response.token) {
          this.jwtToken = response.token;
          console.log('Authentication successful');
          this.loginWs!.close();
          resolve();
        } else if (response.error) {
          reject(new Error(`Login failed: ${response.error}`));
        }
      });

      this.loginWs.on('error', (error) => {
        console.error('Login WebSocket error:', error);
        reject(error);
      });

      this.loginWs.on('close', () => {
        console.log('Login connection closed');
      });
    });
  }

  private async connectToMainWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Connecting to main WebSocket...');
      const wsUrl = `${MAIN_WS_URL}?${this.jwtToken}`;

      this.mainWs = this.createWebSocket(wsUrl);

      this.mainWs.on('open', () => {
        console.log('Connected to main WebSocket');
        resolve();
      });

      this.mainWs.on('message', (data) => {
        this.handleMainWebSocketMessage(data);
      });

      this.mainWs.on('error', (error) => {
        console.error('Main WebSocket error:', error);
        reject(error);
      });

      this.mainWs.on('close', () => {
        console.log('Main WebSocket connection closed');
      });
    });
  }

  private handleMainWebSocketMessage(data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());

      // Handle fragmented responses
      if (message.index !== undefined && message.total !== undefined) {
        this.handleFragment(message);
        return;
      }

      // Handle complete responses
      if (message.msgId) {
        // Check if this is a portfolios.positions snapshot acknowledgment
        if (message.data && typeof message.data === 'object' &&
            message.data.msg === 'snapshot' && message.data.eventName) {
          console.log('Received positions snapshot acknowledgment, waiting for data...');
          return; // Don't resolve the promise yet, wait for actual data
        }

        // Handle portfolios.positions responses (may come as direct data or fragments)
        if (this.messageFragments.has(message.msgId)) {
          // This is a portfolios.positions response that should be handled by fragments
          const fragmentData = this.messageFragments.get(message.msgId)!;
          if (fragmentData.resolve) {
            fragmentData.resolve(message.data);
          }
          this.messageFragments.delete(message.msgId);
          return;
        }

        // Handle normal responses
        if (this.responsePromises.has(message.msgId)) {
          const { resolve, reject } = this.responsePromises.get(message.msgId)!;
          this.responsePromises.delete(message.msgId);

          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.data);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleFragment(fragment: any) {
    const { msgId, index, total, data } = fragment;

    // Skip snapshot acknowledgments (they're not data fragments)
    if (total === 1 && index === 0 && data && typeof data === 'string' && data.includes('snapshot')) {
      console.log(`Skipping snapshot acknowledgment for msgId: ${msgId}`);
      return;
    }

    if (!this.messageFragments.has(msgId)) {
      this.messageFragments.set(msgId, {
        fragments: [],
        total,
        received: 0
      });
    }

    const fragmentData = this.messageFragments.get(msgId)!;

    // If we receive a fragment with a different total, update it (handles case where first fragment was 1/1 ack)
    if (total !== fragmentData.total && fragmentData.received === 0) {
      console.log(`Updating total from ${fragmentData.total} to ${total} for msgId: ${msgId}`);
      fragmentData.total = total;
      fragmentData.fragments = new Array(total);
    }

    // Use 0-based indexing like the working script
    fragmentData.fragments[index] = data;
    fragmentData.received++;

    console.log(`Received data fragment ${index + 1}/${total} for msgId: ${msgId} (${fragmentData.received}/${fragmentData.total})`);

    // Check if we have all fragments (like the working script)
    if (fragmentData.received === fragmentData.total) {
      console.log(`All ${fragmentData.total} fragments received, reassembling...`);

      // Reassemble the message (like the working script)
      const completeMessage = fragmentData.fragments.join('');
      console.log(`Reassembled message length: ${completeMessage.length}`);

      try {
        const parsedMessage = JSON.parse(completeMessage);
        console.log(`Parsed complete message successfully`);

        // Get the fragment data before deleting it
        const fragmentData = this.messageFragments.get(msgId);

        // Clean up
        this.messageFragments.delete(msgId);

        // Find and resolve the promise for this msgId
        console.log(`Fragment data found:`, !!fragmentData);

        if (fragmentData && fragmentData.resolve) {
          console.log(`Resolving promise for msgId: ${msgId}`);

          // Return the same format as the working script
          const responseObject = {
            command: 'portfolios.positions',
            msgId: msgId,
            data: parsedMessage.data || parsedMessage
          };
          console.log('Calling resolve function...');
          fragmentData.resolve(responseObject);
          console.log('Promise resolved successfully');
        } else {
          console.log(`No resolve function found for msgId: ${msgId}`);
        }
      } catch (error) {
        console.error('Error parsing reassembled message:', error);
        // Handle error case
        if (this.positionsPromises.has(msgId)) {
          const { reject } = this.positionsPromises.get(msgId)!;
          this.positionsPromises.delete(msgId);
          reject(error);
        }
      }
    }
  }

  private async sendCommand(command: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const message = {
        command,
        msgId,
        ...params
      };

      // Special handling for portfolios.positions command
      if (command === 'portfolios.positions') {
        // Set up fragment handling for positions
        this.setupFragmentHandling(msgId, resolve, reject);
      } else {
        this.responsePromises.set(msgId, { resolve, reject });
      }

      console.log(`Sending command: ${command} with msgId: ${msgId}`);
      this.mainWs!.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.responsePromises.has(msgId)) {
          this.responsePromises.delete(msgId);
          reject(new Error(`Command ${command} timed out`));
        }
        if (this.messageFragments.has(msgId)) {
          this.messageFragments.delete(msgId);
          reject(new Error(`Command ${command} timed out`));
        }
      }, 30000);
    });
  }

  private setupFragmentHandling(msgId: string, resolve: Function, reject: Function) {
    console.log(`Setting up fragment handling for msgId: ${msgId}`);
    // Initialize fragment tracking
    this.messageFragments.set(msgId, {
      fragments: [],
      total: -1,
      received: 0,
      resolve,
      reject
    });
    console.log(`Fragment tracking set up for ${msgId}, resolve function: ${!!resolve}`);
  }

  private async getAllPortfolios(): Promise<any[]> {
    try {
      console.log('Fetching all portfolios...');
      const portfolios = await PortfolioModel.find({}, '_id name').lean();
      console.log(`Found ${portfolios.length} portfolios`);
      return portfolios;
    } catch (error) {
      console.error('Error fetching portfolios:', error);
      throw error;
    }
  }

  private async savePositionsData(portfolioId: string, positionsData: PositionsResponse) {
    try {
      console.log('MongoDB connection state:', connection.readyState);
      console.log('Connection db:', !!connection.db);

      const portfolioHistoryCollection = connection.db.collection('portfolioHistory');
      console.log('Got portfolioHistory collection');

      // Extract TOTAL data and positions
      const totalData = this.extractTotalData(positionsData);
      const positions = this.extractPositionData(positionsData);

      console.log(`Extracted totalData:`, !!totalData);
      console.log(`Extracted positions count:`, positions.length);

      if (!totalData) {
        console.log(`No TOTAL data found for portfolio ${portfolioId}, skipping...`);
        return;
      }

      const document = {
        portfolioId,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date(),
        total: totalData,
        positions: positions
      };

      console.log('About to insert document...');
      await portfolioHistoryCollection.insertOne(document);
      console.log(`Saved portfolio history for portfolio ${portfolioId} with ${positions.length} positions`);
    } catch (error) {
      console.error(`Error saving positions data for portfolio ${portfolioId}:`, error);
      console.error('Error details:', (error as Error).message);
      console.error('Error stack:', (error as Error).stack);
      throw error;
    }
  }

  private extractTotalData(positionsData: PositionsResponse): any {
    // Check if positionsData.data is an array (actual positions response)
    if (Array.isArray(positionsData.data)) {
      const positions = positionsData.data;
      // Find the TOTAL entry
      const totalEntry = positions.find((pos: any) =>
        pos.symbol === 'TOTAL' || pos.totalType === 'total'
      );
      return totalEntry || null;
    }

    // Legacy check for positionsData.positions
    if (!positionsData.positions) return null;
    const totalEntry = positionsData.positions.find((pos: any) =>
      pos.symbol === 'TOTAL' || pos.totalType === 'total'
    );
    return totalEntry || null;
  }

  private extractPositionData(positionsData: PositionsResponse): any[] {
    // Check if positionsData.data is an array (actual positions response)
    if (Array.isArray(positionsData.data)) {
      const positions = positionsData.data;
      // Filter out TOTAL and other summary entries, keep only actual positions
      return positions
        .filter((pos: any) => pos.symbol !== 'TOTAL' && !pos.totalType)
        .map((pos: any) => ({
          symbol: pos.symbol,
          marketValue: pos.marketValue || pos.marketValueSymbol,
          investedFull: pos.investedFull || pos.investedFullSymbol
        }));
    }

    // Legacy check for positionsData.positions
    if (!positionsData.positions) return [];
    return positionsData.positions
      .filter((pos: any) => pos.symbol !== 'TOTAL' && !pos.totalType)
      .map((pos: any) => ({
        symbol: pos.symbol,
        marketValue: pos.marketValue,
        investedFull: pos.investedFull
      }));
  }

  public async collectDailyPositions(): Promise<void> {
    try {
      console.log('Starting daily portfolio positions collection...');

      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Connect to main WebSocket
      await this.connectToMainWebSocket();

      // Step 3: Get all portfolios
      const portfolios = await this.getAllPortfolios();

      // Step 4: Collect positions for each portfolio
      for (const portfolio of portfolios) {
        try {
          console.log(`Collecting positions for portfolio: ${portfolio.name} (${portfolio._id})`);

          const positionsResponse = await this.sendCommand('portfolios.positions', {
            _id: portfolio._id,
            requestType: '0' // Snapshot mode
          });

          if (positionsResponse) {
            await this.savePositionsData(portfolio._id, positionsResponse);
          }

          // Small delay between requests to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Failed to collect positions for portfolio ${portfolio.name}:`, error);
          // Continue with other portfolios
        }
      }

      console.log('Daily portfolio positions collection completed successfully');

    } catch (error) {
      console.error('Error in daily positions collection:', error);
      throw error;
    } finally {
      // Cleanup
      if (this.mainWs) {
        this.mainWs.close();
      }
    }
  }

  public async testConnection(): Promise<void> {
    try {
      console.log('Testing PS2 connection...');

      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Connect to main WebSocket
      await this.connectToMainWebSocket();

      // Step 3: Test with a simple command
      console.log('Testing with portfolios.list command...');
      const testResponse = await this.sendCommand('portfolios.list', { limit: 1 });

      console.log('Test response:', testResponse);

      console.log('Connection test successful');

    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    } finally {
      if (this.mainWs) {
        this.mainWs.close();
      }
    }
  }

  public async testPortfolio(portfolioId: string): Promise<void> {
    try {
      console.log(`Testing portfolio positions collection for portfolio: ${portfolioId}`);

      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Connect to main WebSocket
      await this.connectToMainWebSocket();

      // Step 3: Get positions for specific portfolio
      console.log(`Getting positions for portfolio: ${portfolioId}`);

      const positionsResponse = await this.sendCommand('portfolios.positions', {
        _id: portfolioId,
        requestType: '0' // Snapshot mode
      });

      if (positionsResponse) {
        console.log('Portfolio positions result received, processing...');
        console.log('Response structure:', Object.keys(positionsResponse));
        console.log('Response data type:', typeof positionsResponse.data);
        console.log('Response data is array:', Array.isArray(positionsResponse.data));

        console.log('Portfolio positions result:');
        console.log(JSON.stringify({
          command: 'portfolios.positions',
          msgId: `positions_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          data: positionsResponse
        }, null, 2));

        console.log('About to save positions data...');
        await this.savePositionsData(portfolioId, positionsResponse);
        console.log('Positions data saved successfully');
      } else {
        console.log('No positions response received');
      }

    } catch (error) {
      console.error('Portfolio test failed:', error);
      throw error;
    } finally {
      if (this.mainWs) {
        this.mainWs.close();
      }
    }
  }
}

// Main execution
async function main() {
  const collector = new DailyPortfolioPositionsCollector();

  const args = process.argv.slice(2);
  const command = args[0];
  const portfolioId = args[1];

  try {
    if (command === 'test') {
      if (portfolioId) {
        await collector.testPortfolio(portfolioId);
      } else {
        await collector.testConnection();
      }
    } else {
      await collector.collectDailyPositions();
    }
  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default DailyPortfolioPositionsCollector;
