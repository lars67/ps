import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ContractModel } from './models/contract';
import { ContractType } from './types/contract';
import { upsertContractForTrade } from './services/derivatives/upsertContractForTrade';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// One-off seed script exercising the new ContractModel end to end (connection, schema
// validation, unique indexes, automatic dividendRate/theoModel derivation) with 4 representative
// contracts:
//   1. MSFT call option    - underlying resolves to a real Aktia.Symbols document (MSFT:XNAS)
//   2. MSFT put option     - same underlying
//   3. ES future           - underlyingSymbolMic uses SPY:ARCX (SPDR S&P 500 ETF Trust), a real
//                            Aktia.Symbols document, as a stand-in for the true CME S&P 500
//                            future underlying: Aktia.Symbols has no futures/index coverage at
//                            all (verified: no ES/SPX/CME entries exist there - it's an
//                            equities/ETF/fund/bond database sourced from EODHD/Yahoo). SPY
//                            tracks the same index the real ES future is on, so it's a
//                            reasonable real-data proxy for this test contract, not the literal
//                            CME future's underlying. See docs/derivatives/03-migration-notes.md
//                            in portfolio-server for the open question this leaves (futures/index
//                            underlyings still have no proper home).
//   4. ES option on future - same underlyingSymbolMic (SPY:ARCX) as #3, plus baseContractId
//                            pointing at the future (#3), since it's priced off the future, not
//                            directly off the underlying.
async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  // Wait for indexes (unique compound indexes) to be ready before inserting.
  await ContractModel.init();

  // Same upsert-by-identity helper services/trade.ts's add() uses for real OTC option/future
  // trades - exercising it here doubles as the seed script's own end-to-end test of that path.
  const msftCall = await upsertContractForTrade({
    underlyingSymbolMic: 'MSFT:XNAS',
    contractType: ContractType.Call,
    strike: 400,
    expirationDate: '2026-08-21',
    symbol: 'MSFT260821C00400000',
    multiplier: 100,
    market: 'OPRA',
  });
  console.log('MSFT call:', msftCall._id.toString());

  const msftPut = await upsertContractForTrade({
    underlyingSymbolMic: 'MSFT:XNAS',
    contractType: ContractType.Put,
    strike: 380,
    expirationDate: '2026-08-21',
    symbol: 'MSFT260821P00380000',
    multiplier: 100,
    market: 'OPRA',
  });
  console.log('MSFT put:', msftPut._id.toString());

  // SPY:ARCX (SPDR S&P 500 ETF Trust) stands in for the ES future's true underlying - Aktia.Symbols
  // has no futures/index coverage at all (verified: no ES/SPX/CME entries exist there). SPY tracks
  // the same index the real ES future is on, a reasonable real-data proxy for test data, not the
  // literal CME future's underlying. See docs/derivatives/03-migration-notes.md in portfolio-server
  // for the open question this leaves (futures/index underlyings still have no proper home).
  const esFuture = await upsertContractForTrade({
    underlyingSymbolMic: 'SPY:ARCX',
    contractType: ContractType.Future,
    expirationDate: '2026-09-18',
    symbol: 'ESU26',
    multiplier: 50,
    market: 'XCME',
  });
  console.log('ES future:', esFuture._id.toString());

  const esOptionOnFuture = await upsertContractForTrade({
    underlyingSymbolMic: 'SPY:ARCX', // same underlying reference as the future
    contractType: ContractType.Call,
    strike: 6300,
    expirationDate: '2026-08-21',
    symbol: 'ESU26C6300',
    multiplier: 50,
    market: 'XCME',
    baseContractId: esFuture._id.toString(), // priced off the ES future, not a cash index
  });
  console.log('ES option on future:', esOptionOnFuture._id.toString());

  const all = await ContractModel.find({}).lean();
  console.log(`\nTotal contracts in collection: ${all.length}`);
  console.table(
    all.map((c) => ({
      _id: c._id.toString(),
      underlyingSymbolMic: c.underlyingSymbolMic,
      contractType: c.contractType,
      strike: c.strike,
      expirationDate: c.expirationDate,
      symbol: c.symbol,
      baseContractId: c.baseContractId?.toString() ?? '',
      dividendRate: c.dividendRate,
      theoModel: c.theoModel ?? '',
    })),
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
