import { UserData } from "../../services/websocket";
import { PortfolioHistoryService } from "./historyService";
import { getPortfolioWorkerPool } from "./workerPool";
import { DayType } from "./portfolioWorker";
import moment from "moment";

// Define Params type locally
type HistoryParams = {
  _id: string;
  from?: string;
  till?: string;
  detail?: string; // 0|1
  sample?: string; // day|week|month
  precision?: number;
  forceRefresh?: boolean;
  maxAge?: number;          // kept for API compatibility (unused in new flow)
  streamUpdates?: boolean;
};

function toCacheDay(day: DayType, portfolioId: string) {
  return {
    portfolioId,
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
    isCalculated: true,
  };
}

export async function history(
  { _id, from, till, detail = "0", sample, precision = 2, forceRefresh = false }: HistoryParams,
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
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

    // --- 2. Non-forceRefresh: serve cached data immediately then stream update ---
    if (!forceRefresh) {
      let metadata: Awaited<ReturnType<typeof PortfolioHistoryService.getMetadata>>;
      try {
        metadata = await PortfolioHistoryService.getMetadata(_id);
      } catch (e) {
        console.warn(`Could not fetch metadata for ${_id}, falling back to full calc:`, e);
        metadata = null;
      }

      if (metadata && metadata.totalRecords > 0) {
        // We have data — serve it immediately as first response
        let existingDays: Awaited<ReturnType<typeof PortfolioHistoryService.getHistory>>;
        try {
          existingDays = await PortfolioHistoryService.getHistory(_id, from, till);
        } catch (e) {
          console.warn(`Could not fetch history for ${_id}:`, e);
          existingDays = [];
        }

        if (existingDays.length > 0) {
          const cacheAge = Math.round((Date.now() - metadata.lastUpdated.getTime()) / 60000);
          console.log(`✅ Serving cached history for ${_id} (${existingDays.length} days, ${cacheAge}min old)`);

          // First response — send immediately so the GUI can show something
          sendResponse({
            days: existingDays,
            cached: true,
            cacheAge,
            ...(withDetail && { details: [] }),
          });

          // Determine how far we have data
          const lastDate = metadata.lastCalculatedDate
            || existingDays[existingDays.length - 1].date;

          if (lastDate >= yesterday) {
            // Already up to date — second response not needed
            console.log(`History for ${_id} is current (lastDate=${lastDate})`);
            return { done: true };
          }

          // --- Incremental update: only calculate missing days ---
          const incrementalFrom = moment(lastDate).add(1, 'day').format('YYYY-MM-DD');
          console.log(`📈 Incremental update for ${_id}: ${incrementalFrom} → ${yesterday}`);

          try {
            const { days: newDays, withoutPrices } =
              await getPortfolioWorkerPool().executePortfolioHistory(
                _id, incrementalFrom, till, precision, false,
              );

            if (newDays.length > 0) {
              // Persist new days
              await PortfolioHistoryService.saveHistoryDays(
                (newDays as DayType[]).map(d => toCacheDay(d, _id)),
              ).catch(e => console.error(`Failed to save incremental days for ${_id}:`, e));

              console.log(`✅ Appended ${newDays.length} incremental days for ${_id}`);
              // Second response — just the new days so the client can append/merge
              return {
                days: newDays,
                cached: false,
                update: true,
                ...(withoutPrices.length > 0 && { info: `Interpolated: ${withoutPrices.join(',')}` }),
                ...(withDetail && { details: [] }),
              };
            }
          } catch (err) {
            // Incremental update failed — we already sent the cached data, so this is non-fatal
            console.error(`Incremental update failed for ${_id}:`, err);
          }

          return { done: true };
        }
      }

      // No data in DB at all — fall through to full calculation
      console.log(`❌ No cached history for ${_id}, calculating from scratch`);
    }

    // --- 3. forceRefresh: wipe existing data and price caches ---
    if (forceRefresh) {
      console.log(`Force full recalculation for portfolio ${_id}`);
      try {
        await PortfolioHistoryService.deleteHistory(_id);
        const { clearCaches } = require('../app/priceCashe');
        clearCaches();
      } catch (e) {
        console.warn(`Failed to clear caches for ${_id}:`, e);
      }
    }

    // --- 4. Full calculation via worker pool ---
    console.log(`🧵 Full history calculation via worker for ${_id}`);
    const { days, withoutPrices } = await getPortfolioWorkerPool().executePortfolioHistory(
      _id, from, till, precision, forceRefresh,
    );

    // --- 5. Persist result (always, including after forceRefresh) ---
    if (days.length > 0) {
      PortfolioHistoryService.saveHistoryDays(
        (days as DayType[]).map(d => toCacheDay(d, _id)),
      ).catch(e => console.error(`Failed to cache full history for ${_id}:`, e));
      // fire-and-forget: don't block the response
    }

    return {
      days,
      cached: false,
      ...(withoutPrices.length > 0 && { info: `Interpolated: ${withoutPrices.join(',')}` }),
      ...(withDetail && { details: [] }),
    };

  } catch (err) {
    console.error("Critical error in history function:", err);
    return { error: `Failed to generate history: ${err instanceof Error ? err.message : String(err)}` };
  }
}
