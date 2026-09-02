import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PortfolioModel } from './models/portfolio';
import { TradeModel } from './models/trade';
import { add as addTrade } from './services/trade';
import { positions } from './services/portfolio/positions';
import { TradeInput } from './types/trade';
import { ContractType } from './types/contract';
import { UserData } from './services/websocket';

dotenv.config();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// Verifies that requestType "3" ("emulation mode") - pushing a synthetic underlying price tick
// onto a live portfolios.positions subscription - actually recomputes an option position's
// theoPrice, the same way a real MSFT quote tick would (see positions.ts's contractCalcContexts
// forEach block). Books a fresh MSFT call against DERIV-USD, subscribes, captures the
// as-subscribed theoPrice, then emulates two very different MSFT spot prices and checks theoPrice
// actually moves (and moves the right direction: higher spot -> higher call theoPrice).
async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  const portfolio = await PortfolioModel.findOne({ name: 'DERIV-USD' }).lean();
  if (!portfolio) throw new Error('DERIV-USD portfolio not found');
  const userData: UserData = { userId: portfolio.userId, login: 'test', role: 'admin' };

  await TradeModel.deleteMany({ portfolioId: portfolio._id.toString(), tradeSource: 'emulation-test' });

  const trade: TradeInput = {
    tradeId: '', side: 'B', tradeType: '1',
    portfolioId: portfolio._id.toString(), accountId: '',
    symbol: undefined as unknown as string,
    name: '', volume: 2, price: 15.5, currency: 'USD', fee: 1, feeSymbol: 1, rate: 1,
    userId: portfolio.userId, tradeTime: '', exchangeTime: '', updateTime: '', oldTradeId: '',
    tradeSource: 'emulation-test', orderId: '', comment: 'emulation test', state: '',
    contract: {
      underlyingSymbolMic: 'MSFT:XNAS',
      contractType: ContractType.Call,
      strike: 420,
      expirationDate: '2026-09-18',
      symbol: 'MSFT260918C00420000',
      multiplier: 100,
      market: 'OPRA',
    },
  };
  const added = await addTrade(trade, () => {}, 'msg-add', 'emu-test-user', userData);
  if ((added as { error?: string })?.error) throw new Error(`trades.add failed: ${(added as { error: string }).error}`);
  console.log('Booked contract:', (added as { contractId: string }).contractId);

  const responses: any[] = [];
  const sendResponse = (data?: object) => { responses.push(data); };
  const fakeSocket = { readyState: 1 } as any;

  const subResult = await positions(
    { _id: portfolio._id.toString(), requestType: '1', marketPrice: '9' }, // "9" = Theoretical
    sendResponse, 'msg-sub', 'emu-test-user', userData, fakeSocket,
  ) as { msg: string; eventName: string };
  console.log('Subscribed (marketPrice=9/Theoretical), eventName =', subResult.eventName);

  const waitForResponse = (timeoutMs = 8000): Promise<any> =>
    new Promise((resolve) => {
      const before = responses.length;
      const start = Date.now();
      const check = () => {
        if (responses.length > before) return resolve(responses[responses.length - 1]);
        if (Date.now() - start > timeoutMs) return resolve(undefined);
        setTimeout(check, 100);
      };
      check();
    });

  const report = (label: string, arr: any[] | undefined) => {
    const pos = Array.isArray(arr) ? arr.find((p: any) => p.symbol === 'MSFT260918C00420000') : undefined;
    const total = Array.isArray(arr) ? arr.find((p: any) => p.symbol === 'TOTAL') : undefined;
    console.log(
      `${label}: theoPrice=${pos?.theoPrice} marketPrice=${pos?.marketPrice} marketValue=${pos?.marketValue} ` +
      `result=${pos?.result} | TOTAL.marketValue=${total?.marketValue} TOTAL.result=${total?.result}`,
    );
  };

  console.log('\nWaiting for initial (real) snapshot...');
  const initial = await waitForResponse();
  report('Initial (real spot)', initial);

  for (const spot of [300, 600]) {
    console.log(`\n--- Emulating MSFT spot = ${spot} ---`);
    await positions(
      { _id: portfolio._id.toString(), requestType: '3', eventName: subResult.eventName, changes: [{ symbol: 'MSFT:XNAS', close: spot }] as any },
      sendResponse, 'msg-emu', 'emu-test-user', userData, fakeSocket,
    );
    const update = await waitForResponse();
    report(`spot=${spot}`, update);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error('Test failed:', err); process.exit(1); });
