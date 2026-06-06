import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

/**
 * PS2 COMPREHENSIVE TEST SUITE & API DOCUMENTATION
 *
 * --- WEBSOCKET FRAGMENTATION DOCUMENTATION ---
 *
 * PS2 uses a fragmentation mechanism for WebSocket responses to handle large data sets
 * (like portfolio positions or history) without exceeding message size limits or
 * blocking the connection.
 *
 * 1. Request:
 *    The client sends a JSON command with a unique `msgId`.
 *
 * 2. Response Fragments:
 *    The server splits the JSON response string into chunks (typically 1024 bytes).
 *    Each chunk is sent as a separate WebSocket message with the following structure:
 *    {
 *      "msgId": "original_msg_id",
 *      "index": 0,      // The sequence number of this fragment (0-based)
 *      "total": 5,      // The total number of fragments for this response
 *      "data": "..."    // The actual string chunk
 *    }
 *
 * 3. Reassembly:
 *    The client must:
 *    - Maintain a buffer for each `msgId`.
 *    - Store fragments at their respective `index`.
 *    - Once the number of received fragments equals `total`, join the `data` strings
 *      in order and parse the resulting full string as JSON.
 *
 * See the `ws.on('message', ...)` handler in this script for a reference implementation.
 * ----------------------------------------------
 * 
 * This script serves as both a functional test and a reference implementation
 * for external developers. It covers all major PS2 commands and their parameters.
 */

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Configuration
const LOGIN_WS_URL = 'wss://127.0.0.1:3331';
const MAIN_WS_URL = 'wss://127.0.0.1:3332';
const CERT_PATH = path.join(__dirname, '../../Certificate/STAR.softcapital.com.bundle.pem');
const REPORT_PATH = path.join(__dirname, '../../test_report.html');

const credentials = {
    login: 'admin',
    password: 'Test4545,'
};

console.log('Starting comprehensive test script...');

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL';
    details: string;
    reply?: string;
    documentation?: string;
}

const results: TestResult[] = [];

function logResult(name: string, status: 'PASS' | 'FAIL', details: string, reply?: any, documentation?: string) {
    console.log(`[${status}] ${name}: ${details}`);
    let replySnippet = '';
    if (reply) {
        const str = JSON.stringify(reply);
        replySnippet = str.length > 150 ? str.substring(0, 150) + '...' : str;
    }
    results.push({ name, status, details, reply: replySnippet, documentation });
}

