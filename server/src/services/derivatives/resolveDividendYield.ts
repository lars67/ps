// Aktia.Symbols pools multiple data vendors, and the dividend-yield field name differs by the
// document's `Type`. Known so far (see docs/derivatives/03-migration-notes.md in portfolio-server
// for how this was discovered - MSFT vs SPY have completely different field sets):
//   Type "Common Stock" -> "Dividend yield % (indicated)"
//   Type "ETF"          -> "Annual Dividend Yield %"
// Add a case here the first time a new Type is observed with a real yield field, rather than
// guessing at names for types we haven't looked at yet (INDEX/FUND/Mutual Fund/etc. - Aktia.Symbols
// docs of those types seen so far didn't carry the full fundamentals block at all).
export function resolveDividendYield(aktiaSymbolDoc: Record<string, unknown> | null | undefined): number {
  if (!aktiaSymbolDoc) return 0;

  const type = aktiaSymbolDoc.Type as string | undefined;

  if (type === "Common Stock") {
    const v = aktiaSymbolDoc["Dividend yield % (indicated)"];
    if (typeof v === "number") return v;
  }

  if (type === "ETF") {
    const v = aktiaSymbolDoc["Annual Dividend Yield %"];
    if (typeof v === "number") return v;
  }

  return 0;
}
