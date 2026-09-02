import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PortfolioModel } from './models/portfolio';
import { add as addTrade } from './services/trade';
import { TradeInput } from './types/trade';
import { UserData } from './services/websocket';
import { fetchHistory } from './utils/fetchData';

dotenv.config();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// One-off: add a plain MSFT:XNAS equity position (volume 100) to DERIV-USD, alongside the option
// test positions already there - lets the emulation test (test-option-emulation.ts) and any UI
// check exercise a real underlying holding next to the option that prices off the same symbol.
async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  const portfolio = await PortfolioModel.findOne({ name: 'DERIV-USD' }).lean();
  if (!portfolio) throw new Error('DERIV-USD portfolio not found');
  const userData: UserData = { userId: portfolio.userId, login: 'test', role: 'admin' };

  const history = await fetchHistory({ symbol: 'MSFT' });
  const lastClose = history.length > 0 ? history[history.length - 1].close : undefined;
  if (lastClose == null) throw new Error('Could not resolve a current MSFT price from history');
  console.log(`Using MSFT last close: ${lastClose} (${history[history.length - 1].date})`);

  const trade: TradeInput = {
    tradeId: '', side: 'B', tradeType: '1',
    portfolioId: portfolio._id.toString(), accountId: '',
    symbol: 'MSFT:XNAS',
    name: 'Microsoft Corporation',
    volume: 100,
    price: lastClose,
    currency: 'USD',
    fee: 0,
    feeSymbol: 0,
    rate: 1,
    userId: portfolio.userId,
    tradeTime: '',
    exchangeTime: '',
    updateTime: '',
    oldTradeId: '',
    tradeSource: 'manual',
    orderId: '',
    comment: 'MSFT stock position',
    state: '',
  };

  const added = await addTrade(trade, () => {}, 'msg-add-msft', 'manual-add', userData);
  if ((added as { error?: string })?.error) {
    throw new Error(`trades.add failed: ${(added as { error: string }).error}`);
  }
  console.log('Trade added:', JSON.stringify(added, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error('Failed:', err); process.exit(1); });
