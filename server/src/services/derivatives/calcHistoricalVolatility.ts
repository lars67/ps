import { fetchHistory } from "../../utils/fetchData";

// Annualized realized volatility from daily closes: standard deviation of daily log returns,
// scaled by sqrt(252) (trading days/year - the standard finance annualization convention, distinct
// from the calendar-day-count conventions used for time-to-expiry elsewhere - see dayCount.ts).
//
// Preferred over Aktia.Symbols' vendor volatility fields (see resolveVolatility.ts) per the user's
// direction (2026-07-06): those turned out to be unreliable for at least Common Stock underlyings
// (two vendor-duplicated fields disagreeing by ~2x for MSFT, neither validated against a
// known-good figure - see docs/derivatives/03-migration-notes.md in portfolio-server). Real price
// history is verifiable and standard; a vendor field that can't be checked isn't.
//
// Returns undefined (not a guess, not zero) if there isn't enough history to compute a meaningful
// figure - callers should fall back to resolveVolatility.ts's Aktia.Symbols field in that case.
const TRADING_DAYS_PER_YEAR = 252;
const DEFAULT_LOOKBACK_DAYS = 30;
const MIN_OBSERVATIONS = 10;

export async function calcHistoricalVolatility(
  symbol: string,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
): Promise<number | undefined> {
  const history = await fetchHistory({ symbol });
  const closes = history.map((h) => h.close).filter((c): c is number => typeof c === "number" && c > 0);
  if (closes.length < MIN_OBSERVATIONS + 1) return undefined;

  const recent = closes.slice(-(lookbackDays + 1));
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    logReturns.push(Math.log(recent[i] / recent[i - 1]));
  }
  if (logReturns.length < MIN_OBSERVATIONS) return undefined;

  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);

  // Percentage points, matching resolveVolatility.ts's / dividendRate's existing convention.
  return dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}
