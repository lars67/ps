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

export class PortfolioCalculator {

  /**
   * Calculate portfolio history for a date range
   * This is the core calculation logic extracted from history.ts
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
        endDateMoment = moment.utc();
      }

      if (startDateMoment.isAfter(endDateMoment)) {
        return { days: [], withoutPrices: [], error: "'from' date cannot be after 'till' date" };
      }

      const startDateString = startDateMoment.format(formatYMD);
      const endDateString = endDateMoment.format(formatYMD);

      // Fetch Price Data
      const tradesInDateRange = allTrades.filter(trade => moment.utc(trade.tradeTime).isBetween(startDateMoment, endDateMoment, 'day', '[]'));
      const { uniqueSymbols, uniqueCurrencies, withoutPrices } =
        await checkPortfolioPricesCurrencies(tradesInDateRange.length > 0 ? tradesInDateRange : allTrades, portfolio.currency, undefined, forceRefresh);

      if (portfolio.baseInstrument && !uniqueSymbols.includes(portfolio.baseInstrument)) {
        uniqueSymbols.push(portfolio.baseInstrument);
      }

      const priceCheckStartDate = startDateMoment.clone().subtract(10, 'days').format(formatYMD);
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

      // Process Initial State (Trades Before Start Date)
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
            } else {
              console.warn(`Could not get price/rate for ${symbol} on ${currentDayString}. Using last known value for NAV calculation.`);
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
        const firstNavShare = days[0]?.navShare ?? (navShare || 1);

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
          perfShare: toNumLocal(100 * navShare / (firstNavShare !== 0 ? firstNavShare : 1))
        });

        loopMoment.add(1, 'day');
      }

      return { days, withoutPrices };

    } catch (err) {
      console.error("Critical error in portfolio calculator:", err);
      return { days: [], withoutPrices: [], error: `Failed to calculate history: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
