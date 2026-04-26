import { parentPort, workerData } from 'worker_threads';
import mongoose from 'mongoose';
import moment from "moment";
import { Trade, TradeTypes, TradeSide } from "../../types/trade";
import { Portfolio } from "../../types/portfolio";
import { getPortfolioTrades } from "../../utils/portfolio";
import {
  checkPortfolioPricesCurrencies,
  checkPrices,
  fillDateHistoryFromTrades,
  getDateSymbolPrice,
  getRate,
  checkPriceCurrency,
  getDatePrices
} from "../../services/app/priceCashe";
import { getPortfolioInstanceByIDorName } from "./helper";
import { isValidDateFormat, toNum } from "../../utils";
import { formatYMD, errorMsgs } from "../../constants";

// Define DayType locally as it might differ slightly or be removed from original history.ts eventually
export type DayType = {
  date: string;
  invested: number,
  investedWithoutTrades: number, // Represents market value change without trades
  cash: number,
  nav: number,
  index: number, // Value of the base instrument
  perfomance: number; // Daily performance (placeholder)
  shares: number;
  navShare: number;
  perfShare: number;
}

// Define Params type locally
type HistoryParams = {
  portfolioId: string;
  from?: string;
  till?: string;
  precision?: number;
  forceRefresh?: boolean;
};

// Helper type for daily holdings state
type HoldingsMap = Record<string, { volume: number; currency: string }>;

// Worker task interface
interface WorkerTask {
  id: string;
  type: 'portfolio_history';
  data: HistoryParams;
}

// Worker result interface
interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: {
    days: DayType[];
    withoutPrices: string[];
  };
  error?: string;
}

// Helper function to calculate daily portfolio performance
function getPortfolioPerfomance(
  currentDay: string,
  portfolioCurrency: string,
  oldPortfolio: Record<string, Partial<Trade>>
): number {
  let sum = 0;
  let sumInvested = 0;
  const beforeDay = moment(currentDay, formatYMD)
    .add(-1, "day")
    .format(formatYMD);

  Object.keys(oldPortfolio).forEach((symbol: string) => {
    const pi = oldPortfolio[symbol] as Trade;
    const price = toNum({
      n: getDateSymbolPrice(currentDay, symbol) as number,
    });
    const rate = getRate(pi.currency, portfolioCurrency, currentDay);
    const priceBefore = toNum({
      n: getDateSymbolPrice(beforeDay, symbol) as number,
    });
    const rateBefore = getRate(pi.currency, portfolioCurrency, beforeDay);

    if (price && rate && priceBefore && rateBefore) {
      sum += (price * rate - priceBefore * rateBefore) * pi.volume;
      sumInvested += priceBefore * rateBefore * pi.volume;
    }
  });

  return sumInvested > 0 ? Math.round((10000 * sum) / sumInvested) / 100 : 0;
}

/**
 * Portfolio Calculator for Worker Threads
 * Contains the core calculation logic moved from PortfolioCalculator
 */
class WorkerPortfolioCalculator {

  /**
   * Calculate portfolio history for a date range
   */
  static async calculatePortfolioHistory(
    portfolioId: string,
    from?: string,
    till?: string,
    precision: number = 2,
    forceRefresh: boolean = false
  ): Promise<{
    days: DayType[];
    withoutPrices: string[];
    error?: string;
  }> {
    try {
      const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision });

      // Get portfolio instance
      const { instance: portfolio, error: portfolioError } = await getPortfolioInstanceByIDorName(portfolioId, { userId: '', role: 'admin', login: '' });

      if (portfolioError || !portfolio) {
        return { days: [], withoutPrices: [], error: typeof portfolioError === 'string' ? portfolioError : (portfolioError as {error: string})?.error || `Portfolio not found: ${portfolioId}` };
      }

      const realId = (portfolio as any)._id?.toString() || portfolioId;

      // Fetch ALL Relevant Trades
      const allTradesResult = await getPortfolioTrades(realId, undefined, {
        state: { $in: ["1"] },
        ...(till && isValidDateFormat(till) && { tradeTime: { $lte: `${till.split("T")[0]}T23:59:59` } }),
      });

