import { UserData } from "@/services/websocket";
import { ErrorType } from "@/types/other";
import { getPortfolioInstanceByIDorName } from "./helper";
import moment from "moment"; // For date handling
import { Trade, TradeTypes } from "../../types/trade"; // For trade types
import { Portfolio } from "../../types/portfolio"; // For portfolio type
import { getPortfolioTrades } from "../../utils/portfolio"; // To fetch trades
import {
  checkPortfolioPricesCurrencies,
  checkPrices,
  fillDateHistoryFromTrades,
  getDateSymbolPrice,
  getRate,
  checkPriceCurrency,
  getDatePrices // Assuming this is needed - was in history.ts
} from "../../services/app/priceCashe"; // For price and FX data
import { isValidDateFormat, toNum } from "../../utils"; // For validation and number formatting
import { formatYMD, errorMsgs } from "../../constants"; // For constants like date format and error messages
import { stringify } from 'csv-stringify';
import fs from 'fs/promises';

// Define DayType - similar to history.ts
export type ReportRowType = {
  Date: string;
  Type: string;
  Symbol: string;
  Volume: number;
  "Original price"?: number; // Made optional as it might not apply to all types
  MarketPrice?: number;
  "Original FX"?: number;
  MarketFX?: number;
  Fee?: number;
  Invested?: number;
  InvestedBase?: number;
  MarketValue?: number;
  BaseMarketValue?: number;
  Realized?: number;
  Result?: number;
  resultBase?: number;
  "Unrealized Result"?: number;
  Cash: number;
  CashBase: number;
  "Acc. Result"?: number;
  AccMarketVvalue?: number;
  AccMarketValueBase?: number;
  AccCash?: number;
  AccCashBase?: number;
  NAV: number;
  NavBase: number;
};

// Helper type for daily holdings state
type HoldingsMap = Record<string, { volume: number; currency: string; investedValue: number }>; // Added investedValue to track cost basis

