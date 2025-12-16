import moment from "moment";
import { Trade, TradeTypes, TradeSide } from "../../types/trade";
import { Portfolio } from "../../types/portfolio";
import { UserData } from "../../services/websocket";
import { getPortfolioTrades } from "../../utils/portfolio";
import {
  checkPortfolioPricesCurrencies,
  checkPrices,
  fillDateHistoryFromTrades,
  getDateSymbolPrice,
  getRate,
  checkPriceCurrency, // Ensure this is imported
  getDatePrices // Import needed for fallback price check
} from "../../services/app/priceCashe";
import { getPortfolioInstanceByIDorName } from "../../services/portfolio/helper";
import { isValidDateFormat, toNum } from "../../utils";
import { formatYMD, errorMsgs } from "../../constants";
import { PortfolioHistoryCache } from "./historyCache";
import { PortfolioHistoryService } from "./historyService";

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

// Helper type for daily holdings state
type HoldingsMap = Record<string, { volume: number; currency: string }>;

// Renamed function back to 'history'
export async function history(
  { _id, from, till, detail = "0", sample, precision = 2, forceRefresh = false, maxAge = 1440 }: HistoryParams,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<object> {
  try {
    // --- 1. Input Validation & Portfolio Fetching ---
    if (!_id) {
      return { error: "Portfolio _id is required" };
    }

    // --- 1.5. Check Cache First (unless force refresh) ---
    if (!forceRefresh) {
      try {
        const cacheResult = await PortfolioHistoryCache.getHistory(_id, from, till, maxAge);

        // If we have cached data, return it immediately
        if (cacheResult.cached && cacheResult.days.length > 0) {
          console.log(`Serving cached history for portfolio ${_id} (${cacheResult.days.length} days, ${cacheResult.cacheAge}min old)`);

          const withDetail = Number(detail) !== 0;
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
    const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision });
    const withDetail = Number(detail) !== 0;

    const {
      _id: realId,
      error: portfolioError,
      instance: portfolio,
    } = await getPortfolioInstanceByIDorName(_id, userData);

    if (forceRefresh) {
      console.log(`Force full recalculation requested for portfolio ${_id}`);
      // For force refresh, we clear ALL caches first, then do fresh calculation
      // The caches will NOT be updated after calculation completes
      try {
        // Clear portfolio history cache from MongoDB
        await PortfolioHistoryService.deleteHistory(realId);
        console.log(`Portfolio history cache cleared for portfolio ${realId} due to forceRefresh`);

        // Clear in-memory price caches to force fresh price fetching
        const { clearCaches } = require('../services/app/priceCashe');
        clearCaches();
      } catch (deleteError) {
        console.warn(`Failed to clear caches for portfolio ${realId}:`, deleteError);
        // Continue with calculation even if cache clearing fails
      }
    }

    if (portfolioError || !portfolio) {
      const errorMessage = typeof portfolioError === 'string' ? portfolioError : (portfolioError as {error: string})?.error || `Portfolio not found: ${_id}`;
      return { error: errorMessage };
    }

    // --- 2. Fetch ALL Relevant Trades ---
    // Fetch all trades up to the end date to establish initial state and daily changes
    const allTradesResult = await getPortfolioTrades(realId, undefined, {
      state: { $in: ["1"] },
      ...(till && isValidDateFormat(till) && { tradeTime: { $lte: `${till.split("T")[0]}T23:59:59` } }),
    });

    if ((allTradesResult as { error: string }).error) {
      return { error: (allTradesResult as { error: string }).error };
    }
    const allTrades = (allTradesResult as Trade[]).sort((a, b) => moment(a.tradeTime).diff(moment(b.tradeTime)));

    if (allTrades.length === 0 && !from) { // If no trades and no 'from' date, return empty
        return { days: [], ...(withDetail && { details: [] }) };
    }

    // --- 3. Determine Date Range ---
    let startDateMoment: moment.Moment;
    const firstTradeDate = allTrades.length > 0 ? allTrades[0].tradeTime.split("T")[0] : null;

    if (from) {
      if (!isValidDateFormat(from)) return { error: "Wrong 'from' date format" };
      startDateMoment = moment.utc(from.split("T")[0], formatYMD);
      // If 'from' is before the first trade, adjust start date to first trade date
      if (firstTradeDate && startDateMoment.isBefore(moment.utc(firstTradeDate, formatYMD))) {
          console.warn(`'from' date ${from} is before first trade date ${firstTradeDate}. Using first trade date as start.`);
          startDateMoment = moment.utc(firstTradeDate, formatYMD);
      }
    } else if (firstTradeDate) {
        // If 'from' not specified, start from the first trade date
        startDateMoment = moment.utc(firstTradeDate, formatYMD);
    } else {
        // No trades and no 'from' date - should have returned already, but as fallback:
        return { days: [], ...(withDetail && { details: [] }) };
    }

    let endDateMoment: moment.Moment;
    if (till) {
      if (!isValidDateFormat(till)) return { error: "Wrong 'till' date format" };
      endDateMoment = moment.utc(till.split("T")[0], formatYMD);
    } else {
      endDateMoment = moment.utc(); // Default to today
    }

    // Ensure start date is not after end date
    if (startDateMoment.isAfter(endDateMoment)) {
        return { error: "'from' date cannot be after 'till' date" };
    }

    const startDateString = startDateMoment.format(formatYMD);
    const endDateString = endDateMoment.format(formatYMD);

    // --- 4. Fetch Price Data ---
    // Determine symbols and currencies needed based *only* on trades within the actual date range
    const tradesInDateRange = allTrades.filter(trade => moment.utc(trade.tradeTime).isBetween(startDateMoment, endDateMoment, 'day', '[]'));
    const { uniqueSymbols, uniqueCurrencies, withoutPrices } =
      await checkPortfolioPricesCurrencies(tradesInDateRange.length > 0 ? tradesInDateRange : allTrades, portfolio.currency, undefined, forceRefresh); // Use all trades if range is empty

    if (portfolio.baseInstrument && !uniqueSymbols.includes(portfolio.baseInstrument)) {
        uniqueSymbols.push(portfolio.baseInstrument);
    }

    const priceCheckStartDate = startDateMoment.clone().subtract(10, 'days').format(formatYMD); // Look back for initial prices
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
        return { error: `Failed to fetch price/rate data: ${priceError instanceof Error ? priceError.message : String(priceError)}` };
    }

    // --- 5. Initialize State Variables ---
    let cash = 0;
    let shares = 0;
    let currentHoldings: HoldingsMap = {};
    let days: DayType[] = [];
    const tradeDetails: any[] = [];
    let lastKnownNav = 0;
    let lastKnownInvested = 0;
    let lastKnownCash = 0;
    let lastKnownShares = 0;
    let perfomanceAcc = 0; // Placeholder
    let baseIndexValue = 100000; // Default base index

    // --- 6. Process Initial State (Trades Before Start Date) ---
    const tradesBeforeStart = allTrades.filter(trade => moment.utc(trade.tradeTime).isBefore(startDateMoment, 'day'));
    for (const trade of tradesBeforeStart) {
        const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
        if (rate == null) {
             console.warn(`Skipping pre-start trade due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
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
                // Cash operations directly affect cash balance
                // For PUT operations (deposits), price is the amount deposited
                // For WITHDRAW operations, price is the amount withdrawn (negative)
                if (trade.side === "P" || trade.side === TradeSide.PUT) {
                    // Deposit - add to cash
                    cash += trade.price * rate + (trade.fee || 0) * rate;
                } else if (trade.side === "W" || trade.side === TradeSide.WITHDRAW) {
                    // Withdrawal - subtract from cash
                    cash -= trade.price * rate + (trade.fee || 0) * rate;
                }
                break;
            case TradeTypes.Dividends:
                // Dividends: price field contains total dividend amount received
                const dividendAmount = trade.price * rate + (trade.fee || 0) * rate;
                cash += dividendAmount;
                break;
            case TradeTypes.Investment:
                // Investment operations can affect cash and/or shares
                const investmentAmount = trade.price * rate + (trade.fee || 0) * rate;
                cash += investmentAmount; // Assuming positive investment adds cash
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

     // Calculate initial market value and NAV for the day *before* the loop starts
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


    // --- 7. Day-by-Day Iteration ---
    let loopMoment = startDateMoment.clone();
    const tradesByDate: Record<string, Trade[]> = {};
    // Group trades occurring *within* the date range
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

      // Start with state from end of previous day
      cash = lastKnownCash;
      shares = lastKnownShares;
      // currentHoldings is implicitly carried over (it's modified in place)

      try {
        // --- 7a. Process Trades for Current Day ---
        const todaysTrades = tradesByDate[currentDayString] || [];
        if (todaysTrades.length > 0) {
            dayTradesProcessed = true;
            for (const trade of todaysTrades) {
                const tradeRate = trade.rate; // Use recorded trade rate instead of fetching historic rate
                let currentTradeDetail: any = null; // For detail=1

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

                        if (withDetail) {
                            currentTradeDetail = {
                                symbol,
                                operation: trade.side === "B" ? "BUY" : "SELL",
                                tradeTime: trade.tradeTime,
                                currency: trade.currency,
                                rate: tradeRate,
                                volume: trade.volume,
                                price: trade.price,
                                fee: trade.fee,
                                cash: toNumLocal(cash),
                                newVolume: currentHoldings[symbol].volume,
                            };
                        }
                        break;
                    case TradeTypes.Cash:
                        // Cash operations directly affect cash balance
                        if (trade.side === "P" || trade.side === TradeSide.PUT) {
                            // Deposit - add to cash
                            cash += trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                        } else if (trade.side === "W" || trade.side === TradeSide.WITHDRAW) {
                            // Withdrawal - subtract from cash
                            cash -= trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                        }

                        if (withDetail) {
                            currentTradeDetail = {
                                operation: trade.side === "P" || trade.side === TradeSide.PUT ? "DEPOSIT" : "WITHDRAWAL",
                                tradeTime: trade.tradeTime,
                                currency: trade.currency,
                                amount: trade.price,
                                rate: tradeRate,
                                cash: toNumLocal(cash),
                            };
                        }
                        break;
                    case TradeTypes.Dividends:
                        // Dividends: price field typically contains total dividend amount received
                        // (not per-share rate, despite the description showing per-share calculation)
                        const dividendAmount = trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                        cash += dividendAmount;

                        if (withDetail) {
                            currentTradeDetail = {
                                operation: "DIVIDEND",
                                tradeTime: trade.tradeTime,
                                currency: trade.currency,
                                symbol: trade.symbol,
                                amount: trade.price,
                                rate: tradeRate,
                                cash: toNumLocal(cash),
                            };
                        }
                        break;
                    case TradeTypes.Investment:
                        // Investment operations can affect cash and/or shares
                        const investmentAmount = trade.price * tradeRate + (trade.fee || 0) * tradeRate;
                        cash += investmentAmount;
                        let sharesAdded = 0;
                        if (trade.shares) {
                            sharesAdded = trade.shares;
                        }
                        shares += sharesAdded;

                        if (withDetail) {
                            currentTradeDetail = {
                                operation: "INVESTMENT",
                                tradeTime: trade.tradeTime,
                                currency: trade.currency,
                                shares: sharesAdded,
                                amount: trade.price,
                                rate: tradeRate,
                                cash: toNumLocal(cash),
                            };
                        }
                        break;
                }
                 if (currentTradeDetail) {
                    tradeDetails.push(currentTradeDetail);
                 }
            }
            // Clean up holdings with zero volume *after* all trades for the day
            Object.keys(currentHoldings).forEach(symbol => {
                if (currentHoldings[symbol]?.volume === 0) {
                    delete currentHoldings[symbol];
                }
            });
        }

        // --- 7b. Calculate End-of-Day Market Value ('inv') ---
        let currentDayInv = 0;
        for (const symbol in currentHoldings) {
            const holding = currentHoldings[symbol];
            const price = getDateSymbolPrice(currentDayString, symbol);
            const rate = getRate(holding.currency, portfolio.currency, currentDayString);

            if (price != null && rate != null) {
                const holdingValue = price * rate * holding.volume;
                currentDayInv += holdingValue;
                 const symbolTradedToday = todaysTrades.some(t => t.symbol === symbol && t.tradeType === TradeTypes.Trade);
                 if (withDetail && !symbolTradedToday) {
                    tradeDetails.push({
                        currentDay: currentDayString,
                        symbol,
                        currency: holding.currency,
                        price,
                        rate,
                        volume: holding.volume,
                        investedSymbol: toNumLocal(holdingValue)
                    });
                 }
            } else {
                console.warn(`Could not get price/rate for ${symbol} on ${currentDayString}. Using last known value for NAV calculation.`);
                // Fallback: Use the last known invested value for this specific symbol if possible
                const prevDayStr = loopMoment.clone().subtract(1, 'day').format(formatYMD);
                const lastPrice = getDateSymbolPrice(prevDayStr, symbol);
                const lastRate = getRate(holding.currency, portfolio.currency, prevDayStr);
                 if (lastPrice != null && lastRate != null) {
                    currentDayInv += lastPrice * lastRate * holding.volume;
                 } else {
                     console.error(`CRITICAL: Could not find any price/rate for ${symbol} on or before ${currentDayString}. Excluding from value.`);
                 }
            }
        }
        dayInvestedValue = currentDayInv;
        dayNav = dayInvestedValue + cash;

        // Update last known good values for potential error recovery on the *next* day
        lastKnownNav = dayNav;
        lastKnownInvested = dayInvestedValue;
        lastKnownCash = cash;
        lastKnownShares = shares > 0 ? shares : 1;

      } catch (err) {
          console.error(`Error processing day ${currentDayString}:`, err, ". Carrying forward previous day's state.");
          // On error, use last known good values from the *previous* day
          dayInvestedValue = lastKnownInvested;
          cash = lastKnownCash;
          shares = lastKnownShares;
          dayNav = lastKnownNav;
          // Holdings remain as they were at the start of the try block
      }

      // --- 7c. Store Daily Snapshot ---
      const finalShares = shares > 0 ? shares : 1;
      const navShare = finalShares > 0 ? dayNav / finalShares : 0;
      const firstNavShare = days[0]?.navShare ?? (navShare || 1);

      const currentIndexValue = getDateSymbolPrice(currentDayString, portfolio.baseInstrument) || baseIndexValue;
      if (currentIndexValue !== baseIndexValue && days.length === 0) {
          baseIndexValue = currentIndexValue;
      }

      days.push({
        date: currentDayString,
        invested: toNumLocal(dayInvestedValue),
        investedWithoutTrades: toNumLocal(dayInvestedValue), // Using same value
        cash: toNumLocal(cash),
        nav: toNumLocal(dayNav),
        index: toNumLocal(currentIndexValue),
        perfomance: 0, // Placeholder
        shares: finalShares,
        navShare: toNumLocal(navShare),
        perfShare: toNumLocal(100 * navShare / (firstNavShare !== 0 ? firstNavShare : 1))
      });

      // Move to the next day
      loopMoment.add(1, 'day');
    }

    // --- 8. Store Results in Cache (only if not force refresh) ---
    if (!forceRefresh) {
      try {
        // Convert DayType[] to PortfolioHistoryDay[] for storage
        const historyDays = days.map(day => ({
          portfolioId: realId,
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
          console.error(`Failed to save calculated history for portfolio ${realId}:`, err);
        });

        console.log(`Calculated and cached ${historyDays.length} days of history for portfolio ${realId}`);
      } catch (cacheError) {
        console.error(`Error preparing history data for cache for portfolio ${realId}:`, cacheError);
        // Continue with response even if caching fails
      }
    } else {
      console.log(`Force refresh completed for portfolio ${realId} - cache was cleared and not updated`);
    }

    // --- 9. Resampling and Final Output ---
    // TODO: Implement resampling logic if required based on 'sample' parameter

    return {
        ...(withoutPrices.length > 0 && { info: `Used trades for interpolating prices/rates: ${withoutPrices.join(',')}` }),
        days,
        ...(withDetail && { details: tradeDetails })
    };

  } catch (err) {
    console.error("Critical error in history function:", err); // Changed historyV2 to history
    return { error: `Failed to generate history: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Note: Performance calculation logic (like getPortfolioPerfomance) was complex and potentially
// contributing to errors. It has been removed for this refactor but can be added back carefully if needed.
// Resampling logic also needs to be re-implemented if the 'sample' parameter is used.
