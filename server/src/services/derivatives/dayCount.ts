import { DayCountConvention } from "../../types/contract";

// Year fraction between two YYYY-MM-DD dates, per the given day-count convention - ps2's first
// pass at day-count support (see docs/derivatives/03-migration-notes.md in portfolio-server,
// "Underlying -> Expiration -> Strike" cascade). Simplifications, both explicitly noted since
// they diverge from full textbook conventions:
//   - ACT/ACT here is the simple single-year approximation (actual days / 365 or 366 depending on
//     whether the *start* date's calendar year is a leap year), not the full ISDA multi-year-
//     weighted method - fine for the sub-1-year expiries ps2 deals with so far, revisit if a
//     multi-year option ever needs pricing.
//   - 30/365 treats each month as exactly 30 days (a standard 30/360-style numerator) but divides
//     by 365, not 360 - a non-standard combination, but what was asked for.
export function calcYearFraction(fromDate: string, toDate: string, convention: DayCountConvention): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const msPerDay = 24 * 3600 * 1000;
  const actualDays = (to.getTime() - from.getTime()) / msPerDay;

  switch (convention) {
    case DayCountConvention.ActAct: {
      const year = from.getUTCFullYear();
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return actualDays / (isLeap ? 366 : 365);
    }

    case DayCountConvention.Thirty365: {
      const d1 = Math.min(from.getUTCDate(), 30);
      const d2 = Math.min(to.getUTCDate(), 30);
      const days =
        (to.getUTCFullYear() - from.getUTCFullYear()) * 360 +
        (to.getUTCMonth() - from.getUTCMonth()) * 30 +
        (d2 - d1);
      return days / 365;
    }

    case DayCountConvention.Act365:
    default:
      return actualDays / 365;
  }
}
