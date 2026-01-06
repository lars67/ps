import { UserData } from "../../services/websocket";
import { PortfolioHistoryCache } from "./historyCache";
import { PortfolioHistoryService } from "./historyService";
import { PortfolioCalculator } from "./portfolioCalculator";
import { createPortfolioHistoryJob, getPortfolioJobManager } from "./jobManager";
import moment from "moment";

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

/**
 * Estimate if a portfolio history calculation will be long-running
 * @param from Start date
 * @param till End date
 * @returns true if calculation is estimated to take >2 seconds
 */
function isLongRunningCalculation(from?: string, till?: string): boolean {
  if (!from || !till) {
    // No date range specified - assume could be long
    return true;
  }

  try {
    const startDate = moment(from);
    const endDate = moment(till);

    if (!startDate.isValid() || !endDate.isValid()) {
      return true; // Invalid dates - assume long
    }

    const daysDiff = endDate.diff(startDate, 'days');

    // Estimate: > 2 years (730 days) is considered long-running
    // This typically involves 700+ days of calculation with price lookups
    return daysDiff > 730;
  } catch (error) {
    // If date parsing fails, assume long-running to be safe
    return true;
  }
}

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

    // --- 4. Determine Calculation Strategy ---
    const shouldUseWorker = isLongRunningCalculation(from, till) || forceRefresh;

    if (shouldUseWorker) {
      // --- Long-running calculation: Use worker threads ---
      console.log(`🔄 Using worker thread for portfolio ${_id} history calculation (estimated long-running)`);

      try {
        // Create async job for calculation
        const jobId = await createPortfolioHistoryJob(
          _id,
          from,
          till,
          precision,
          forceRefresh,
          msgId,
          {
            onComplete: (result) => {
              // Job completed successfully - cache the results and notify via WebSocket
              console.log(`✅ Worker calculation completed for portfolio ${_id}, job ${jobId}`);

              // Cache results asynchronously
              if (!forceRefresh && result.days) {
                try {
                  const historyDays = result.days.map((day: any) => ({
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

                  PortfolioHistoryService.saveHistoryDays(historyDays).catch(err => {
                    console.error(`Failed to cache worker results for portfolio ${_id}:`, err);
                  });
                } catch (cacheError) {
                  console.error(`Error preparing worker results for cache:`, cacheError);
                }
              }

              // TODO: Send completion notification to client via WebSocket
              // This will be implemented in Phase 2.2
            },
            onError: (error) => {
              console.error(`❌ Worker calculation failed for portfolio ${_id}, job ${jobId}:`, error);
              // TODO: Send error notification to client via WebSocket
              // This will be implemented in Phase 2.2
            }
          }
        );

        // Return immediately with job status
        return {
          status: 'processing',
          jobId,
          message: 'Calculation started in background. Use job status commands to check progress.',
          estimatedDuration: '10-30 seconds for long histories'
        };

      } catch (jobError) {
        console.error(`Failed to create worker job for portfolio ${_id}:`, jobError);
        // Fallback to synchronous calculation if worker fails
        console.log(`⚠️ Worker job creation failed, falling back to synchronous calculation`);
      }
    }

    // --- Short-running calculation: Use synchronous method ---
    console.log(`⚡ Using synchronous calculation for portfolio ${_id} (estimated short-running)`);

    const calculationResult = await PortfolioCalculator.calculatePortfolioHistory(_id, from, till, precision, forceRefresh, false);

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
