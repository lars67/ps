import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { YieldCurveModel } from './models/currencyYield';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';

// Static placeholder yield curve data (short-term risk-free rate proxy per currency, annualized
// percentage points) so resolveRiskFreeRate.ts has something other than 0 to read while theoPrice
// is being verified. NOT live data - to be superseded once iexproxy pushes real bid/ask/last
// quotes into this same Yieldcurves collection (see types/currencyYield.ts). Covers the
// currencies actually seen across ps2 portfolios today; add more as needed.
const PLACEHOLDER_YIELDS: Record<string, { bid: number; ask: number; last: number }> = {
  USD: { bid: 4.20, ask: 4.30, last: 4.25 },
  EUR: { bid: 2.85, ask: 2.95, last: 2.90 },
  GBP: { bid: 3.95, ask: 4.05, last: 4.00 },
  CHF: { bid: 0.45, ask: 0.55, last: 0.50 },
  SEK: { bid: 2.20, ask: 2.30, last: 2.25 },
  DKK: { bid: 1.75, ask: 1.85, last: 1.80 },
  NOK: { bid: 4.20, ask: 4.30, last: 4.25 },
  CAD: { bid: 2.70, ask: 2.80, last: 2.75 },
  JPY: { bid: 0.40, ask: 0.50, last: 0.45 },
  PLN: { bid: 5.20, ask: 5.30, last: 5.25 },
  AUD: { bid: 3.60, ask: 3.70, last: 3.65 },
};

async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to', mongoUri);

  await YieldCurveModel.init();

  const updateTime = new Date().toISOString();
  for (const [currency, { bid, ask, last }] of Object.entries(PLACEHOLDER_YIELDS)) {
    await YieldCurveModel.findOneAndUpdate(
      { currency },
      { currency, bid, ask, last, updateTime },
      { upsert: true, new: true },
    );
    console.log(`${currency}: bid=${bid} ask=${ask} last=${last}`);
  }

  const all = await YieldCurveModel.find({}).lean();
  console.log(`\nTotal yield curve documents: ${all.length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
