import { UserData } from "@/services/websocket";
import { ErrorType } from "@/types/other";
import { getPortfolioInstanceByIDorName } from "./helper";
import moment from "moment"; // For date handling
import { Trade, TradeTypes, TradeSide } from "../../types/trade"; // For trade types
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
  FX?: string; // New column for the stock's currency, moved for better positioning
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
type HoldingsMap = Record<string, { volume: number; currency: string; investedValue: number; investedValueInTradeCurrency: number }>; // Added investedValueInTradeCurrency to track cost basis in original currency

export async function debug(
  params: { args: { portfolioId: string; fee?: number; granularity?: "day" | "trade"; from?: string; till?: string; exportToCsv?: boolean; fileName?: string; includeSummaries?: boolean } },
  sendResponse: (data: any) => void, // Changed from (data: any, msgId: string, userModif: string) to (data: any) as these are not used within the function
  msgId: string, // Kept to satisfy type although not directly used in the function logic
  userModif: string, // Kept to satisfy type although not directly used in the function logic
  userData: UserData,
): Promise<ReportRowType[] | { filePath: string } | ErrorType> {
  try {
    const { portfolioId, fee, granularity, from, till, exportToCsv, fileName = `portfolio_debug_report_${moment().format('YYYYMMDD_HHmmss')}.csv`, includeSummaries = true } = params.args;
    if (!portfolioId) {
      return { error: "Portfolio ID is required" };
    }

    const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 4 }); // Changed to 4 decimal places
    const toNumFullPrecision = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 8 }); // Helper for internal calculations to maintain precision

    const { _id: realId, instance: portfolioInstance, error: portfolioInstanceError } = await getPortfolioInstanceByIDorName(portfolioId, userData);
    if (portfolioInstanceError || !portfolioInstance) {
      return { error: `Portfolio not found (or access denied): ${portfolioId}` }; // More specific error
    }

    console.log(`[portfolios.debug] Generating debug report for portfolio: ${portfolioId}, fee: ${fee}, granularity: ${granularity || 'default'}`);

    // --- 1. Fetch ALL Relevant Trades ---
    // Fetch all trades up to the end date to establish initial state and daily changes
    const allTradesResult = await getPortfolioTrades(realId, undefined, {
      ...(till && isValidDateFormat(till) && { tradeTime: { $lte: `${till.split("T")[0]}T23:59:59` } }),
    });

    if ((allTradesResult as { error: string }).error) {
      return { error: (allTradesResult as { error: string }).error };
    }
    const allTrades = (allTradesResult as Trade[]).sort((a, b) => moment.utc(a.tradeTime).diff(moment.utc(b.tradeTime)));
    console.log(`[portfolios.debug] Fetched trades:`, allTrades.map(t => ({ symbol: t.symbol, tradeType: t.tradeType, volume: t.volume, price: t.price, fee: t.fee, tradeTime: t.tradeTime, tradeRate: t.rate })));

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
        return { error: "No start date or trades found to generate report."};
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
    let currentShares = 0; // For fund-type portfolios for NAV per share (currently unused, but kept for future expansion)
    let currentHoldings: HoldingsMap = {}; // Tracks symbol -> {volume, currency, current total invested value (cost basis in base currency), invested value in trade currency}
    const reportRows: ReportRowType[] = []; // Array to store the final report data

    // Accumulated metrics - defined here to be accessible throughout the day loop
    let accResult = 0; // Accumulated total result (Realized P/L + Cash/Dividend/Investment/Correction impacts)
    let accRealizedPL = 0; // Accumulated Realized P/L from sell trades only

    // --- 5. Process Initial State (Trades Before Start Date) ---
    // This loop establishes the portfolio state (holdings, cash) at the beginning of the 'from' date.
    const tradesBeforeStart = allTrades.filter(trade => moment.utc(trade.tradeTime).isBefore(startDateMoment, 'day'));
    for (const trade of tradesBeforeStart) {
        const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime); // Market FX rate for external price conversions
        if (marketFXRateOnDay == null) {
             console.warn(`Skipping pre-start trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
             continue;
        }

        // Calculate original/base amounts including fee for cost basis and cash flow for this trade
        let tradeInvestedOriginalCurrency: number;
        let tradeInvestedBaseCurrency: number;
        let tradeValueUnadjusted: number; // Value before fee adjustment

        if (trade.tradeType === TradeTypes.Trade) {
            tradeValueUnadjusted = trade.price * trade.volume;
            tradeInvestedOriginalCurrency = tradeValueUnadjusted + (trade.fee || 0); // Include fee in original currency cost
            tradeInvestedBaseCurrency = (tradeValueUnadjusted * trade.rate) + ((trade.fee || 0) * trade.rate); // Use trade.rate for cost basis in base currency, include fee
        } else { // For Cash, Dividends, Investment, Correction uses trade.price as the amount
            tradeValueUnadjusted = trade.price;
            tradeInvestedOriginalCurrency = trade.price + (trade.fee || 0); // Include fee in original currency amount
            tradeInvestedBaseCurrency = (trade.price * trade.rate) + ((trade.fee || 0) * trade.rate); // Use trade.rate for base currency, include fee
        }

        let realizedPLForAccResult = 0; // Realized P/L in base currency, for comprehensive accResult
        let realizedPLForAccRealizedPL = 0; // Realized P/L in base currency, strictly from asset sales

        switch (trade.tradeType) {
            case TradeTypes.Trade: {
                const dir = trade.side === "B" ? 1 : -1; // 1 for Buy, -1 for Sell
                const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - ((trade.fee || 0) * trade.rate); // Cash impact uses trade's rate
                currentCash += cashChange;
                //console.log(`[portfolios.debug] Pre-start Trade: ${trade.tradeTime} ${trade.symbol} ${trade.side} Vol:${trade.volume} Price:${trade.price} Fee:${trade.fee}. cashChange=${cashChange}. currentCash now=${currentCash}`);

                const { symbol } = trade;
                if (!currentHoldings[symbol]) {
                    currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                }
                
                if (dir === 1) { // Buy
                    currentHoldings[symbol].volume += trade.volume;
                    currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + tradeInvestedBaseCurrency);
                    currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeInvestedOriginalCurrency);
                    //console.log(`[portfolios.debug] Pre-start Buy Holding: ${trade.symbol} Vol:${currentHoldings[symbol].volume} Invested:${toNumLocal(currentHoldings[symbol].investedValue)} OrigInvested:${toNumLocal(currentHoldings[symbol].investedValueInTradeCurrency)}`);
                } else { // Sell
                  if (currentHoldings[symbol].volume > 0) {
                     const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                     const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);
                     
                     realizedPLForAccResult = toNumFullPrecision(
                        (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - ((trade.fee || 0) * trade.rate)
                     ); // Realized PL in base currency, using trade.rate for consistency with InvestedBase
                     realizedPLForAccRealizedPL = realizedPLForAccResult; // This is a true realized P/L from a sale
                     
                     currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                     currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                     currentHoldings[symbol].volume -= trade.volume;
                   } else { // currentHoldings[symbol].volume <= 0 (e.g., short sell or no position)
                       realizedPLForAccResult = toNumFullPrecision(-((trade.fee || 0) * trade.rate)); // Only fee impacts if no long position
                       realizedPLForAccRealizedPL = realizedPLForAccResult; // This is a true realized P/L from a sell, even if no position
                       currentHoldings[symbol].volume -= trade.volume; // Volume can go negative
                   }
                   accResult += realizedPLForAccResult; // Update accumulated result with realized PL from pre-start sells
                   accRealizedPL += realizedPLForAccRealizedPL;
                }
                break;
            }
            case TradeTypes.Cash:
            case TradeTypes.Dividends:
            case TradeTypes.Investment:
            case TradeTypes.Correction: { // Correction added for consistency
                currentCash += tradeInvestedBaseCurrency; // tradeInvestedBaseCurrency encapsulates total cash impact (amount + fee)
                accResult += tradeInvestedBaseCurrency; // These directly increase accumulated result
                //console.log(`[portfolios.debug] Pre-start Cash/Div/Inv/Corr: ${trade.tradeTime} ${trade.tradeType} ${trade.price} Fee:${trade.fee}. cashMove=${tradeInvestedBaseCurrency}. currentCash now=${currentCash}`);
                if (trade.shares && trade.tradeType === TradeTypes.Investment) {
                    currentShares += trade.shares;
                }
                break;
            }
        }
    }

    // Clean up initial holdings with zero volume
    Object.keys(currentHoldings).forEach(symbol => {
        if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
            delete currentHoldings[symbol];
        } else {
            // Ensure values are not NaN if they became so during initial processing due to bad inputs
            if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
            if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
        }
    });

    // Update accumulated cash and base cash after initial trades (actual accumulated values)
    // accCash = currentCash;
    // accCashBase = currentCash; // For now assuming base currency matches currentCash currency for simplicity. Need to derive base currency rate for this.

    console.log(`[portfolios.debug] Initial state after pre-start trades: currentCash=${currentCash}, accRealizedPL=${accRealizedPL}, accResult=${accResult}, currentHoldings=${JSON.stringify(currentHoldings)}`);


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
            // Market FX rate at trade time, for informational display (e.g., MarketFX column)
            const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (marketFXRateOnDay == null) {
                console.warn(`Skipping trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue; // Skip processing if market rate is not available
            }

            // Calculate original/base amounts including fee for cost basis and cash flow for this trade
            let tradeInvestedOriginalCurrency: number;
            let tradeInvestedBaseCurrency: number;
            let tradeValueUnadjusted: number; // Value before fee adjustment

            if (trade.tradeType === TradeTypes.Trade) {
                tradeValueUnadjusted = trade.price * trade.volume;
                tradeInvestedOriginalCurrency = tradeValueUnadjusted + (trade.fee || 0); // Include fee in original currency cost
                tradeInvestedBaseCurrency = (tradeValueUnadjusted * trade.rate) + ((trade.fee || 0) * trade.rate); // Use trade.rate for cost basis in base currency, include fee
            } else { // For Cash, Dividends, Investment, Correction uses trade.price as the amount
                tradeValueUnadjusted = trade.price;
                tradeInvestedOriginalCurrency = trade.price + (trade.fee || 0); // Include fee in original currency amount
                tradeInvestedBaseCurrency = (trade.price * trade.rate) + ((trade.fee || 0) * trade.rate); // Use trade.rate for base currency, include fee
            }

            let realizedPLForAccResult = 0; // Realized P/L in base currency, for comprehensive accResult
            let realizedPLForAccRealizedPL = 0; // Realized P/L in base currency, strictly from asset sales
            
            // Apply financial impact of today's trades to cash and holdings
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - ((trade.fee || 0) * trade.rate); // Cash impact uses trade's rate
                    currentCash += cashChange;

                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                    }
                    
                    if (dir === 1) { // Buy
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + tradeInvestedBaseCurrency);
                        currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeInvestedOriginalCurrency);
                    } else { // Sell
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                            const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);

                            realizedPLForAccResult = toNumFullPrecision(
                                (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - ((trade.fee || 0) * trade.rate)
                            ); // Realized PL in base currency
                            realizedPLForAccRealizedPL = realizedPLForAccResult; // This is a true realized P/L from a sale
                            
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                            currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else { // currentHoldings[symbol].volume <= 0
                            realizedPLForAccResult = toNumFullPrecision(-((trade.fee || 0) * trade.rate)); // Only fee impacts if no long position
                            realizedPLForAccRealizedPL = realizedPLForAccResult; // This is a true realized P/L from a sell, even if no position
                            currentHoldings[symbol].volume -= trade.volume; // Volume can go negative
                        }
                    }
                    accResult += realizedPLForAccResult;
                    accRealizedPL += realizedPLForAccRealizedPL;
                    break;
                }
                case TradeTypes.Cash:
                case TradeTypes.Dividends:
                case TradeTypes.Investment:
                case TradeTypes.Correction: { // Correction added for consistency
                    currentCash += tradeInvestedBaseCurrency; // tradeInvestedBaseCurrency encapsulates total cash impact (amount + fee)
                    accResult += tradeInvestedBaseCurrency; // These directly increase accumulated result
                    if (trade.shares && trade.tradeType === TradeTypes.Investment) {
                        currentShares += trade.shares;
                    }
                    break;
                }
            }
        }
        // Clean up holdings with zero volume after all trades for the day
        Object.keys(currentHoldings).forEach(symbol => {
            if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
                delete currentHoldings[symbol];
            } else {
                 if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
                 if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
            }
        });

        // Calculate end-of-day portfolio value and metrics BEFORE pushing report rows
        let totalMarketValue = 0; // Total market value accumulating holdings in their original currencies
        let totalMarketValueBase = 0; // Total market value of all holdings in portfolio base currency
        let totalInvested = 0; // Total invested value (cost basis) of all holdings in original currencies
        let totalInvestedBase = 0; // Total invested value (cost basis) of all holdings in base currency
        let unrealizedPL = 0;

        for (const symbol in currentHoldings) { // Calculate market values and invested totals from current holdings
          const holding = currentHoldings[symbol];
          const marketPrice = getDateSymbolPrice(currentDayString, symbol); // Use market price for current value
          const marketFX = getRate(holding.currency, portfolioInstance.currency, currentDayString); // Market FX rate for current value conversion

          if (marketPrice != null && marketFX != null) {
              const holdingValue = marketPrice * holding.volume;
              const holdingValueBase = holdingValue * marketFX;

              totalMarketValue += holdingValue;
              totalMarketValueBase += holdingValueBase;
              totalInvested += holding.investedValueInTradeCurrency; // Sum of original currency invested amounts
              totalInvestedBase += holding.investedValue; // Sum of base currency invested amounts
 
              unrealizedPL = toNumFullPrecision(unrealizedPL + (holdingValueBase - holding.investedValue));

          } else {
              console.warn(`Could not get market price/rate for ${symbol} on ${currentDayString}. Will affect calculation.`);
          }
        }

        // All NAV-related calculations must happen after currentCash, totalMarketValueBase, and totalMarketValue are finalized for the day.
        // This ensures the accumulated totals are correct for the current day's report.
        const currentNAV = currentCash + totalMarketValueBase; // NAV is Cash + Market Value in Base Currency
        const currentNavBase = currentNAV; // Same as currentNAV as it's already in base currency
 
        // Update accumulated values for the report.
        let accMarketValue = totalMarketValue;
        let accMarketValueBase = totalMarketValueBase;
        let accCash = currentCash;
        let accCashBase = currentCash; // For now assuming base currency matches currentCash currency for simplicity. Need to derive base currency rate for this.
        
        // --- Report Rows Generation for the current day ---
        // 1. Portfolio Summary Row (at the start of the day after all calculations for today are done)
        if (includeSummaries) {
            reportRows.push({
                Date: currentDayString,
                Type: "Portfolio Summary",
                Symbol: "", // Blank for summary
                Volume: toNumLocal(Object.values(currentHoldings).reduce((sum, h) => toNumFullPrecision(sum + h.volume), 0)),
                // Use weighted average Cost Basis / Market Price for aggregated summary
                "Original price": toNumLocal(Object.values(currentHoldings).reduce((sum, h) => sum + h.investedValueInTradeCurrency, 0) / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)),
                MarketPrice: toNumLocal(totalMarketValue / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)),
                "Original FX": toNumLocal(1), // Not meaningful for aggregated row
                MarketFX: toNumLocal(1), // Not meaningful for aggregated row
                Fee: toNumLocal(0), // Not meaningful for aggregated row
                Invested: toNumLocal(totalInvested),
                InvestedBase: toNumLocal(totalInvestedBase),
                MarketValue: toNumLocal(totalMarketValue),
                BaseMarketValue: toNumLocal(totalMarketValueBase),
                Realized: toNumLocal(accRealizedPL), // Accumulated Realized P/L
                Result: toNumLocal(accResult + unrealizedPL), // Net Result = Realized P/L + Unrealized P/L + other income/expenses in base currency
                resultBase: toNumLocal(accResult + unrealizedPL),
                "Unrealized Result": toNumLocal(unrealizedPL),
                Cash: toNumLocal(currentCash),
                CashBase: toNumLocal(currentCash),
                "Acc. Result": toNumLocal(accResult + unrealizedPL), // Consistent with Result for Portfolio Summary
                AccMarketVvalue: toNumLocal(accMarketValue),
                AccMarketValueBase: toNumLocal(accMarketValueBase),
                AccCash: toNumLocal(accCash),
                AccCashBase: toNumLocal(accCashBase),
                NAV: toNumLocal(currentNAV),
                NavBase: toNumLocal(currentNavBase),
            });
        }

        // 2. Add individual Position Snapshot rows for the current day (after all trades are processed)
        for (const symbol in currentHoldings) {
            const holding = currentHoldings[symbol];
            const marketPrice = getDateSymbolPrice(currentDayString, symbol);
            const marketFX = getRate(holding.currency, portfolioInstance.currency, currentDayString);

            if (marketPrice != null && marketFX != null) {
                const holdingValue = marketPrice * holding.volume;
                const holdingValueBase = holdingValue * marketFX;
                const individualUnrealizedPL = toNumFullPrecision(holdingValueBase - holding.investedValue); // Unrealized PL in base currency

                reportRows.push({
                    Date: currentDayString,
                    Type: "Position Snapshot",
                    Symbol: symbol,
                    FX: holding.currency,
                    Volume: toNumLocal(holding.volume),
                    // Original price is average cost per share in its original currency
                    "Original price": toNumLocal(holding.volume > 0 ? holding.investedValueInTradeCurrency / holding.volume : 0),
                    MarketPrice: toNumLocal(marketPrice),
                    // Original FX is the FX rate at which the initial invested amount was converted
                    // This can be derived from investedValue and investedValueInTradeCurrency
                    "Original FX": toNumLocal(holding.investedValueInTradeCurrency !== 0 ? holding.investedValue / holding.investedValueInTradeCurrency : 1),
                    MarketFX: toNumLocal(marketFX),
                    Fee: toNumLocal(0), // No fee for snapshot
                    Invested: toNumLocal(holding.investedValueInTradeCurrency),
                    InvestedBase: toNumLocal(holding.investedValue),
                    MarketValue: toNumLocal(holdingValue),
                    BaseMarketValue: toNumLocal(holdingValueBase),
                    Realized: toNumLocal(0), // No realized PL on a snapshot
                    Result: toNumLocal(individualUnrealizedPL), // Snapshot result is unrealized PL
                    resultBase: toNumLocal(individualUnrealizedPL),
                    "Unrealized Result": toNumLocal(individualUnrealizedPL),
                    Cash: toNumLocal(currentCash), // Show current cash as of end of day
                    CashBase: toNumLocal(currentCash), // Show current base cash as of end of day
                    "Acc. Result": toNumLocal(accResult), // Accumulated total income/loss up to this point
                    AccMarketVvalue: toNumLocal(accMarketValue),
                    AccMarketValueBase: toNumLocal(accMarketValueBase),
                    AccCash: toNumLocal(accCash),
                    AccCashBase: toNumLocal(accCashBase),
                    NAV: toNumLocal(currentNAV),
                    NavBase: toNumLocal(currentNavBase),
                });
            } else {
                console.warn(`Could not get market price/rate for ${symbol} on ${currentDayString} for position snapshot. Skipping.`);
            }
        }

        // 3. Add individual Trade Rows (Buy/Sell) for the current day
        // These are added AFTER the daily summary and snapshots to better reflect the sequence of events
        for (const trade of todaysTrades) {
            const typeDisplay = (trade.tradeType === TradeTypes.Trade) ? `Trade (${trade.side === TradeSide.Buy ? "Buy" : "Sell"})` :
                                (trade.tradeType === TradeTypes.Cash && trade.side === TradeSide.PUT) ? "Cash Deposit" :
                                (trade.tradeType === TradeTypes.Cash && trade.side === TradeSide.WITHDRAW) ? "Cash Withdrawal" :
                                trade.tradeType; // Keep original if not explicitly handled

            const tradeRateForReport = trade.rate; // Use the rate recorded in the trade object
            const marketFXRateForReport = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime); // Market FX on trade date

            let realizedPLCurrentTrade = 0; // For Buy/Sell trades
            let tradeResultForAcc = 0; // For accumulated result
            let tradeRealizedPLForAcc = 0; // For accumulated realized PL

            if (trade.tradeType === TradeTypes.Trade) {
                const totalCostOriginalCurrency = (trade.price * trade.volume) + (trade.fee || 0);
                const totalCostBaseCurrency = (trade.price * trade.volume * trade.rate) + ((trade.fee || 0) * trade.rate);

                if (trade.side === TradeSide.Buy) {
                    // For buys, the 'result' is just the cost or 0 as no PL is realized
                    realizedPLCurrentTrade = 0; 
                    tradeResultForAcc = -totalCostBaseCurrency; // Cost of buy affects Result
                } else { // Sell
                    // Realized PL for this specific trade needs to be based on the impact to accRealizedPL.
                    // This is for display for THIS trade only.
                    // The overall accRealizedPL and accResult already include this trade's financial impact.
                    realizedPLCurrentTrade = toNumFullPrecision(accRealizedPL); // The last addition to accRealizedPL
                    tradeResultForAcc = toNumFullPrecision(accResult); // The last addition to accResult
                }
                tradeRealizedPLForAcc = realizedPLCurrentTrade; // Use this for the Realized column in the trade row
            } else { // For Cash, Dividends, Investment, Correction
                 realizedPLCurrentTrade = 0; // No realized PL for these
                 tradeResultForAcc = toNumFullPrecision((trade.price * trade.rate) + ((trade.fee || 0) * trade.rate)); // Cash change
                 if (trade.side === TradeSide.WITHDRAW) tradeResultForAcc *= -1; // If it's a withdrawal, it's negative
                 tradeRealizedPLForAcc = 0; // No realized PL
            }


            // Determine Invested for display in trade row
            let displayInvested: number|undefined = undefined;
            let displayInvestedBase: number|undefined = undefined;
            if (trade.tradeType === TradeTypes.Trade && trade.side === TradeSide.Buy) {
                const totalCostOriginalCurrency = (trade.price * trade.volume) + (trade.fee || 0);
                const totalCostBaseCurrency = (trade.price * trade.volume * trade.rate) + ((trade.fee || 0) * trade.rate);
                displayInvested = toNumLocal(totalCostOriginalCurrency);
                displayInvestedBase = toNumLocal(totalCostBaseCurrency);
            }

            reportRows.push({
                Date: currentDayString,
                Type: typeDisplay,
                Symbol: trade.symbol || "",
                FX: trade.currency,
                Volume: toNumLocal(trade.volume),
                "Original price": toNumLocal(trade.price), // Original trade price, not market close
                MarketPrice: toNumLocal(getDateSymbolPrice(trade.tradeTime, trade.symbol || "") || trade.price), // Market price on trade day
                "Original FX": toNumLocal(tradeRateForReport), // Original trade FX, consistent
                MarketFX: toNumLocal(marketFXRateForReport), // Market FX on trade day
                Fee: toNumLocal(trade.fee),
                Invested: displayInvested,
                InvestedBase: displayInvestedBase,
                MarketValue: toNumLocal(0), // Not applicable for a trade row
                BaseMarketValue: toNumLocal(0), // Not applicable for a trade row
                Realized: toNumLocal(realizedPLCurrentTrade), // Realized P/L for *this specific trade only*
                Result: toNumLocal(tradeResultForAcc), // Cash flow impact or realized PL for *this specific trade only*
                resultBase: toNumLocal(tradeResultForAcc), // Result in base currency for *this specific trade only*
                "Unrealized Result": toNumLocal(0), // Not applicable for a trade row
                Cash: toNumLocal(currentCash), // Show current cash as of end of day
                CashBase: toNumLocal(currentCash), // Show current base cash as of end of day
                "Acc. Result": toNumLocal(accResult), // Accumulated total income/loss up to this point
                AccMarketVvalue: toNumLocal(accMarketValue),
                AccMarketValueBase: toNumLocal(accMarketValueBase),
                AccCash: toNumLocal(accCash),
                AccCashBase: toNumLocal(accCashBase),
                NAV: toNumLocal(currentNAV),
                NavBase: toNumLocal(currentNavBase),
            });
        }
        
        // 4. Add Daily Close Entry if day granularity
        if (includeSummaries) {
            reportRows.push({
                Date: currentDayString,
                Type: "Daily Close",
                Symbol: "", // Blank for summary
                Volume: toNumLocal(0),
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
        }

        loopMoment.add(1, 'day'); // Move to the next day
       }
    } else if (granularity === "trade") { // Simpler trade-by-trade functionality
       for (const trade of allTrades) {
            const currentDayString = moment.utc(trade.tradeTime).format(formatYMD);
            const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (marketFXRateOnDay == null) {
                console.warn(`Skipping trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }

            let tradeInvestedOriginalCurrency: number;
            let tradeInvestedBaseCurrency: number;
            let tradeValueUnadjusted: number;

            if (trade.tradeType === TradeTypes.Trade) {
                tradeValueUnadjusted = trade.price * trade.volume;
                tradeInvestedOriginalCurrency = tradeValueUnadjusted + (trade.fee || 0);
                tradeInvestedBaseCurrency = (tradeValueUnadjusted * trade.rate) + ((trade.fee || 0) * trade.rate);
            } else {
                tradeValueUnadjusted = trade.price;
                tradeInvestedOriginalCurrency = trade.price + (trade.fee || 0);
                tradeInvestedBaseCurrency = (trade.price * trade.rate) + ((trade.fee || 0) * trade.rate);
            }

            let realizedPLCurrentTrade = 0; // For Buy/Sell trades
            let tradeResultForAcc = 0; // For accumulated result
            let tradeRealizedPLForAcc = 0; // For accumulated realized PL
            let typeDisplay = "Trade"; 
            
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    typeDisplay = `Trade (${trade.side === TradeSide.Buy ? "Buy" : "Sell"})`;
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - ((trade.fee || 0) * trade.rate);
                    currentCash += cashChange;

                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                    }
                    
                    if (dir === 1) { // Buy
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + tradeInvestedBaseCurrency);
                        currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeInvestedOriginalCurrency);
                    } else { // Sell
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                            const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);
                            
                            realizedPLCurrentTrade = toNumFullPrecision(
                                (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - ((trade.fee || 0) * trade.rate)
                            );
                            tradeRealizedPLForAcc = realizedPLCurrentTrade;
                            
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                            currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else {
                            realizedPLCurrentTrade = toNumFullPrecision(-((trade.fee || 0) * trade.rate));
                            tradeRealizedPLForAcc = realizedPLCurrentTrade;
                            currentHoldings[symbol].volume -= trade.volume;
                        }
                    }
                    accResult += realizedPLCurrentTrade; 
                    accRealizedPL += tradeRealizedPLForAcc;
                    break;
                }
                case TradeTypes.Cash:
                    typeDisplay = (trade.side === TradeSide.PUT) ? "Cash Deposit" : "Cash Withdrawal";
                    tradeResultForAcc = tradeInvestedBaseCurrency;
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
                case TradeTypes.Dividends:
                    typeDisplay = "Dividends";
                    tradeResultForAcc = tradeInvestedBaseCurrency;
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
                case TradeTypes.Investment:
                    typeDisplay = "Investment";
                    tradeResultForAcc = tradeInvestedBaseCurrency;
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                     if (trade.shares) currentShares += trade.shares;
                    break;
                case TradeTypes.Correction:
                    typeDisplay = "Correction";
                    tradeResultForAcc = tradeInvestedBaseCurrency;
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
            }
            
            // Clean up holdings with zero volume
            Object.keys(currentHoldings).forEach(symbol => {
                if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
                    delete currentHoldings[symbol];
                } else {
                    if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
                    if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
                }
            });
 
            // Calculate current end-of-trade portfolio value and metrics (snapshot after each trade/transaction)
            let totalMarketValue = 0;
            let totalMarketValueBase = 0;
            let totalInvested = 0;
            let totalInvestedBase = 0;
            let unrealizedPL = 0;
            
            // Re-calculate market value based on current holdings and today's prices
            for (const symbol in currentHoldings) {
                const holding = currentHoldings[symbol];
                const marketPrice = getDateSymbolPrice(currentDayString, symbol);
                const marketFX = getRate(holding.currency, portfolioInstance.currency, currentDayString);
 
                if (marketPrice != null && marketFX != null) {
                    const holdingValue = marketPrice * holding.volume;
                    const holdingValueBase = holdingValue * marketFX;
                    totalMarketValue += holdingValue;
                    totalMarketValueBase += holdingValueBase;
                    totalInvested += holding.investedValueInTradeCurrency;
                    totalInvestedBase += holding.investedValue;
                    unrealizedPL = toNumFullPrecision(unrealizedPL + (holdingValueBase - holding.investedValue));
 
                } else {
                    console.warn(`Could not get price/rate for ${symbol} on ${currentDayString} for trade calculation. Will affect calculation.`);
                }
            }
 
            const currentNAV = currentCash + totalMarketValueBase;
            const currentNavBase = currentNAV;
 
            let accCash = currentCash;
            let accCashBase = currentCash;
 
            // Determine Invested for display in trade row
            let displayInvestedTradegranularity: number|undefined = undefined;
            let displayInvestedBaseTradegranularity: number|undefined = undefined;
            if (trade.tradeType === TradeTypes.Trade && trade.side === TradeSide.Buy) {
                const totalCostOriginalCurrency = (trade.price * trade.volume) + (trade.fee || 0);
                const totalCostBaseCurrency = (trade.price * trade.volume * trade.rate) + ((trade.fee || 0) * trade.rate);
                displayInvestedTradegranularity = toNumLocal(totalCostOriginalCurrency);
                displayInvestedBaseTradegranularity = toNumLocal(totalCostBaseCurrency);
            }
 
            reportRows.push({
                Date: currentDayString,
                Type: typeDisplay,
                Symbol: trade.symbol || "",
                FX: trade.currency,
                Volume: toNumLocal(trade.volume),
                "Original price": toNumLocal(trade.price), 
                MarketPrice: toNumLocal(getDateSymbolPrice(currentDayString, trade.symbol || "") || trade.price), // Use actual market price on trade day
                "Original FX": toNumLocal(trade.rate),
                MarketFX: toNumLocal(marketFXRateOnDay),
                Fee: toNumLocal(trade.fee),
                Invested: displayInvestedTradegranularity,
                InvestedBase: displayInvestedBaseTradegranularity,
                MarketValue: toNumLocal(totalMarketValue),
                BaseMarketValue: toNumLocal(totalMarketValueBase),
                Realized: toNumLocal(realizedPLCurrentTrade),
                Result: toNumLocal(tradeResultForAcc),
                resultBase: toNumLocal(tradeResultForAcc),
                "Unrealized Result": toNumLocal(unrealizedPL),
                Cash: toNumLocal(currentCash),
                CashBase: toNumLocal(currentCash),
                "Acc. Result": toNumLocal(accResult),
                AccMarketVvalue: toNumLocal(totalMarketValue),
                AccMarketValueBase: toNumLocal(totalMarketValueBase),
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
        const processedData = reportRows.map(row => {
            const newRow: Record<string, any> = { ...row }; // Copy row
            // Ensure numbers are formatted consistently for stringify, for cases where cast might not catch them
            for (const key in newRow) {
                if (typeof newRow[key] === 'number') {
                    newRow[key] = toNum({ n: newRow[key], precision: 4 }); // Ensure 4 decimal places for CSV export
                }
            }
            return newRow;
        });

        const columns = [
            'Date', 'Type', 'Symbol', 'FX', 'Volume', 'Original price', 'MarketPrice',
            'Original FX', 'MarketFX', 'Fee', 'Invested', 'InvestedBase', 'MarketValue', 'BaseMarketValue',
            'Realized', 'resultBase', 'Result', 'Unrealized Result', 'Cash', 'CashBase',
            'Acc. Result', 'AccMarketVvalue', 'AccMarketValueBase', 'AccCash', 'AccCashBase', 'NAV', 'NavBase'
        ];

        const csvContent = await new Promise<string>((resolve, reject) => {
            stringify(processedData, {
                header: true,
                columns: columns,
                cast: {
                    number: (value: number) => value !== undefined && value !== null ? value.toFixed(4) : '', // Format numbers to 4 decimal places
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