      if ((allTradesResult as { error: string }).error) {
        return { days: [], withoutPrices: [], error: (allTradesResult as { error: string }).error };
      }
      const allTrades = (allTradesResult as Trade[]).sort((a, b) => moment(a.tradeTime).diff(moment(b.tradeTime)));

      if (allTrades.length === 0 && !from) {
        return { days: [], withoutPrices: [] };
      }

      // Determine Date Range
      let startDateMoment: moment.Moment;
      const firstTradeDate = allTrades.length > 0 ? allTrades[0].tradeTime.split("T")[0] : null;

      if (from) {
        if (!isValidDateFormat(from)) return { days: [], withoutPrices: [], error: "Wrong 'from' date format" };
        startDateMoment = moment.utc(from.split("T")[0], formatYMD);
        if (firstTradeDate && startDateMoment.isBefore(moment.utc(firstTradeDate, formatYMD))) {
          console.warn(`'from' date ${from} is before first trade date ${firstTradeDate}. Using first trade date as start.`);
          startDateMoment = moment.utc(firstTradeDate, formatYMD);
        }
      } else if (firstTradeDate) {
        startDateMoment = moment.utc(firstTradeDate, formatYMD);
      } else {
        return { days: [], withoutPrices: [] };
      }

      let endDateMoment: moment.Moment;
      if (till) {
        if (!isValidDateFormat(till)) return { days: [], withoutPrices: [], error: "Wrong 'till' date format" };
        endDateMoment = moment.utc(till.split("T")[0], formatYMD);
      } else {
        // Exclude today's trading day from results to avoid incomplete data
        endDateMoment = moment.utc().subtract(1, 'day');
      }

      if (startDateMoment.isAfter(endDateMoment)) {
        return { days: [], withoutPrices: [], error: "'from' date cannot be after 'till' date" };
      }

      const startDateString = startDateMoment.format(formatYMD);
      const endDateString = endDateMoment.format(formatYMD);

      // Detect incremental mode: a 'from' date was supplied and there are trades before it.
      // In this case we only need prices for the new period; pre-period state uses trade.rate.
      const tradesBeforeStartDate = allTrades.filter(trade =>
        moment.utc(trade.tradeTime).isBefore(startDateMoment, 'day')
      );
      const isIncrementalMode = !!from && tradesBeforeStartDate.length > 0;

      // Fetch Price Data
      // For incremental mode: extract symbols/currencies directly (avoid triggering a full
      // historical price load via checkPortfolioPricesCurrencies which uses the first trade date).
      // For full mode: use checkPortfolioPricesCurrencies as before.
      let uniqueSymbols: string[];
      let uniqueCurrencies: string[];
      let withoutPrices: string[] = [];

      const priceCheckStartDate = startDateMoment.clone().subtract(10, 'days').format(formatYMD);

      if (isIncrementalMode) {
        // Just extract the sets — no price fetch via allTrades
        uniqueSymbols = [...new Set(allTrades.map(t => t.symbol).filter(Boolean) as string[])];
        uniqueCurrencies = [...new Set(allTrades.map(t => t.currency).filter(Boolean) as string[])];
        if (portfolio.baseInstrument && !uniqueSymbols.includes(portfolio.baseInstrument)) {
          uniqueSymbols.push(portfolio.baseInstrument);
        }
        // Only fetch prices for the new date window
        try {
          await checkPrices(uniqueSymbols, priceCheckStartDate, undefined, undefined, false);
          for (const currency of uniqueCurrencies) {
            await checkPriceCurrency(currency, portfolio.currency, priceCheckStartDate, false);
          }
        } catch (priceError) {
          console.error("Error fetching recent price data:", priceError);
          return { days: [], withoutPrices: [], error: `Failed to fetch price data: ${priceError instanceof Error ? priceError.message : String(priceError)}` };
        }
      } else {
        // Full calculation: load prices from first trade date as usual
        const tradesInDateRange = allTrades.filter(trade =>
          moment.utc(trade.tradeTime).isBetween(startDateMoment, endDateMoment, 'day', '[]')
        );
        const priceResult = await checkPortfolioPricesCurrencies(
          tradesInDateRange.length > 0 ? tradesInDateRange : allTrades,
          portfolio.currency, undefined, forceRefresh
        );
        uniqueSymbols = priceResult.uniqueSymbols;
        uniqueCurrencies = priceResult.uniqueCurrencies;
        withoutPrices = priceResult.withoutPrices;

        if (portfolio.baseInstrument && !uniqueSymbols.includes(portfolio.baseInstrument)) {
          uniqueSymbols.push(portfolio.baseInstrument);
        }
        try {
          await checkPrices(uniqueSymbols, priceCheckStartDate, undefined, undefined, forceRefresh);
          for (const currency of uniqueCurrencies) {
            await checkPriceCurrency(currency, portfolio.currency, priceCheckStartDate, forceRefresh);
          }
          if (withoutPrices.length > 0) {
            await fillDateHistoryFromTrades(allTrades, withoutPrices, endDateString);
          }
        } catch (priceError) {
          console.error("Error fetching price data:", priceError);
          return { days: [], withoutPrices: [], error: `Failed to fetch price/rate data: ${priceError instanceof Error ? priceError.message : String(priceError)}` };
        }
      }