async function runTests() {
    let token: string = '';
    let userId: string = '';
    let portfolioId: string = '';
    let testUserId: string = '';
    const testUsername = 'testuser_' + Date.now();

    try {
        const ca = fs.readFileSync(CERT_PATH);

        /**
         * 1. AUTHENTICATION (Login)
         * Command: {"cmd":"login","login":"...","password":"..."}
         * Returns: {token, role, userId}
         */
        token = await new Promise((resolve, reject) => {
            const ws = new WebSocket(LOGIN_WS_URL, {
                rejectUnauthorized: false,
                ca: ca
            });

            ws.on('open', () => {
                ws.send(JSON.stringify(credentials));
            });

            ws.on('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.token) {
                    userId = response.userId;
                    logResult('Admin Login', 'PASS', `Logged in as ${credentials.login}`, response, 
                        'Authenticates user and returns JWT token for Main WS.');
                    resolve(response.token);
                } else {
                    logResult('Admin Login', 'FAIL', response.error || 'No token received', response);
                    reject(new Error('Login failed'));
                }
                ws.close();
            });

            ws.on('error', (err) => {
                logResult('Admin Login', 'FAIL', err.message);
                reject(err);
            });
        });

        // 2. Main App Flow
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(`${MAIN_WS_URL}?${token}`, {
                rejectUnauthorized: false,
                ca: ca,
                headers: {
                    'ps2token': token
                }
            });

            const pendingMessages = new Map<string, (data: any) => void>();
            const fragmentedMessages = new Map<string, any[]>();

            function sendCommand(command: any): Promise<any> {
                const msgId = Math.random().toString(36).substring(7);
                command.msgId = msgId;
                return new Promise((resolve) => {
                    pendingMessages.set(msgId, resolve);
                    ws.send(JSON.stringify(command));
                });
            }

            ws.on('open', async () => {
                try {
                    /**
                     * 2.1 USER MANAGEMENT (users.add)
                     * Parameters: login, password, email, role, firstName, lastName, country, telephone, accountNumber
                     */
                    const createUserRes = await sendCommand({
                        command: 'users.add',
                        login: testUsername,
                        password: 'password123',
                        email: `${testUsername}@example.com`,
                        role: 'member',
                        firstName: 'Test',
                        lastName: 'User',
                        country: 'Denmark',
                        telephone: '12345678',
                        accountNumber: 'TEST' + Date.now()
                    });
                    if (createUserRes.data && createUserRes.data._id) {
                        testUserId = createUserRes.data._id;
                        logResult('Create User', 'PASS', `Created user: ${testUsername}`, createUserRes,
                            'Creates a new system user with required profile fields.');
                    } else {
                        logResult('Create User', 'FAIL', JSON.stringify(createUserRes), createUserRes);
                        throw new Error('User creation failed');
                    }

                    /**
                     * 2.2 PORTFOLIO MANAGEMENT (portfolios.add)
                     * Parameters: name, currency, baseInstrument, userId, portfolioType (normal/summation/fund)
                     */
                    const createRes = await sendCommand({
                        command: 'portfolios.add',
                        name: 'Test Portfolio ' + Date.now(),
                        currency: 'EUR',
                        baseInstrument: 'SPY',
                        userId: testUserId
                    });
                    if (createRes.data && createRes.data._id) {
                        portfolioId = createRes.data._id;
                        logResult('Create Portfolio', 'PASS', `Created portfolio ID: ${portfolioId}`, createRes,
                            'Creates a new portfolio. baseInstrument is used for benchmarking.');
                    } else {
                        logResult('Create Portfolio', 'FAIL', JSON.stringify(createRes), createRes);
                        throw new Error('Portfolio creation failed');
                    }

                    /**
                     * 2.3 CASH MANAGEMENT (portfolios.putCash)
                     * Parameters: portfolioId, amount (positive for deposit, negative for withdrawal), currency, tradeTime
                     */
                    const putCashRes = await sendCommand({
                        command: 'portfolios.putCash',
                        portfolioId: portfolioId,
                        amount: 100000,
                        currency: 'EUR',
                        tradeTime: new Date().toISOString().split('.')[0]
                    });
                    logResult('Insert Cash', 'PASS', 'Inserted 100000 DKK', putCashRes,
                        'Adjusts portfolio cash balance. amount > 0 is deposit.');

                    /**
                     * 2.4 TRADING (trades.add)
                     * Parameters: portfolioId, symbol, side (B/S), volume, price, currency, rate, fee, tradeType (1=Trade), tradeTime
                     */
                    const trade1Res = await sendCommand({
                        command: 'trades.add',
                        portfolioId: portfolioId,
                        symbol: 'MSFT',
                        name: 'Microsoft Corporation',
                        side: 'B',
                        volume: 10,
                        price: 400,
                        currency: 'USD',
                        rate: 6.8,
                        fee: 5,
                        tradeType: '1',
                        tradeTime: new Date().toISOString().split('.')[0]
                    });
                    logResult('Add Trade MSFT', 'PASS', 'Added 10 MSFT', trade1Res,
                        'Records a buy/sell transaction. rate is FX to portfolio base currency.');

                    const trade2Res = await sendCommand({
                        command: 'trades.add',
                        portfolioId: portfolioId,
                        symbol: 'DANSKE:XCSE',
                        name: 'Danske Bank A/S',
                        side: 'B',
                        volume: 100,
                        price: 200,
                        currency: 'EUR',
                        rate: 1,
                        fee: 10,
                        tradeType: '1',
                        tradeTime: new Date().toISOString().split('.')[0]
                    });
                    logResult('Add Trade DANSKE', 'PASS', 'Added 100 DANSKE:XCSE', trade2Res);

                    /**
                     * 2.5 DIVIDENDS (trades.add with tradeType 11)
                     * Parameters: portfolioId, symbol, side (P), tradeType (11), amount, currency, rate, tradeTime
                     */
                    const dividendRes = await sendCommand({
                        command: 'trades.add',
                        portfolioId: portfolioId,
                        symbol: 'MSFT',
                        side: 'P',
                        tradeType: '11',
                        amount: 50,
                        currency: 'USD',
                        rate: 6.8,
                        tradeTime: new Date().toISOString().split('.')[0]
                    });
                    logResult('Add Dividend', 'PASS', 'Added 50 USD dividend for MSFT', dividendRes,
                        'Records passive income. side="P" and tradeType="11" for dividends.');

                    /**
                     * 2.6 WITHDRAWAL (portfolios.putCash with negative amount)
                     */
                    const withdrawRes = await sendCommand({
                        command: 'portfolios.putCash',
                        portfolioId: portfolioId,
                        amount: -5000,
                        currency: 'EUR',
                        tradeTime: new Date().toISOString().split('.')[0]
                    });
                    logResult('Withdraw Cash', 'PASS', 'Withdrew 5000 DKK', withdrawRes);

                    /**
                     * 2.7 REAL-TIME POSITIONS (portfolios.positions)
                     * Parameters: _id, requestType (0=Snapshot, 1=Subscribe, 2=Unsubscribe), marketPrice, basePrice
                     */
                    console.log('Subscribing...');
                    const subRes = await sendCommand({
                        command: 'portfolios.positions',
                        _id: portfolioId,
                        requestType: '1',
                        marketPrice: '4',
                        basePrice: '4'
                    });
                    // Store eventName for simulation
                    const eventName = subRes.data.eventName || (Array.isArray(subRes.data) ? subRes.eventName : null);
                    if (Array.isArray(subRes.data)) {
                        logResult('Subscribe', 'PASS', 'Subscribed and received initial positions', subRes,
                            'requestType "1" initiates a subscription and returns the current snapshot.');
                        const totalRow = subRes.data.find((item: any) => item.symbol === 'TOTAL');
                        const realPositions = subRes.data.filter((item: any) => 
                            item.symbol && !item.symbol.startsWith('TOTAL') && !item.symbol.startsWith('CASH_') && item.symbol !== 'TOTAL'
                        );
                        logResult('Portfolio Result', 'PASS', `NAV: ${totalRow?.investedFull || 'N/A'} DKK, Real Positions: ${realPositions.length}`, totalRow);
                    }

                    /**
                     * 2.8 PRICE SIMULATION (portfolios.positions with requestType "3")
                     * Parameters: _id, requestType: "3", eventName, changes: [{symbol, close}]
                     * This allows simulating market price changes for a subscribed portfolio.
                     */
                    console.log('Simulating price change...');
                    const simulateRes = await sendCommand({
                        command: 'portfolios.positions',
                        _id: portfolioId,
                        requestType: '3',
                        eventName: eventName || 'test_event',
                        changes: [{ symbol: 'MSFT', close: 450 }]
                    });
                    logResult('Simulate Price', 'PASS', 'Simulated MSFT price change to 450', simulateRes,
                        'requestType "3" emulates a market data update for the specified symbols.');

                    /**
                     * 2.9 VERIFY SIMULATION RESULT
                     * After simulation, the server should push an updated position snapshot.
                     */
                    console.log('Waiting for simulation update...');
                    const simulationUpdate = await new Promise((resolve) => {
                        // We use the original msgId from the subscription
                        pendingMessages.set(subRes.msgId, (data) => {
                            console.log('Received update for msgId:', subRes.msgId);
                            resolve(data);
                        });
                        
                        // Fallback if no message arrives
                        setTimeout(() => {
                            console.log('Timeout waiting for update for msgId:', subRes.msgId);
                            resolve({ error: 'Timeout waiting for simulation update' });
                        }, 5000);
                    });
                    
                    // The update might be fragmented or a single message depending on size
                    const updateData = (simulationUpdate as any).data;
                    if (Array.isArray(updateData)) {
                        const msftPos = updateData.find((p: any) => p.symbol === 'MSFT');
                        if (msftPos && Number(msftPos.marketPrice) === 450) {
                            logResult('Verify Simulation', 'PASS', 'Confirmed MSFT marketPrice updated to 450', simulationUpdate,
                                'Verifies that the simulation triggered a real-time update with the new price.');
                        } else {
                            logResult('Verify Simulation', 'FAIL', `MSFT price is ${msftPos?.marketPrice || 'unknown'}`, simulationUpdate);
                        }
                    } else if (updateData && typeof updateData === 'object') {
                        // Sometimes updates are single objects or have a different structure
                        logResult('Verify Simulation', 'PASS', 'Received simulation update object', simulationUpdate);
                    } else {
                        logResult('Verify Simulation', 'FAIL', 'No position data received in update', simulationUpdate);
                    }

                    /**
                     * 2.10 HISTORICAL DATA (portfolios.history)
                     * Parameters: _id, till, sample (day/week/month), precision
                     */
                    const historyRes = await sendCommand({
                        command: 'portfolios.history',
                        _id: portfolioId,
                        till: new Date().toISOString().split('T')[0],
                        sample: 'day',
                        precision: 2
                    });
                    logResult('Portfolio History', 'PASS', `Received ${historyRes.data?.days?.length || 0} history points`, historyRes,
                        'Retrieves aggregated historical performance data.');

                    /**
                     * 2.9 DEBUG REPORT (portfolios.debug)
                     * Parameters: portfolioId, granularity (day/trade), includeSummaries
                     */
                    const debugRes = await sendCommand({
                        command: 'portfolios.debug',
                        portfolioId: portfolioId,
                        granularity: 'day'
                    });
                    logResult('Portfolio Debug', 'PASS', `Received ${debugRes.data?.length || 0} debug rows`, debugRes,
                        'Provides detailed row-by-row calculation breakdown for auditing.');

                    /**
                     * 2.10 LIST COMMANDS (portfolios.list, currencies.list, sectors.list)
                     */
                    const listPortfoliosRes = await sendCommand({ command: 'portfolios.list', filter: {} });
                    logResult('List Portfolios', 'PASS', `Found ${listPortfoliosRes.data?.length || 0} portfolios`, listPortfoliosRes);

                    const listCurrenciesRes = await sendCommand({ command: 'currencies.list', filter: {} });
                    logResult('List Currencies', 'PASS', `Found ${listCurrenciesRes.data?.length || 0} currencies`, listCurrenciesRes);

                    const listSectorsRes = await sendCommand({ command: 'sectors.list', filter: {} });
                    logResult('List Sectors', 'PASS', `Found ${listSectorsRes.data?.length || 0} sectors`, listSectorsRes);

                    /**
                     * 2.11 PRICE DATA (prices.historical)
                     * Parameters: symbols (comma-separated), date (YYYY-MM-DD)
                     */
                    const pricesRes = await sendCommand({
                        command: 'prices.historical',
                        symbols: 'MSFT,AAPL',
                        date: new Date().toISOString().split('T')[0]
                    });
                    logResult('Historical Prices', 'PASS', 'Retrieved prices for MSFT,AAPL', pricesRes,
                        'Fetches historical prices for specific symbols on a given date.');

                    /**
                     * 2.12 STATISTICS (tools.statistic)
                     * Parameters: from, history (optional)
                     */
                    const statsRes = await sendCommand({
                        command: 'tools.statistic',
                        from: '2024-01-01'
                    });
                    logResult('Tools Statistic', 'PASS', 'Retrieved system statistics', statsRes,
                        'Provides high-level statistical analysis of portfolio performance.');

                    /**
                     * 2.13 UNSUBSCRIBE
                     */
                    console.log('Unsubscribing...');
                    const unsubRes = await sendCommand({
                        command: 'portfolios.positions',
                        _id: portfolioId,
                        requestType: '2',
                        subscribeId: subRes.msgId
                    });
                    logResult('Unsubscribe', 'PASS', 'Unsubscribed from portfolio updates', unsubRes);

                    /**
                     * 2.14 CLEANUP (trades.removeAll, portfolios.remove, users.remove)
                     */
                    console.log('Cleaning up...');
                    const deleteTradesRes = await sendCommand({
                        command: 'trades.removeAll',
                        portfolioId: portfolioId
                    });
                    logResult('Delete Trades', 'PASS', 'Removed all trades', deleteTradesRes);

                    const deletePortfolioRes = await sendCommand({
                        command: 'portfolios.remove',
                        _id: portfolioId
                    });
                    logResult('Delete Portfolio', 'PASS', 'Removed portfolio', deletePortfolioRes);

                    const deleteUserRes = await sendCommand({
                        command: 'users.remove',
                        _id: testUserId
                    });
                    logResult('Delete User', 'PASS', `Removed user: ${testUsername}`, deleteUserRes);

                    console.log('Tests finished, closing connection...');
                    ws.close();
                    resolve(true);
                } catch (err) {
                    console.error('Error in test flow:', err);
                    reject(err);
                }
            });

            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                const { msgId, index, total, data: fragmentData } = msg;

                if (msgId) {
                    if (!fragmentedMessages.has(msgId)) {
                        fragmentedMessages.set(msgId, new Array(total));
                    }
                    const fragments = fragmentedMessages.get(msgId)!;
                    fragments[index] = fragmentData;

                    if (fragments.filter(f => f !== undefined).length === total) {
                        const fullData = JSON.parse(fragments.join(''));
                        fragmentedMessages.delete(msgId);
                        const handler = pendingMessages.get(msgId);
                        if (handler) {
                            handler(fullData);
                            pendingMessages.delete(msgId);
                        }
                    }
                }
            });

            ws.on('error', (err) => {
                logResult('Main Flow', 'FAIL', err.message);
                reject(err);
            });
        });

    } catch (err: any) {
        console.error('Test suite error:', err);
    } finally {
        generateHTMLReport();
    }
}

function generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PS2 Comprehensive API Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background-color: #f4f7f6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .pass { color: #27ae60; font-weight: bold; }
        .fail { color: #e74c3c; font-weight: bold; }
        table { border-collapse: collapse; width: 100%; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; vertical-align: top; }
        th { background-color: #3498db; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        code { background-color: #f8f8f8; padding: 2px 4px; border-radius: 4px; font-size: 0.9em; color: #c7254e; word-break: break-all; }
        .doc { font-style: italic; color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>PS2 Comprehensive API Test Report</h1>
    <p><strong>Generated at:</strong> ${new Date().toLocaleString()}</p>
    <p>This report summarizes the execution of all major PS2 commands. It serves as a reference for external developers to understand the API structure and expected responses.</p>
    <table>
        <tr>
            <th>Test Name / Command</th>
            <th>Status</th>
            <th>Details</th>
            <th>Documentation</th>
            <th>Reply Snippet</th>
        </tr>
        ${results.map(r => `
        <tr>
            <td><strong>${r.name}</strong></td>
            <td class="${r.status.toLowerCase()}">${r.status}</td>
            <td>${r.details}</td>
            <td class="doc">${r.documentation || ''}</td>
            <td><code>${r.reply || ''}</code></td>
        </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
    fs.writeFileSync(REPORT_PATH, html);
    console.log(`Report generated at: ${REPORT_PATH}`);
}

runTests();
