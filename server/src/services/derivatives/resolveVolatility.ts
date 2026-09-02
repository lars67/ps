// FALLBACK ONLY (per user, 2026-07-06): buildContractCalcContexts.ts now prefers real historical
// realized volatility (calcHistoricalVolatility.ts, computed from actual price history) and only
// falls back to this Aktia.Symbols vendor field when there isn't enough price history to compute
// one. That change was driven by this field turning out to be unreliable: MSFT's "Volatility 1
// month" (1.56) produced an implausibly low theoPrice once there was a real calc to check it
// against - see docs/derivatives/03-migration-notes.md in portfolio-server, open question 6.
//
// Aktia.Symbols pools multiple data vendors, and (like dividend yield - see
// resolveDividendYield.ts) the volatility field name and even presence differs by the document's
// `Type`. Known so far:
//   Type "Common Stock" -> two vendor-duplicated fields observed with meaningfully different
//                          values for MSFT ("Volatility 1 month" = 1.56 vs "Volatility, 1 month"
//                          = 3.18) - picking the no-comma field as primary, matching the no-comma
//                          field resolveDividendYield already treats as primary for Common Stock.
//                          Neither value has been validated against a known-good annualized vol.
//   Type "ETF"          -> no "Volatility" field at all; "Standard Deviation" is the closest proxy
//                          (SPY = 37.22, a plausible annualized-vol-percentage magnitude).
// Add a case here the first time a new Type is observed with a real volatility field, rather than
// guessing at names for types we haven't looked at yet.
export function resolveVolatility(aktiaSymbolDoc: Record<string, unknown> | null | undefined): number {
  if (!aktiaSymbolDoc) return 0;

  const type = aktiaSymbolDoc.Type as string | undefined;

  if (type === "Common Stock") {
    const v = aktiaSymbolDoc["Volatility 1 month"];
    if (typeof v === "number") return v;
  }

  if (type === "ETF") {
    const v = aktiaSymbolDoc["Standard Deviation"];
    if (typeof v === "number") return v;
  }

  return 0;
}
