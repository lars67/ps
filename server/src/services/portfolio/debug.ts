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
  params: { args: { portfolioId: string; fee?: number; granularity?: "day" | "trade"; from?: string; till?: string } },
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<ReportRowType[] | ErrorType> {
  try {
    const { portfolioId, fee, granularity, from, till } = params.args;
    if (!portfolioId) {
      return { error: "Portfolio ID is required" };
    }

    const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 2 }); // Default precision to 2 decimal places

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

    // Accumulated metrics
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

        const tradeValue = trade.price * trade.volume;
        const tradeValueBase = tradeValue * rate;
        
        switch (trade.tradeType) {
            case TradeTypes.Trade: {
                const dir = trade.side === "B" ? 1 : -1; // 1 for Buy, -1 for Sell
                // Use trade.fee instead of the input 'fee' parameter for cash change calculations
                const cashChange = -dir * tradeValueBase - (trade.fee * rate); // Impact on cash in base currency
                currentCash += cashChange;

                const { symbol } = trade;
                if (!currentHoldings[symbol]) {
                    currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0 };
                }
                
                // Track volume and cost basis for holdings
                // For sells, adjust investedValue proportionally or based on average cost
                if (dir === 1) { // Buy
                    currentHoldings[symbol].volume += trade.volume;
                    currentHoldings[symbol].investedValue += tradeValueBase;
                } else { // Sell
                  // Simple average cost reduction for sells:
                  if (currentHoldings[symbol].volume > 0) {
                     const avgCostPerShare = currentHoldings[symbol].investedValue / currentHoldings[symbol].volume;
                     currentHoldings[symbol].investedValue -= avgCostPerShare * trade.volume;
                     currentHoldings[symbol].volume -= trade.volume;
                  } else {
                    currentHoldings[symbol].volume -= trade.volume; // Should not go negative here in ideal flow
                  }
                }
                break;
            }
            case TradeTypes.Cash:
            case TradeTypes.Dividends:
            case TradeTypes.Investment: {
                // For dividends, adjust tradeValueBase by multiplying trade.price with volume from holdings
                const amountForCashMove = (trade.tradeType === TradeTypes.Dividends && trade.symbol && currentHoldings[trade.symbol]?.volume)
                ? trade.price * currentHoldings[trade.symbol].volume
                : trade.price * trade.volume; // Default for cash/investment type where trade.volume is typically 1

                const cashMove = (amountForCashMove * rate) + (trade.fee * rate);
                currentCash += cashMove;
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
        const todaysTrades = tradesByDate[currentDayString] || [];

        // Process trades for the current day
        for (const trade of todaysTrades) {
            const tradeRate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (tradeRate == null) {
                console.warn(`Skipping trade due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }

            const tradeValue = trade.price * trade.volume;
            const tradeValueBase = tradeValue * tradeRate;
            let realizedPL = 0; // Realized Profit/Loss for this trade

            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    const dir = trade.side === "B" ? 1 : -1;
                    // Use trade.fee here as well
                    const cashChange = -dir * tradeValueBase - (trade.fee * tradeRate);
                    currentCash += cashChange;

                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0 };
                    }
                    
                    // Keep track of average invested value for realized P/L calculation
                    if (dir === 1) { // Buy
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue += tradeValueBase;
                    } else { // Sell
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShare = currentHoldings[symbol].investedValue / currentHoldings[symbol].volume;
                            realizedPL = (tradeValueBase - (avgCostPerShare * trade.volume));
                            currentHoldings[symbol].investedValue -= avgCostPerShare * trade.volume;
                            currentHoldings[symbol].volume -= trade.volume;
                        } else {
                            // If selling without prior holdings, consider the entire sale as realization or an error
                            realizedPL = tradeValueBase; // Or handle as an error/short sell
                            currentHoldings[symbol].volume -= trade.volume; // Allow negative for short
                            currentHoldings[symbol].investedValue += tradeValueBase; // Reflect cash from short
                        }
                    }
                    accResult += realizedPL;
                    break;
                }
                case TradeTypes.Cash:
                case TradeTypes.Dividends:
                case TradeTypes.Investment: {
                    // For dividends, adjust tradeValueBase by multiplying trade.price with volume from holdings
                    const amountForCashMove = (trade.tradeType === TradeTypes.Dividends && trade.symbol && currentHoldings[trade.symbol]?.volume)
                    ? trade.price * currentHoldings[trade.symbol].volume
                    : trade.price * trade.volume; // Default for cash/investment type where trade.volume is typically 1

                    const cashMove = (amountForCashMove * tradeRate) + (trade.fee * tradeRate);
                    currentCash += cashMove;
                    if (trade.shares && trade.tradeType === TradeTypes.Investment) { // Only add shares for actual investment types
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

        // Calculate end-of-day portfolio value and metrics
        let totalMarketValue = 0;
        let totalMarketValueBase = 0;
        let totalInvested = 0;
        let totalInvestedBase = 0;
        let unrealizedPL = 0;

        for (const symbol in currentHoldings) {
          const holding = currentHoldings[symbol];
          const price = getDateSymbolPrice(currentDayString, symbol);
          const rate = getRate(holding.currency, portfolioInstance.currency, currentDayString);

          if (price != null && rate != null) {
              const holdingValue = price * holding.volume; // in original currency
              const holdingValueBase = holdingValue * rate; // in base currency

              totalMarketValue += holdingValue;
              totalMarketValueBase += holdingValueBase;
              totalInvested += holding.investedValue / rate; // Convert back to original currency for display
              totalInvestedBase += holding.investedValue;

              unrealizedPL += (holdingValueBase - holding.investedValue);

          } else {
              console.warn(`Could not get price/rate for ${symbol} on ${currentDayString}. Using default or last known. Will affect calculation.`);
              // For robustness, could use last known price or carry forward previous day's market value for this holding
          }
        }

        const currentNAV = totalMarketValueBase + currentCash;
        const currentNavBase = currentNAV; // Already in base currency

        // Update accumulated market values and cash for the report
        accMarketValue = totalMarketValue;
        accMarketValueBase = totalMarketValueBase;
        accCash = currentCash; // Current cash is the accumulated cash at end of day
        accCashBase = currentCash; // Assuming currentCash is already in base currency or equivalent

        reportRows.push({
          Date: currentDayString,
          Type: "Holding Processed", // Or "Daily Snapshot"
          Symbol: Object.keys(currentHoldings).length > 0 ? Object.keys(currentHoldings).join(',') : "", // List symbols held
          Volume: toNumLocal(Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0)), // Total shares
          "Original price": toNumLocal(Object.values(currentHoldings).reduce((sum, h) => sum + h.investedValue, 0) / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)), // Avg original price
          MarketPrice: toNumLocal(totalMarketValue / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)), // Avg market price
          "Original FX": toNumLocal(1), // Average FX might be complex - need to consider average or specific trade FX
          MarketFX: toNumLocal(1), // Average FX might be complex - need to consider average or specific trade FX
          Fee: toNumLocal(0), // Fees are linked to trades, not daily snapshot
          Invested: toNumLocal(totalInvested),
          InvestedBase: toNumLocal(totalInvestedBase),
          MarketValue: toNumLocal(totalMarketValue),
          BaseMarketValue: toNumLocal(totalMarketValueBase),
          Realized: toNumLocal(accResult), // From trades
          Result: toNumLocal(accResult + unrealizedPL), // Total Result = Realized + Unrealized
          resultBase: toNumLocal(accResult + unrealizedPL), // Already in base currency
          "Unrealized Result": toNumLocal(unrealizedPL),
          Cash: toNumLocal(currentCash),
          CashBase: toNumLocal(currentCash), // Assuming base currency
          "Acc. Result": toNumLocal(accResult + unrealizedPL),
          AccMarketVvalue: toNumLocal(accMarketValue),
          AccMarketValueBase: toNumLocal(accMarketValueBase),
          AccCash: toNumLocal(currentCash), // Assuming accCash is currentCash for daily snapshots
          AccCashBase: toNumLocal(currentCash), // Assuming accCashBase is currentCash for daily snapshots
          NAV: toNumLocal(currentNAV),
          NavBase: toNumLocal(currentNavBase),
        });

        loopMoment.add(1, 'day'); // Move to the next day
      }
    } else if (granularity === "trade") {
      // Logic for trade-by-trade reporting
      // This will involve iterating through `allTrades` directly and producing a row for each trade,
      // and calculating accumulated values up to that trade.
        for (const trade of allTrades) {
            const tradeRate = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (tradeRate == null) {
                console.warn(`Skipping trade due to missing rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }

            const tradeValue = trade.price * trade.volume;
            const tradeValueBase = tradeValue * tradeRate;
            let realizedPL = 0; // Realized Profit/Loss for this trade
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
                            currentHoldings[symbol].investedValue -= avgCostPerShare * trade.volume;
                            currentHoldings[symbol].volume -= trade.volume;
                        } else {
                            realizedPL = tradeValueBase; 
                            currentHoldings[symbol].volume -= trade.volume;
                            currentHoldings[symbol].investedValue += tradeValueBase; 
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
                    totalInvested += holding.investedValue / rate;
                    totalInvestedBase += holding.investedValue;
                    unrealizedPL += (holdingValueBase - holding.investedValue);

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
    return reportRows;

  } catch (err) {
    console.error("Critical error in portfolios.debug function:", err);
    return { error: `Failed to generate debug report: ${err instanceof Error ? err.message : String(err)}` };
  }
}