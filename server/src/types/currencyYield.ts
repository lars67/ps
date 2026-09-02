import { ObjectId } from "mongodb";

// The risk-free rate input JCalc needs per currency (see docs/derivatives/02-pricing-engine.md's
// "Required inputs per calculation" in portfolio-server - riskFreeRate/baseRiskFreeRate). The old
// system interpolated this by tenor from a `currency_yield_points` table; this is a deliberately
// simpler v1 - one flat annualized yield per currency, no tenor curve - matching what's actually
// needed to get theoPrice computing at all. Revisit if tenor-sensitive pricing (e.g. LEAPS) turns
// out to need real curve interpolation.
//
// Stored as bid/ask/last rather than a single flat rate, matching the quote shape iexproxy will
// eventually push here (see resolveRiskFreeRate.ts for how these three collapse to one working
// rate) - for now this collection is seeded with static placeholder data (seed-yield-curves.ts),
// not live-updated.
export type YieldCurve = {
  currency: string; // ISO code, matches Currency.symbol (models/currency.ts) - e.g. "USD"
  bid?: number; // annualized yield, percentage points (e.g. 5 means 5%), matching the convention
  ask?: number; // Contract.dividendRate already uses (see services/derivatives/resolveDividendYield.ts)
  last?: number;
  updateTime?: string;
};

export type YieldCurveWithID = YieldCurve & { _id: string | ObjectId };
