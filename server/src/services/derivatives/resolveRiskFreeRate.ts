import { YieldCurveModel } from "../../models/currencyYield";

// Risk-free rate input for theoPrice (see docs/derivatives/02-pricing-engine.md's "Required
// inputs per calculation" in portfolio-server - riskFreeRate/baseRiskFreeRate). Reads the flat
// per-currency yield from the Yieldcurves collection, stored as bid/ask/last (matching the quote
// shape iexproxy will eventually push here - currently seeded with static data, see
// seed-yield-curves.ts): prefer last (an actual traded/observed rate) over the bid/ask mid,
// mirroring how FX rates fall back to average spread when no close is available (positions.ts).
// Missing currency, or a document with none of the three fields set, defaults to 0 rather than
// guessing, same philosophy as resolveDividendYield.ts.
export async function resolveRiskFreeRate(currency: string): Promise<number> {
  const doc = await YieldCurveModel.findOne({ currency }).lean();
  if (!doc) return 0;
  if (typeof doc.last === "number") return doc.last;
  if (typeof doc.bid === "number" && typeof doc.ask === "number") return (doc.bid + doc.ask) / 2;
  return 0;
}