      // Initialize State Variables
      let cash = 0;
      let shares = 0;
      let currentHoldings: HoldingsMap = {};
      let days: DayType[] = [];
      let lastKnownNav = 0;
      let lastKnownInvested = 0;
      let lastKnownCash = 0;
      let lastKnownShares = 0;
      let perfomanceNominal = 0;
      let initialNavForPerf = 0;
      let baseIndexValue = 100000;
      // Tracks the last successfully priced value per symbol — used when price/rate is unavailable
      const lastKnownHoldingValues: Record<string, number> = {};

      // Process Initial State (Trades Before Start Date)
      // Use trade.rate (the stored FX rate at execution time) so we don't need to load
      // the full historical price series just to reconstruct the pre-period portfolio state.
      for (const trade of tradesBeforeStartDate) {
        const rate = trade.rate > 0
          ? trade.rate
          : getRate(trade.currency, portfolio.currency, trade.tradeTime);
        if (!rate) {
          console.warn(`Skipping pre-start trade (no rate): ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
          continue;
        }
        switch (trade.tradeType) {
          case TradeTypes.Trade:
            const { symbol } = trade;
            if (!currentHoldings[symbol]) {
              currentHoldings[symbol] = { volume: 0, currency: trade.currency };
            }
            const dir = trade.side === "B" ? 1 : -1;
            const cashChange = -dir * (trade.price * rate * trade.volume) - (trade.fee * rate);
            currentHoldings[symbol].volume += dir * trade.volume;
            cash += cashChange;
            break;
          case TradeTypes.Cash:
            if (trade.side === "P" || trade.side === TradeSide.PUT) {
              cash += trade.price * rate + (trade.fee || 0) * rate;
            } else if (trade.side === "W" || trade.side === TradeSide.WITHDRAW) {
              cash -= trade.price * rate + (trade.fee || 0) * rate;
            }
            break;
          case TradeTypes.Dividends:
            const dividendAmount = trade.price * rate + (trade.fee || 0) * rate;
            cash += dividendAmount;
            break;
          case TradeTypes.Investment:
            const investmentAmount = trade.price * rate + (trade.fee || 0) * rate;
            cash += investmentAmount;
            if (trade.shares) {
              shares += trade.shares;
            }
            break;
        }
      }

      // Clean up initial holdings
      Object.keys(currentHoldings).forEach(symbol => {
        if (currentHoldings[symbol].volume === 0) {
          delete currentHoldings[symbol];
        }
      });

      // Calculate initial market value and NAV
      const dayBeforeStartStr = startDateMoment.clone().subtract(1, 'day').format(formatYMD);
      let initialInv = 0;
      for (const symbol in currentHoldings) {
        const holding = currentHoldings[symbol];
        const price = getDateSymbolPrice(dayBeforeStartStr, symbol);
        const rate = getRate(holding.currency, portfolio.currency, dayBeforeStartStr);
        if (price != null && rate != null) {
          initialInv += price * rate * holding.volume;
        } else {
          console.warn(`Could not get initial price/rate for ${symbol} on ${dayBeforeStartStr}`);
        }
      }
      lastKnownNav = initialInv + cash;
      lastKnownInvested = initialInv;
      lastKnownCash = cash;
      lastKnownShares = shares > 0 ? shares : 1;
      baseIndexValue = getDateSymbolPrice(startDateString, portfolio.baseInstrument) || baseIndexValue;

      // Day-by-Day Iteration
      let loopMoment = startDateMoment.clone();
      const tradesByDate: Record<string, Trade[]> = {};

      allTrades.filter(trade => moment.utc(trade.tradeTime).isBetween(startDateMoment, endDateMoment, 'day', '[]'))
               .forEach(trade => {
                const dateKey = trade.tradeTime.split("T")[0];
                if (!tradesByDate[dateKey]) tradesByDate[dateKey] = [];
                tradesByDate[dateKey].push(trade);
               });

      while (loopMoment.isSameOrBefore(endDateMoment)) {
        const currentDayString = loopMoment.format(formatYMD);
        let dayInvestedValue = 0;
        let dayNav = 0;
        let dayTradesProcessed = false;

        cash = lastKnownCash;
        shares = lastKnownShares;

        try {
          // Process Trades for Current Day
          const todaysTrades = tradesByDate[currentDayString] || [];
          if (todaysTrades.length > 0) {
            dayTradesProcessed = true;
            for (const trade of todaysTrades) {
              const tradeRate = trade.rate;
              switch (trade.tradeType) {
                case TradeTypes.Trade:
                  const { symbol } = trade;
                  if (!currentHoldings[symbol]) {
                    currentHoldings[symbol] = { volume: 0, currency: trade.currency };
                  }
                  const dir = trade.side === "B" ? 1 : -1;
                  const cashChange = -dir * (trade.price * tradeRate * trade.volume) - (trade.fee * tradeRate);
                  const previousVolume = currentHoldings[symbol].volume;
                  currentHoldings[symbol].volume += dir * trade.volume;
                  cash += cashChange;
                  break;
                case TradeTypes.Cash:
                  if (trade.side === "P" || trade.side === TradeSide.PUT) {
                    cash += trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                  } else if (trade.side === "W" || trade.side === TradeSide.WITHDRAW) {
                    cash -= trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                  }
                  break;
                case TradeTypes.Dividends:
                  const dividendAmount = trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                  cash += dividendAmount;
                  break;
                case TradeTypes.Investment:
                  const investmentAmount = trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                  cash += investmentAmount;
                  if (trade.shares) {
                    shares += trade.shares;
                  }
                  break;
              }
            }
            // Clean up holdings
            Object.keys(currentHoldings).forEach(symbol => {
              if (currentHoldings[symbol]?.volume === 0) {
                delete currentHoldings[symbol];
                delete lastKnownHoldingValues[symbol];
              }
            });
          }

          // Calculate End-of-Day Market Value
          let currentDayInv = 0;
          for (const symbol in currentHoldings) {
            const holding = currentHoldings[symbol];
            const price = getDateSymbolPrice(currentDayString, symbol);
            const rate = getRate(holding.currency, portfolio.currency, currentDayString);

            if (price != null && rate != null) {
              const holdingValue = price * rate * holding.volume;
              currentDayInv += holdingValue;
              lastKnownHoldingValues[symbol] = holdingValue;
            } else if (lastKnownHoldingValues[symbol] != null) {
              console.warn(`Missing price/rate for ${symbol} on ${currentDayString}. Using last known value.`);
              currentDayInv += lastKnownHoldingValues[symbol];
            } else {
              console.error(`No price/rate found for ${symbol} on ${currentDayString} and no prior value available. Excluding from NAV.`);
            }
          }
          dayInvestedValue = currentDayInv;
          dayNav = dayInvestedValue + cash;

          // Calculate Daily Performance
          if (days.length === 0) {
            perfomanceNominal = dayNav;
            initialNavForPerf = dayNav;
          } else if (Object.keys(currentHoldings).length > 0) {
            try {
              const dailyPerfPercent = getPortfolioPerfomance(currentDayString, portfolio.currency, currentHoldings);
              perfomanceNominal = perfomanceNominal * (1 + dailyPerfPercent / 100);
            } catch (perfErr) {
              console.warn(`Could not calculate performance for ${currentDayString}:`, perfErr);
            }
          }

          lastKnownNav = dayNav;
          lastKnownInvested = dayInvestedValue;
          lastKnownCash = cash;
          lastKnownShares = shares > 0 ? shares : 1;

        } catch (err) {
          console.error(`Error processing day ${currentDayString}:`, err, ". Carrying forward previous day's state.");
          dayInvestedValue = lastKnownInvested;
          cash = lastKnownCash;
          shares = lastKnownShares;
          dayNav = lastKnownNav;
          // holdings remain as they were
        }

        // Store Daily Snapshot
        const finalShares = shares > 0 ? shares : 1;
        const navShare = finalShares > 0 ? dayNav / finalShares : 0;

        // For incremental updates, use the historical baseline navShare
        const baselineNavShare = days[0]?.navShare ?? (navShare || 1);

        const currentIndexValue = getDateSymbolPrice(currentDayString, portfolio.baseInstrument) || baseIndexValue;
        if (currentIndexValue !== baseIndexValue && days.length === 0) {
          baseIndexValue = currentIndexValue;
        }

        days.push({
          date: currentDayString,
          invested: toNumLocal(dayInvestedValue),
          investedWithoutTrades: toNumLocal(dayInvestedValue),
          cash: toNumLocal(cash),
          nav: toNumLocal(dayNav),
          index: toNumLocal(currentIndexValue),
          perfomance: toNumLocal(perfomanceNominal),
          shares: finalShares,
          navShare: toNumLocal(navShare),
          perfShare: toNumLocal(100 * navShare / (baselineNavShare !== 0 ? baselineNavShare : 1))
        });

        loopMoment.add(1, 'day');
      }

      return { days, withoutPrices };

    } catch (err) {
      console.error("Critical error in worker portfolio calculator:", err);
      return { days: [], withoutPrices: [], error: `Failed to calculate history: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// Worker message handler
if (parentPort) {
  console.log(`🧵 Portfolio Worker ${workerData?.workerId || 'unknown'} started`);

  parentPort.on('message', async (task: WorkerTask) => {
    let currentTask: WorkerTask | null = null;
    try {
      currentTask = task;

      if (task.type === 'portfolio_history') {
        console.log(`🧵 Worker processing portfolio history for ${task.data.portfolioId}`);

        // Connect to database if not already connected
        if (mongoose.connection.readyState === 0) {
          console.log(`🧵 Worker connecting to database...`);
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2');
          console.log(`🧵 Worker connected to database`);
        }

        // Wait for connection to be ready (readyState === 1)
        if (mongoose.connection.readyState !== 1) {
          console.log(`🧵 Worker waiting for database connection to be ready...`);
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Database connection timeout'));
            }, 30000); // 30 second timeout

            mongoose.connection.once('connected', () => {
              clearTimeout(timeout);
              resolve(undefined);
            });

            mongoose.connection.once('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
          console.log(`🧵 Worker database connection ready`);
        }

        const result = await WorkerPortfolioCalculator.calculatePortfolioHistory(
          task.data.portfolioId,
          task.data.from,
          task.data.till,
          task.data.precision,
          task.data.forceRefresh
        );

        const workerResult: WorkerResult = {
          taskId: task.id,
          success: !result.error,
          result: result.error ? undefined : result,
          error: result.error
        };

        parentPort?.postMessage(workerResult);
        console.log(`🧵 Worker completed task ${task.id}`);
      } else if (task.type === 'shutdown') {
        console.log(`🧵 Worker ${workerData?.workerId || 'unknown'} shutting down`);
        process.exit(0);
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error(`🧵 Worker error processing task ${currentTask?.id || 'unknown'}:`, error);

      const errorResult: WorkerResult = {
        taskId: currentTask?.id || 'unknown',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      parentPort?.postMessage(errorResult);
    }
  });

  // Signal ready to parent
  parentPort.postMessage({ type: 'ready', workerId: workerData?.workerId });
} else {
  console.error('❌ Portfolio worker must be run as a worker thread');
  process.exit(1);
}
