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

// One-off end-to-end smoke test (not a permanent fixture): book a real OTC option trade against
// the DERIV-USD test portfolio through the actual trades.add() path (exercising the new
// trade.contract -> upsertContractForTrade -> contractId wiring), then subscribe to
// portfolios.positions the same way a client would and watch contractId/theoPrice flow through.
async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  const portfolio = await PortfolioModel.findOne({ name: 'DERIV-USD' }).lean();
  if (!portfolio) throw new Error('DERIV-USD portfolio not found - create it first');
  console.log('Using portfolio', portfolio._id.toString(), portfolio.name, portfolio.currency);

  const userData: UserData = { userId: portfolio.userId, login: 'test', role: 'admin' };

  // Clean slate: remove any trades this script left behind on a previous run.
  await TradeModel.deleteMany({ portfolioId: portfolio._id.toString(), tradeSource: 'e2e-test' });

  const trade: TradeInput = {
    tradeId: '',
    side: 'B',
    tradeType: '1',
    portfolioId: portfolio._id.toString(),
    accountId: '',
    symbol: undefined as unknown as string, // deliberately omitted - see services/trade.ts's add()
    name: '',
    volume: 2,
    price: 15.5,
    currency: 'USD',
    fee: 1,
    feeSymbol: 1,
    rate: 1,
    userId: portfolio.userId,
    tradeTime: '', // let add() default it via new Date().toISOString()
    exchangeTime: '',
    updateTime: '',
    oldTradeId: '',
    tradeSource: 'e2e-test',
    orderId: '',
    comment: 'e2e derivatives test',
    state: '',
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

  const added = await addTrade(
    trade,
    () => {},
    'test-add-msg',
    'test-user-modif',
    userData,
  );
  console.log('\n=== trades.add result ===');
  console.log(added);

  if ((added as { error?: string })?.error) {
    throw new Error(`trades.add failed: ${(added as { error: string }).error}`);
  }

  console.log('\n=== subscribing to portfolios.positions ===');
  const fakeSocket = { readyState: 1 } as any; // WebSocket.OPEN

  let responseCount = 0;
  const sendResponse = (data?: object) => {
    responseCount++;
    console.log(`\n--- positions response #${responseCount} ---`);
    console.log(JSON.stringify(data, null, 2));
  };

  const subResult = await positions(
    { _id: portfolio._id.toString(), requestType: '1' },
    sendResponse,
    'test-positions-msg',
    'test-user-modif',
    userData,
    fakeSocket,
  );
  console.log('\n=== positions subscribe call returned ===');
  console.log(subResult);

  console.log('\nWaiting 15s for live SSE ticks to flow through contractId/theoPrice wiring...');
  await new Promise((resolve) => setTimeout(resolve, 15000));

  console.log(`\nTotal streamed responses received: ${responseCount}`);
  console.log('Done - leaving subscription open is fine, process will exit and tear it down.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
