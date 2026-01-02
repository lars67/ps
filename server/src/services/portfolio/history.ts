import { UserData } from "../../services/websocket";
import { PortfolioHistoryCache } from "./historyCache";
import { PortfolioHistoryService } from "./historyService";
import { PortfolioCalculator } from "./portfolioCalculator";

// Define Params type locally
type HistoryParams = {
  _id: string;
  from?: string;
  till?: string;
  detail?: string; // 0|1
  sample?: string; // day|week|month - Resampling not implemented in this version yet
  precision?: number;
  forceRefresh?: boolean;    // NEW: Force recalculation
  maxAge?: number;          // NEW: Max acceptable data age (minutes)
  streamUpdates?: boolean;  // NEW: Enable real-time updates
};

// Renamed function back to 'history'
export async function history(
  { _id, from, till, detail = "0", sample, precision = 2, forceRefresh = false, maxAge = 1440 }: HistoryParams,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<object> {
  try {
    // --- 1. Input Validation ---
    if (!_id) {
      return { error: "Portfolio _id is required" };
    }

    const withDetail = Number(detail) !== 0;

    // --- 2. Check Cache First (unless force refresh) ---
    if (!forceRefresh) {
      try {
        const cacheResult = await PortfolioHistoryCache.getHistory(_id, from, till, maxAge);

        // If we have cached data, return it immediately
        if (cacheResult.cached && cacheResult.days.length > 0) {
          console.log(`Serving cached history for portfolio ${_id} (${cacheResult.days.length} days, ${cacheResult.cacheAge}min old)`);

          return {
            days: cacheResult.days,
            cached: true,
            cacheAge: cacheResult.cacheAge,
            ...(cacheResult.metadata && { metadata: cacheResult.metadata }),
            ...(withDetail && { details: [] }) // Cached data doesn't include details
          };
        }

        // If cache returned empty (no data exists), fall through to calculation
        if (cacheResult.cached === false) {
          console.log(`No cached history found for portfolio ${_id}, calculating from scratch`);
        }
      } catch (cacheError) {
        console.warn(`Cache check failed for portfolio ${_id}, falling back to calculation:`, cacheError);
        // Continue to calculation if cache fails
      }
    }

    // --- 3. Force Refresh Cache Clearing ---
    if (forceRefresh) {
      console.log(`Force full recalculation requested for portfolio ${_id}`);
      // For force refresh, we clear ALL caches first, then do fresh calculation
      // The caches will NOT be updated after calculation completes
      try {
        // Clear portfolio history cache from MongoDB
        await PortfolioHistoryService.deleteHistory(_id);
        console.log(`Portfolio history cache cleared for portfolio ${_id} due to forceRefresh`);

        // Clear in-memory price caches to force fresh price fetching
        const { clearCaches } = require('../services/app/priceCashe');
        clearCaches();
      } catch (deleteError) {
        console.warn(`Failed to clear caches for portfolio ${_id}:`, deleteError);
        // Continue with calculation even if cache clearing fails
      }
    }

    // --- 4. Calculate History Using Shared Calculator ---
    const calculationResult = await PortfolioCalculator.calculatePortfolioHistory(_id, from, till, precision, forceRefresh, false); // incrementalUpdate = false for user requests

    if (calculationResult.error) {
      return { error: calculationResult.error };
    }

    const { days, withoutPrices } = calculationResult;

    // --- 5. Store Results in Cache (only if not force refresh) ---
    if (!forceRefresh) {
      try {
        // Convert DayType[] to PortfolioHistoryDay[] for storage
        const historyDays = days.map(day => ({
          portfolioId: _id,
          date: day.date,
          invested: day.invested,
          investedWithoutTrades: day.investedWithoutTrades,
          cash: day.cash,
          nav: day.nav,
          index: day.index,
          perfomance: day.perfomance,
          shares: day.shares,
          navShare: day.navShare,
          perfShare: day.perfShare,
          lastUpdated: new Date(),
          isCalculated: true
        }));

        // Save to cache asynchronously (don't await to not slow down response)
        PortfolioHistoryService.saveHistoryDays(historyDays).catch(err => {
          console.error(`Failed to save calculated history for portfolio ${_id}:`, err);
        });

        console.log(`Calculated and cached ${historyDays.length} days of history for portfolio ${_id}`);
      } catch (cacheError) {
        console.error(`Error preparing history data for cache for portfolio ${_id}:`, cacheError);
        // Continue with response even if caching fails
      }
    } else {
      console.log(`Force refresh completed for portfolio ${_id} - cache was cleared and not updated`);
    }

    // --- 6. Final Output ---
    // TODO: Implement resampling logic if required based on 'sample' parameter

    return {
        ...(withoutPrices.length > 0 && { info: `Used trades for interpolating prices/rates: ${withoutPrices.join(',')}` }),
        days,
        ...(withDetail && { details: [] }) // Details not implemented in this version
    };

  } catch (err) {
    console.error("Critical error in history function:", err);
    return { error: `Failed to generate history: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Note: Performance calculation logic (like getPortfolioPerfomance) was complex and potentially
// contributing to errors. It has been removed for this refactor but can be added back carefully if needed.
// Resampling logic also needs to be re-implemented if the 'sample' parameter is used.
