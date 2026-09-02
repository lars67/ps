import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ContractModel } from './models/contract';
import { ContractType } from './types/contract';
import { upsertContractForTrade } from './services/derivatives/upsertContractForTrade';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// Ad hoc strike ladder for cross-checking theoPrice output against another pricing system -
// MSFT:XNAS, expiration 2026-09-18, calls and puts at each strike. Not part of the core
// representative fixture set (see seed-test-contracts.ts) - a separate script since this is a
// one-off validation request, not the canonical 4-contract demo set.
const STRIKES = [380, 385, 390, 395, 400];
const EXPIRATION = '2026-09-18';

function occSymbol(strike: number, callPut: 'C' | 'P'): string {
  const strikeCode = String(Math.round(strike * 1000)).padStart(8, '0');
  return `MSFT260918${callPut}${strikeCode}`;
}

async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);
  await ContractModel.init();

  for (const strike of STRIKES) {
    const call = await upsertContractForTrade({
      underlyingSymbolMic: 'MSFT:XNAS',
      contractType: ContractType.Call,
      strike,
      expirationDate: EXPIRATION,
      symbol: occSymbol(strike, 'C'),
      multiplier: 100,
      market: 'OPRA',
    });
    console.log(`Call ${strike}:`, call._id.toString(), call.symbol, call.theoModel);

    const put = await upsertContractForTrade({
      underlyingSymbolMic: 'MSFT:XNAS',
      contractType: ContractType.Put,
      strike,
      expirationDate: EXPIRATION,
      symbol: occSymbol(strike, 'P'),
      multiplier: 100,
      market: 'OPRA',
    });
    console.log(`Put  ${strike}:`, put._id.toString(), put.symbol, put.theoModel);
  }

  const all = await ContractModel.find({ underlyingSymbolMic: 'MSFT:XNAS', expirationDate: EXPIRATION }).lean();
  console.log(`\nTotal MSFT contracts for ${EXPIRATION}: ${all.length}`);
  console.table(
    all.map((c) => ({
      _id: c._id.toString(),
      contractType: c.contractType,
      strike: c.strike,
      symbol: c.symbol,
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