export async function debug(
  params: { args: { portfolioId: string; fee?: number; granularity?: "day" | "trade"; from?: string; till?: string; exportToCsv?: boolean; fileName?: string } },
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<ReportRowType[] | { filePath: string } | ErrorType> {
  try {
    const { portfolioId, fee, granularity, from, till, exportToCsv, fileName = `portfolio_debug_report_${moment().format('YYYYMMDD_HHmmss')}.csv` } = params.args;
    if (!portfolioId) {
      return { error: "Portfolio ID is required" };
    }

    const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 2 }); // Helper for consistent formatting
    const toNumFullPrecision = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 8 }); // Helper for internal calculations to maintain precision

    const { _id: realId, instance: portfolioInstance, error: portfolioInstanceError } = await getPortfolioInstanceByIDorName(portfolioId, userData);
    if (portfolioInstanceError || !portfolioInstance) {
      return { error: `Portfolio not found (or access denied): ${portfolioId}` }; // More specific error
    }

    console.log(`[portfolios.debug] Generating debug report for portfolio: ${portfolioId}, fee: ${fee}, granularity: ${granularity || 'default'}`);

    // --- 1. Fetch ALL Relevant Trades ---
    // Fetch all trades up to the end date to establish initial state and daily changes
    const allTradesResult = await getPortfolioTrades(realId, undefined, {
      // state: { $in: ["1"] }, // Temporarily removed to fetch all trades for debugging
      ...(till && isValidDateFormat(till) && { tradeTime: { $lte: `${till.split("T")[0]}T23:59:59` } }),
    });

    if ((allTradesResult as { error: string }).error) {
      return { error: (allTradesResult as { error: string }).error };
    }
    const allTrades = (allTradesResult as Trade[]).sort((a, b) => moment.utc(a.tradeTime).diff(moment.utc(b.tradeTime)));
    console.log(`[portfolios.debug] Fetched trades:`, allTrades.map(t => ({ symbol: t.symbol, tradeType: t.tradeType, volume: t.volume, price: t.price, fee: t.fee, tradeTime: t.tradeTime })));

    if (allTrades.length === 0 && !from) {
      return []; // If no trades and no 'from' date, return empty array now as per ReportRowType[]
    }

    // --- 2. Determine Date Range ---
    let startDateMoment: moment.Moment;
    const firstTradeDate = allTrades.length > 0 ? allTrades[0].tradeTime.split("T")[0] : null;

    if (from) {
      if (!isValidDateFormat(from)) return { error: "Wrong 'from' date format" };
      startDateMoment = moment.utc(from.split("T")[0], formatYMD);
      // Adjust start date if 'from' is before the first trade
      if (firstTradeDate && startDateMoment.isBefore(moment.utc(firstTradeDate, formatYMD))) {
          console.warn(`'from' date ${from} is before first trade date ${firstTradeDate}. Using first trade date as start.`);
          startDateMoment = moment.utc(firstTradeDate, formatYMD);
      }
    } else if (firstTradeDate) {
        // If 'from' not specified, start from the first trade date
        startDateMoment = moment.utc(firstTradeDate, formatYMD);
    } else {
        // No trades and no 'from' date - should have returned already, but as fallback:
        return { error: "No start date or trades found to generate report."}; // Removed msgId
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

    // --- 3. Fetch Price Data ---
    // Determine symbols and currencies needed based on *all* trades up to endDate to ensure all historical data is covered
    const { uniqueSymbols, uniqueCurrencies, withoutPrices } =
      await checkPortfolioPricesCurrencies(allTrades, portfolioInstance.currency); 
    if (portfolioInstance.baseInstrument && !uniqueSymbols.includes(portfolioInstance.baseInstrument)) {
        uniqueSymbols.push(portfolioInstance.baseInstrument); // Ensure base instrument prices are fetched
    }
    // Fetch prices for a broader range to cover all trade and holding dates
    const priceCheckStartDate = startDateMoment.clone().subtract(30, 'days').format(formatYMD); // Look back for initial prices/FX
    try {
        await checkPrices(uniqueSymbols, priceCheckStartDate);
        for (const currency of uniqueCurrencies) {
            await checkPriceCurrency(currency, portfolioInstance.currency, priceCheckStartDate); // Ensure cross-currency rates
        }
        if (withoutPrices.length > 0) {
            // Fill in any missing prices using historical trade data, useful for older trades
            await fillDateHistoryFromTrades(allTrades.filter(t => moment.utc(t.tradeTime).isSameOrAfter(moment.utc(priceCheckStartDate))), withoutPrices, endDateString);
        }
    } catch (priceError) {
        console.error("Error fetching price data:", priceError);
        return { error: `Failed to fetch essential price/rate data: ${priceError instanceof Error ? priceError.message : String(priceError)}` };
    }


    // --- 4. Initialize State Variables ---
    let currentCash = 0;
    let currentShares = 0; // For fund-type portfolios for NAV per share
    let currentHoldings: HoldingsMap = {}; // Tracks symbol -> {volume, currency, current total invested value (cost basis)}
    const reportRows: ReportRowType[] = []; // Array to store the final report data

    // Accumulated metrics - defined here to be accessible throughout the day loop
    let accResult = 0;
    let accMarketValue = 0;
    let accMarketValueBase = 0;
    let accCash = 0;
    let accCashBase = 0;

    // --- 5. Process Initial State (Trades Before Start Date) ---
    // This loop establishes the portfolio state (holdings, cash) at the beginning of the 'from' date.
    const tradesBeforeStart = allTrades.filter(trade => moment.utc(trade.tradeTime).isBefore(startDateMoment, 'day'));
    for (const trade of tradesBeforeStart) {
        const rate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
        if (rate == null) {
             console.warn(`Skipping pre-start trade due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
             continue;
        }

        const tradePrice = trade.symbol ? (getDateSymbolPrice(trade.tradeTime, trade.symbol) ?? trade.price) : trade.price; // Use market price if available, else trade price
        const tradeValue = tradePrice * trade.volume;
        const tradeValueBase = tradeValue * rate;
        
        switch (trade.tradeType) {
            case TradeTypes.Trade: {
                const dir = trade.side === "B" ? 1 : -1; // 1 for Buy, -1 for Sell
                // Use trade.fee instead of the input 'fee' parameter for cash change calculations
                const cashChange = -dir * tradeValueBase - (trade.fee * rate); // Impact on cash in base currency
                currentCash += cashChange;
                console.log(`[portfolios.debug] Pre-start Trade: ${trade.tradeTime} ${trade.symbol} ${trade.side} Vol:${trade.volume} Price:${trade.price} Fee:${trade.fee}. cashChange=${cashChange}. currentCash now=${currentCash}`);

                const { symbol } = trade;
                if (!currentHoldings[symbol]) {
                    currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0 };
                }
                
                // Track volume and cost basis for holdings
                // For sells, adjust investedValue proportionally or based on average cost
                if (dir === 1) { // Buy
                    currentHoldings[symbol].volume += trade.volume;
                    currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + tradeValueBase + (trade.fee * rate));
                    console.log(`[portfolios.debug] Buy Holding: ${trade.symbol} Vol:${currentHoldings[symbol].volume} Invested:${currentHoldings[symbol].investedValue}`);
                } else { // Sell
                  // Simple average cost reduction for sells:
                  if (currentHoldings[symbol].volume > 0) {
                     const avgCostPerShare = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                     currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShare * trade.volume);
                     currentHoldings[symbol].volume -= trade.volume;
                  } else if (currentHoldings[symbol].volume <= 0) {
                      // Selling when no volume held. For long-only tracking, this means no cost basis for PL.
                      // Volume can go negative to represent a short, but investedValue should not increase.
                      currentHoldings[symbol].volume -= trade.volume;
                      // No change to investedValue as there was no long position to realize profit/loss against.
                  }
                }
                break;
            }
            case TradeTypes.Cash:
            case TradeTypes.Dividends:
            case TradeTypes.Investment: {
                // For dividends, adjust tradeValueBase by multiplying trade.price with volume from holdings
                const amountForCashMove = (trade.tradeType === TradeTypes.Cash)
                ? trade.price // For cash deposits, trade.price is the amount, volume is 0
                : (trade.tradeType === TradeTypes.Dividends && trade.symbol && currentHoldings[trade.symbol]?.volume)
                  ? trade.price * currentHoldings[trade.symbol].volume
                  : trade.price * trade.volume; // Default for other types

                const cashMove = (amountForCashMove * rate) + (trade.fee * rate);
                currentCash += cashMove;
                console.log(`[portfolios.debug] Pre-start Cash/Div/Inv: ${trade.tradeTime} ${trade.tradeType} ${trade.price} Fee:${trade.fee}. cashMove=${cashMove}. currentCash now=${currentCash}`);
                if (trade.shares && trade.tradeType === TradeTypes.Investment) { // Only add shares for actual investment types
                    currentShares += trade.shares;
                }
                break;
            }
        }
    }

    // Clean up initial holdings with zero volume
    Object.keys(currentHoldings).forEach(symbol => {
        if (currentHoldings[symbol].volume === 0) {
            delete currentHoldings[symbol];
        }
    });

    // Update accumulated cash after initial trades
    accCash = currentCash;
    accCashBase = currentCash; // Assuming portfolio base currency for now, need actual conversion if different
    console.log(`[portfolios.debug] Initial state after pre-start trades: currentCash=${currentCash}, currentHoldings=${JSON.stringify(currentHoldings)}`);


    // --- 6. Day-by-Day or Trade-by-Trade Iteration ---
    if (granularity === "day") {
      let loopMoment = startDateMoment.clone();
      const tradesByDate: Record<string, Trade[]> = {};
      allTrades.forEach(trade => {
        const dateKey = moment.utc(trade.tradeTime).format(formatYMD);
        if (!tradesByDate[dateKey]) tradesByDate[dateKey] = [];
        tradesByDate[dateKey].push(trade);
      });

      // Loop through each day from start to end date
      while (loopMoment.isSameOrBefore(endDateMoment)) {
        const currentDayString = loopMoment.format(formatYMD);
        
        // Skip weekend days
        const dayOfWeek = loopMoment.isoWeekday(); // Monday is 1, Sunday is 7
        if (dayOfWeek === 6 || dayOfWeek === 7) { // Saturday or Sunday
            loopMoment.add(1, 'day');
            continue;
        }

        const todaysTrades = tradesByDate[currentDayString] || [];

        // --- Process trades and update holdings for the current day ---
        // This loop applies the financial impact of today's trades to cash and holdings
        for (const trade of todaysTrades) {
            const tradeRate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (tradeRate == null) {
                console.warn(`Skipping trade due as rate is null or undefined for: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }

            // For financial impact, always use the trade's actual price and rate
            const tradeValue = trade.price * trade.volume;
            const tradeValueBase = tradeValue * trade.rate; // Use the trade's recorded rate
            let realizedPL = 0; // Realized Profit/Loss for this trade affecting accResult
            
            // Apply financial impact of today's trades to cash and holdings
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * tradeValueBase - (trade.fee * tradeRate);
                    currentCash += cashChange;

                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0 };
                    }
                    
                    if (dir === 1) { // Buy
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue += tradeValueBase + (trade.fee * tradeRate);
                    } else { // Sell
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShare = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                            realizedPL = toNumFullPrecision((trade.price * trade.volume * trade.rate) - (avgCostPerShare * trade.volume) - trade.fee * tradeRate); // Subtract fee
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShare * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else { // currentHoldings[symbol].volume <= 0
                            // If volume is 0 or negative before a sell, realized PL against existing cost basis is 0.
                            // This might indicate short selling or data issues not handled by cost basis tracking.
                            realizedPL = toNumFullPrecision(-trade.fee * tradeRate); // Only fee impacts if no position
                            currentHoldings[symbol].volume -= trade.volume; // Volume can go negative
                            // investedValue should not change as there's no long position to reduce.
                        }
                    }
                    accResult += realizedPL;
                    break;
                }
                case TradeTypes.Cash:
                case TradeTypes.Dividends:
                case TradeTypes.Investment: {
                    const amountForCashMove = (trade.tradeType === TradeTypes.Cash)
                    ? trade.price
                    : (trade.tradeType === TradeTypes.Dividends && trade.symbol && currentHoldings[trade.symbol]?.volume)
                      ? trade.price * currentHoldings[trade.symbol].volume
                      : trade.price * trade.volume;
                    const cashMove = (amountForCashMove * tradeRate) + (trade.fee * tradeRate);
                    currentCash += cashMove;
                    if (trade.shares && trade.tradeType === TradeTypes.Investment) {
                        currentShares += trade.shares;
                    }
                    break;
                }
            }
        }
        // Clean up holdings with zero volume after all trades for the day
        Object.keys(currentHoldings).forEach(symbol => {
            if (currentHoldings[symbol].volume === 0) {
                delete currentHoldings[symbol];
            }
        });

        // Calculate end-of-day portfolio value and metrics BEFORE pushing report rows
        let totalMarketValue = 0;
        let totalMarketValueBase = 0;
        let totalInvested = 0;
        let totalInvestedBase = 0;
        let unrealizedPL = 0;

        for (const symbol in currentHoldings) { // Calculate market values and invested totals from current holdings
          const holding = currentHoldings[symbol];
          const price = getDateSymbolPrice(currentDayString, symbol);
          const rate = getRate(holding.currency, portfolioInstance.currency, currentDayString);

          if (price != null && rate != null) {
              const holdingValue = price * holding.volume;
              const holdingValueBase = holdingValue * rate;

              totalMarketValue += holdingValue;
              totalMarketValueBase += holdingValueBase;
              totalInvested = toNumFullPrecision(totalInvested + holding.investedValue / rate);
              totalInvestedBase = toNumFullPrecision(totalInvestedBase + holding.investedValue);
 
               unrealizedPL = toNumFullPrecision(unrealizedPL + (holdingValueBase - holding.investedValue));

          } else {
              console.warn(`Could not get price/rate for ${symbol} on ${currentDayString}. Using default or last known. Will affect calculation.`);
          }
        }

        // All NAV-related calculations must happen after currentCash, totalMarketValueBase, and totalMarketValue are finalized for the day.
        // This ensures the accumulated totals are correct for the current day's report.
        const currentNAV = totalMarketValueBase + currentCash;
        const currentNavBase = currentNAV;
 
        // Update accumulated values for the report.
        // These are effectively the "end-of-day" values for the current processing day.
        accMarketValue = totalMarketValue;
        accMarketValueBase = totalMarketValueBase;
        accCash = currentCash;
        accCashBase = currentCash;
        
        // --- Report Rows Generation for the current day ---

        // 1. Add individual Trade Rows (Buy/Sell) for the current day
        for (const trade of todaysTrades) {
            if (trade.tradeType === TradeTypes.Trade) {
                const tradeRate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
                if (tradeRate == null) {
                    console.warn(`Skipping trade for reporting due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                    continue;
                }

                const priceOnTradeDay = trade.symbol ? (getDateSymbolPrice(trade.tradeTime, trade.symbol) ?? trade.price) : trade.price;
                const tradeValue = priceOnTradeDay * trade.volume;
                const tradeValueBase = tradeValue * tradeRate;
                const dir = trade.side === "B" ? 1 : -1;
                let realizedPLForReport = 0; // Only for sell trades

                // Calculate realized P/L for reporting purposes for sell trades
                // Note: currentHoldings reflects state *after* trade processing,
                // so this realizedPL is based on effective cost basis just before this trade.
                // For more precise intra-day realized PL, you'd need a different state management.
                // Calculate realized P/L for reporting purposes for sell trades
                // This must use the actual trade price.
                if (trade.side === "S" && currentHoldings[trade.symbol] && currentHoldings[trade.symbol].volume > 0) {
                    const avgCostPerShare = toNumFullPrecision(currentHoldings[trade.symbol].investedValue / currentHoldings[trade.symbol].volume);
                    // Realized P/L = (Trade Proceeds - Cost Basis of Shares Sold) - Transaction Fee
                    realizedPLForReport = toNumFullPrecision((trade.price * trade.volume * trade.rate) - (avgCostPerShare * trade.volume) - trade.fee * tradeRate);
                } else if (trade.side === "S" && currentHoldings[trade.symbol]?.volume <= 0) {
                   // If attempting to sell from a zero/negative position, only the fee is realized loss.
                   realizedPLForReport = toNumFullPrecision(-trade.fee * tradeRate);
                }

                reportRows.push({
                    Date: currentDayString,
                    Type: `Trade (${trade.side === "B" ? "Buy" : "Sell"})`,
                    Symbol: trade.symbol || "",
                    Volume: toNumLocal(trade.side === "S" ? -trade.volume : trade.volume), // Negative volume for sells
                    "Original price": toNumLocal(trade.price), // Original trade price, not market close
                    MarketPrice: toNumLocal(priceOnTradeDay), // Market price on trade day
                    "Original FX": toNumLocal(trade.rate), // Original trade FX, not market close
                    MarketFX: toNumLocal(tradeRate), // Market FX on trade day
                    Fee: toNumLocal(trade.fee),
                    Invested: toNumLocal(trade.side === "B" ? tradeValue / tradeRate : 0), // Invested for buys (original currency)
                    InvestedBase: toNumLocal(trade.side === "B" ? tradeValueBase : 0), // Invested for buys in base currency
                    MarketValue: toNumLocal(0), // Not applicable for a trade row value
                    BaseMarketValue: toNumLocal(0),
                    Realized: toNumLocal(realizedPLForReport), // Realized P/L for this specific trade
                    Result: toNumLocal(realizedPLForReport),
                    resultBase: toNumLocal(realizedPLForReport),
                    "Unrealized Result": toNumLocal(0), // Not applicable for a trade row
                    Cash: toNumLocal(-dir * tradeValueBase - (trade.fee * tradeRate)), // Cash impact of this trade (net of fees)
                    CashBase: toNumLocal(-dir * tradeValueBase - (trade.fee * tradeRate)),
                    // Accumulated values reflect end-of-day values *after* all trades for the day are processed
                    "Acc. Result": toNumLocal(accResult),
                    AccMarketVvalue: toNumLocal(accMarketValue),
                    AccMarketValueBase: toNumLocal(accMarketValueBase),
                    AccCash: toNumLocal(accCash),
                    AccCashBase: toNumLocal(accCashBase),
                    NAV: toNumLocal(currentNAV),
                    NavBase: toNumLocal(currentNavBase),
                });
            }
        }

        // 2. Add individual Cash, Dividends, Investment transactions for the current day
        for (const trade of todaysTrades) {
            let type: string | null = null;
            let amountInBase = 0;
            switch(trade.tradeType) {
                case TradeTypes.Cash:
                    type = "Cash Deposit/Withdrawal";
                    const fxRateForCash = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
                     if (fxRateForCash == null) {
                         console.warn(`Skipping Cash trade for reporting due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                         continue;
                      }
                    amountInBase = trade.price * fxRateForCash + trade.fee * fxRateForCash;
                    break;
                case TradeTypes.Dividends:
                    type = "Dividend";
                    const fxRateForDiv = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
                    if (fxRateForDiv == null) {
                        console.warn(`Skipping Dividend trade for reporting due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                        continue;
                    }
                    const dividendAmount = (trade.symbol && currentHoldings[trade.symbol]?.volume)
                        ? trade.price * currentHoldings[trade.symbol].volume
                        : trade.price * trade.volume;
                    amountInBase = dividendAmount * fxRateForDiv + trade.fee * fxRateForDiv;
                    break;
                case TradeTypes.Investment:
                    type = "Investment";
                    const fxRateForInv = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
                    if (fxRateForInv == null) {
                        console.warn(`Skipping Investment trade for reporting due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                        continue;
                    }
                    const investmentAmount = trade.price * trade.volume;
                    amountInBase = investmentAmount * fxRateForInv + trade.fee * fxRateForInv;
                    break;
            }

            if (type && amountInBase !== 0) { // Only push if it's one of the types we want to display
                reportRows.push({
                    Date: currentDayString,
                    Type: type,
                    Symbol: trade.symbol || "", // Can be empty for pure cash transactions
                    Volume: toNumLocal(trade.volume),
                    "Original price": toNumLocal(trade.price),
                    MarketPrice: toNumLocal(trade.price), // For cash/div/investment, market price is trade price
                    "Original FX": toNumLocal(trade.rate),
                    MarketFX: toNumLocal(getRate(trade.currency, portfolioInstance.currency, trade.tradeTime)),
                    Fee: toNumLocal(trade.fee),
                    Invested: toNumLocal(0),
                    InvestedBase: toNumLocal(0),
                    MarketValue: toNumLocal(0),
                    BaseMarketValue: toNumLocal(0),
                    Realized: toNumLocal(0),
                    Result: toNumLocal(0),
                    resultBase: toNumLocal(0),
                    "Unrealized Result": toNumLocal(0),
                    Cash: toNumLocal(amountInBase), // Display the effective cash change in base currency
                    CashBase: toNumLocal(amountInBase),
                    // Accumulated values reflect end-of-day values *after* all trades for the day are processed
                    "Acc. Result": toNumLocal(accResult),
                    AccMarketVvalue: toNumLocal(accMarketValue),
                    AccMarketValueBase: toNumLocal(accMarketValueBase),
                    AccCash: toNumLocal(accCash),
                    AccCashBase: toNumLocal(accCashBase),
                    NAV: toNumLocal(currentNAV),
                    NavBase: toNumLocal(currentNavBase),
                });
            }
        }
        
        // 3. Add individual position rows for the current day
        for (const symbol in currentHoldings) {
            const holding = currentHoldings[symbol];
            const price = getDateSymbolPrice(currentDayString, symbol);
            const rate = getRate(holding.currency, portfolioInstance.currency, currentDayString);

            if (price != null && rate != null) {
                const holdingValue = price * holding.volume;
                const holdingValueBase = holdingValue * rate;
                const individualUnrealizedPL = holdingValueBase - holding.investedValue;

                reportRows.push({
                    Date: currentDayString,
                    Type: "Position Snapshot",
                    Symbol: symbol,
                    Volume: toNumLocal(holding.volume),
                    // Ensure volume is not zero before division
                    "Original price": toNumLocal(holding.volume > 0 ? toNumFullPrecision(holding.investedValue / holding.volume) : 0),
                    MarketPrice: toNumLocal(price),
                    "Original FX": toNumLocal(1), // Assuming 1 for simplicity, needs proper handling for original trade FX
                    MarketFX: toNumLocal(rate),
                    Fee: toNumLocal(0),
                    Invested: toNumLocal(holding.investedValue / rate),
                    InvestedBase: toNumLocal(holding.investedValue),
                    MarketValue: toNumLocal(holdingValue),
                    BaseMarketValue: toNumLocal(holdingValueBase),
                    Realized: toNumLocal(0),
                    Result: toNumLocal(individualUnrealizedPL),
                    resultBase: toNumLocal(individualUnrealizedPL),
                    "Unrealized Result": toNumLocal(individualUnrealizedPL),
                    Cash: toNumLocal(0),
                    CashBase: toNumLocal(0),
                    // Accumulated values reflect end-of-day values *after* all trades for the day are processed
                    "Acc. Result": toNumLocal(accResult),
                    AccMarketVvalue: toNumLocal(accMarketValue),
                    AccMarketValueBase: toNumLocal(accMarketValueBase),
                    AccCash: toNumLocal(accCash),
                    AccCashBase: toNumLocal(accCashBase),
                    NAV: toNumLocal(currentNAV),
                    NavBase: toNumLocal(currentNavBase),
                });
            }
        }

        // 4. Add aggregated portfolio summary row for the current day
        reportRows.push({
            Date: currentDayString,
            Type: "Portfolio Summary",
            Symbol: "Aggregated",
            Volume: toNumLocal(Object.values(currentHoldings).reduce((sum, h) => toNumFullPrecision(sum + h.volume), 0)),
            // Ensure divisor is not zero for Original price and MarketPrice
            "Original price": toNumLocal(totalInvested / (Object.values(currentHoldings).reduce((sum, h) => toNumFullPrecision(sum + h.volume), 0) || 1)),
            MarketPrice: toNumLocal(totalMarketValue / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)),
            "Original FX": toNumLocal(1),
            MarketFX: toNumLocal(1), // Placeholder, actual market FX for portfolio would be complex average
            Fee: toNumLocal(0),
            Invested: toNumLocal(totalInvested),
            InvestedBase: toNumLocal(totalInvestedBase),
            MarketValue: toNumLocal(totalMarketValue),
            BaseMarketValue: toNumLocal(totalMarketValueBase),
            Realized: toNumLocal(accResult),
            Result: toNumLocal(accResult + unrealizedPL),
            resultBase: toNumLocal(accResult + unrealizedPL),
            "Unrealized Result": toNumLocal(unrealizedPL),
            Cash: toNumLocal(currentCash),
            CashBase: toNumLocal(currentCash),
            "Acc. Result": toNumLocal(accResult + unrealizedPL),
            AccMarketVvalue: toNumLocal(accMarketValue),
            AccMarketValueBase: toNumLocal(accMarketValueBase),
            AccCash: toNumLocal(accCash),
            AccCashBase: toNumLocal(accCashBase),
            NAV: toNumLocal(currentNAV),
            NavBase: toNumLocal(currentNavBase),
        });

        loopMoment.add(1, 'day'); // Move to the next day
       }
    } else if (granularity === "trade") { // Original trade-by-trade functionality (less detailed reporting)
       for (const trade of allTrades) {
            const tradeRate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (tradeRate == null) {
                console.warn(`Skipping trade due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }

            const tradeValue = trade.price * trade.volume;
            const tradeValueBase = tradeValue * tradeRate;
            let realizedPL = 0;
            let type = "Trade"; // Default for most trades

            // Simulate the impact of this single trade on holdings and cash
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    type = "Trade";
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * tradeValueBase - ((fee || 0) * tradeRate);
                    currentCash += cashChange;

                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0 };
                    }
                    
                    if (dir === 1) { // Buy
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue += tradeValueBase;
                    } else { // Sell
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShare = currentHoldings[symbol].investedValue / currentHoldings[symbol].volume;
                            realizedPL = (tradeValueBase - (avgCostPerShare * trade.volume));
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShare * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else { // currentHoldings[symbol].volume <= 0
                            realizedPL = toNumFullPrecision(-trade.fee * tradeRate); // Only fee impacts if no position
                            currentHoldings[symbol].volume -= trade.volume; // Volume can go negative
                            // investedValue should not change as there's no long position to reduce.
                        }
                    }
                    accResult += realizedPL;
                    break;
                }
                case TradeTypes.Cash: { type = "Money"; currentCash += tradeValueBase + (trade.fee * tradeRate); break; }
                case TradeTypes.Dividends: {
                    type = "Dividends";
                    const amountForCashMove = (trade.symbol && currentHoldings[trade.symbol]?.volume)
                        ? trade.price * currentHoldings[trade.symbol].volume
                        : trade.price * trade.volume;
                    currentCash += (amountForCashMove * tradeRate) + (trade.fee * tradeRate);
                    break;
                }
                case TradeTypes.Investment: { type = "Investment"; currentCash += tradeValueBase + (trade.fee * tradeRate); break; }
            }
            
            // Clean up holdings with zero volume
            Object.keys(currentHoldings).forEach(symbol => {
                if (currentHoldings[symbol].volume === 0) {
                    delete currentHoldings[symbol];
                }
            });

            // Calculate current end-of-trade portfolio value and metrics (snapshot after each trade/transaction)
            let totalMarketValue = 0;
            let totalMarketValueBase = 0;
            let totalInvested = 0;
            let totalInvestedBase = 0;
            let unrealizedPL = 0;
            
            // Re-calculate market value based on current holdings and today's prices
            const tradeDayString = moment.utc(trade.tradeTime).format(formatYMD);
            for (const symbol in currentHoldings) {
                const holding = currentHoldings[symbol];
                const price = getDateSymbolPrice(tradeDayString, symbol);
                const rate = getRate(holding.currency, portfolioInstance.currency, tradeDayString);

                if (price != null && rate != null) {
                    const holdingValue = price * holding.volume;
                    const holdingValueBase = holdingValue * rate;
                    totalMarketValue += holdingValue;
                    totalMarketValueBase += holdingValueBase;
                    totalInvested = toNumFullPrecision(totalInvested + holding.investedValue / rate);
                    totalInvestedBase = toNumFullPrecision(totalInvestedBase + holding.investedValue);
                    unrealizedPL = toNumFullPrecision(unrealizedPL + (holdingValueBase - holding.investedValue));

                } else {
                    console.warn(`Could not get price/rate for ${symbol} on ${tradeDayString} for trade before next day calculation. Will affect calculation.`);
                }
            }

            const currentNAV = totalMarketValueBase + currentCash;
            const currentNavBase = currentNAV;

            accMarketValue = totalMarketValue;
            accMarketValueBase = totalMarketValueBase;
            accCash = currentCash;
            accCashBase = currentCash;

            reportRows.push({
                Date: moment.utc(trade.tradeTime).format(formatYMD),
                Type: type,
                Symbol: trade.symbol || "",
                Volume: toNumLocal(trade.volume),
                "Original price": toNumLocal(trade.price), 
                MarketPrice: toNumLocal(getDateSymbolPrice(tradeDayString, trade.symbol || "") || 0), // Use actual market price on trade day
                "Original FX": toNumLocal(trade.rate),
                MarketFX: toNumLocal(tradeRate),
                Fee: toNumLocal(trade.fee),
                Invested: toNumLocal(totalInvested),
                InvestedBase: toNumLocal(totalInvestedBase),
                MarketValue: toNumLocal(totalMarketValue),
                BaseMarketValue: toNumLocal(totalMarketValueBase),
                Realized: toNumLocal(realizedPL),
                Result: toNumLocal(realizedPL + unrealizedPL),
                resultBase: toNumLocal(realizedPL + unrealizedPL),
                "Unrealized Result": toNumLocal(unrealizedPL),
                Cash: toNumLocal(currentCash),
                CashBase: toNumLocal(currentCash),
                "Acc. Result": toNumLocal(accResult),
                AccMarketVvalue: toNumLocal(accMarketValue),
                AccMarketValueBase: toNumLocal(accMarketValueBase),
                AccCash: toNumLocal(accCash),
                AccCashBase: toNumLocal(accCashBase),
                NAV: toNumLocal(currentNAV),
                NavBase: toNumLocal(currentNavBase),
            });
        }
    } else {
      return { error: "Invalid granularity specified. Use 'day' or 'trade'." };
    }


    // --- Final Output ---
    if (exportToCsv) {
        // Pre-process data: convert 'Symbol' array to string and ensure all numbers are handled
        const processedData = reportRows.map(row => {
            const newRow: Record<string, any> = { ...row }; // Copy row
            if (Array.isArray(newRow.Symbol)) { // only if is an array.
                newRow.Symbol = newRow.Symbol.join(',');
            }
            // Ensure numbers are formatted consistently for stringify, for cases where cast might not catch them
            for (const key in newRow) {
                if (typeof newRow[key] === 'number') {
                    newRow[key] = Number(newRow[key]); // Ensure it's a number, cast will handle formatting to 2 decimal places later
                }
            }
            return newRow;
        });

        // Determine all unique columns from the processed data for headers
        const allKeys = new Set<string>();
        processedData.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
        });
        const columns = Array.from(allKeys).map(key => ({
            key,
            header: key,
        }));

        const csvContent = await new Promise<string>((resolve, reject) => {
            stringify(processedData, {
                header: true,
                columns: columns,
                cast: {
                    number: (value: number) => value !== undefined && value !== null ? value.toFixed(2) : '', // Format numbers to 2 decimal places
                    date: (value: Date) => moment(value).isValid() ? moment(value).format('YYYY-MM-DD') : '', // Format valid dates
                }
            }, (err, result) => {
                if (err) reject(err);
                resolve(result || '');
            });
        });

        const toolsDirPath = `/home/lars/projects/ps2/server/logs/`;
        await fs.mkdir(toolsDirPath, { recursive: true });

        const filePath = `${toolsDirPath}/${fileName}`;
        await fs.writeFile(filePath, csvContent);

        return { filePath };

    } else {
        return reportRows;
    }

  } catch (err) {
    console.error("Critical error in portfolios.debug function:", err);
    return { error: `Failed to generate debug report: ${err instanceof Error ? err.message : String(err)}` };
  }
}