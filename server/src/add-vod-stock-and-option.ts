import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PortfolioModel } from './models/portfolio';
import { add as addTrade } from './services/trade';
import { TradeInput } from './types/trade';
import { ContractType } from './types/contract';
import { UserData } from './services/websocket';
import { fetchHistory } from './utils/fetchData';

dotenv.config();
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// Adds a VOD:XLON (Vodafone, London) stock position plus a matching call option, into DERIV-USD -
// a real GBX-pence-quoted underlying, so the console can be exercised during EU trading hours and
// the pence-scaling fix (theoPrice's spot input, positions.ts) can be checked against a live feed
// rather than only the emulation panel.
async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  const portfolio = await PortfolioModel.findOne({ name: 'DERIV-USD' }).lean();
  if (!portfolio) throw new Error('DERIV-USD portfolio not found');
  const userData: UserData = { userId: portfolio.userId, login: 'test', role: 'admin' };

  // fetchHistory returns raw feed values (pence, per Aktia's "Price - Currency": "GBX") - trade
  // prices are stored in major units (pounds) throughout ps2, matching how existing GBX positions
  // (e.g. Sync3's MNG:XLON) are booked - see isPenceQuoted's docs in utils/index.ts.
  const history = await fetchHistory({ symbol: 'VOD:XLON' });
  const lastCloseGBX = history.length > 0 ? history[history.length - 1].close : undefined;
  if (lastCloseGBX == null) throw new Error('Could not resolve a current VOD price from history');
  const lastCloseGBP = lastCloseGBX / 100;
  console.log(`VOD last close: ${lastCloseGBX}p = £${lastCloseGBP} (${history[history.length - 1].date})`);

  const stockTrade: TradeInput = {
    tradeId: '', side: 'B', tradeType: '1',
    portfolioId: portfolio._id.toString(), accountId: '',
    symbol: 'VOD:XLON',
    name: 'Vodafone Group Public Limited Company',
    volume: 1000,
    price: lastCloseGBP,
    currency: 'GBP',
    fee: 0, feeSymbol: 0, rate: 1,
    userId: portfolio.userId, tradeTime: '', exchangeTime: '', updateTime: '', oldTradeId: '',
    tradeSource: 'manual', orderId: '', comment: 'VOD stock position', state: '',
  };
  const stockAdded = await addTrade(stockTrade, () => {}, 'msg-vod-stock', 'manual-add', userData);
  if ((stockAdded as { error?: string })?.error) {
    throw new Error(`stock trades.add failed: ${(stockAdded as { error: string }).error}`);
  }
  console.log('Stock trade added:', (stockAdded as unknown as { _id: string })._id);

  // Near-the-money call, strike in pounds (same units as the scaled spot - see positions.ts's
  // pence-scaling comment on the theoPrice spot input).
  const strike = Math.round(lastCloseGBP * 20) / 20 + 0.05; // nearest 5p, one step OTM
  const optionTrade: TradeInput = {
    tradeId: '', side: 'B', tradeType: '1',
    portfolioId: portfolio._id.toString(), accountId: '',
    symbol: undefined as unknown as string,
    name: '', volume: 10, price: 0.05, currency: 'GBP', fee: 0, feeSymbol: 0, rate: 1,
    userId: portfolio.userId, tradeTime: '', exchangeTime: '', updateTime: '', oldTradeId: '',
    tradeSource: 'manual', orderId: '', comment: 'VOD call option', state: '',
    contract: {
      underlyingSymbolMic: 'VOD:XLON',
      contractType: ContractType.Call,
      strike,
      expirationDate: '2026-09-18',
      symbol: `VOD260918C${String(Math.round(strike * 1000)).padStart(8, '0')}`,
      multiplier: 1000,
      market: 'ICE',
    },
  };
  const optionAdded = await addTrade(optionTrade, () => {}, 'msg-vod-opt', 'manual-add', userData);
  if ((optionAdded as { error?: string })?.error) {
    throw new Error(`option trades.add failed: ${(optionAdded as { error: string }).error}`);
  }
  console.log('Option trade added:', JSON.stringify(optionAdded, null, 2));
  console.log(`\nStrike: £${strike}, spot: £${lastCloseGBP}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error('Failed:', err); process.exit(1); });
