import { UserData } from "@/services/websocket";
import { ErrorType } from "@/types/other";
import { getPortfolioInstanceByIDorName } from "./helper";
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
import { isValidDateFormat, toNum } from "../../utils";
import { formatYMD, errorMsgs } from "../../constants";
import { stringify } from 'csv-stringify';
import fs from 'fs/promises';

export type ReportRowType = {
  Date: string;
  Type: string;
  Symbol: string;
  FX?: string;
  Volume: number;
  "Original price"?: number;
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

type HoldingsMap = Record<string, { volume: number; currency: string; investedValue: number; investedValueInTradeCurrency: number }>;

export async function debug(
  params: { [key: string]: any },
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<ReportRowType[] | { filePath: string; fileName: string } | ErrorType> {
  try {
    const effectiveParams = params.args || params;
    const { portfolioId, fee, granularity, from, till, exportToCsv, fileName = `portfolio_debug_report_${moment().format('YYYYMMDD_HHmmss')}.csv`, includeSummaries = true } = effectiveParams;
    if (!portfolioId) {
      return { error: "Portfolio ID is required" };
    }
    const toNumLocal = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 4 });
    const toNumFullPrecision = (n: number | null | undefined) => toNum({ n: n ?? 0, precision: 8 });
    const { _id: realId, instance: portfolioInstance, error: portfolioInstanceError } = await getPortfolioInstanceByIDorName(portfolioId, userData);
    if (portfolioInstanceError || !portfolioInstance) {
      return { error: `Portfolio not found (or access denied): ${portfolioId}` };
    }
    console.log(`[portfolios.debug] Generating debug report for portfolio: ${portfolioId}, fee: ${fee}, granularity: ${granularity || 'default'}`);

    // --- 1. Fetch ALL Relevant Trades ---
    const allTradesResult = await getPortfolioTrades(realId, undefined, {
      ...(till && isValidDateFormat(till) && { tradeTime: { $lte: `${till.split("T")[0]}T23:59:59` } }),
    });
    if ((allTradesResult as { error: string }).error) {
      return { error: (allTradesResult as { error: string }).error };
    }
    const allTrades = (allTradesResult as Trade[]).filter(t => t && t.tradeTime).sort((a, b) => moment.utc(a.tradeTime).diff(moment.utc(b.tradeTime)));
    console.log(`[portfolios.debug] Fetched trades:`, allTrades.map(t => ({ symbol: t.symbol, tradeType: t.tradeType, volume: t.volume, price: t.price, fee: t.fee, tradeTime: t.tradeTime, tradeRate: t.rate })));
    if (allTrades.length === 0) {
      return [];
    }

    // --- 2. Determine Date Range ---
    let startDateMoment: moment.Moment;
    const firstTradeDate = allTrades.length > 0 ? allTrades[0].tradeTime.split("T")[0] : null;
    if (from) {
      if (!isValidDateFormat(from)) return { error: "Wrong 'from' date format" };
      startDateMoment = moment.utc(from.split("T")[0], formatYMD);
      if (firstTradeDate && startDateMoment.isBefore(moment.utc(firstTradeDate, formatYMD))) {
          console.warn(`'from' date ${from} is before first trade date ${firstTradeDate}. Using first trade date as start.`);
          startDateMoment = moment.utc(firstTradeDate, formatYMD);
      }
    } else if (firstTradeDate) {
        startDateMoment = moment.utc(firstTradeDate, formatYMD);
    } else {
        return { error: "No start date or trades found to generate report."};
    }
    let endDateMoment: moment.Moment;
    if (till) {
      if (!isValidDateFormat(till)) return { error: "Wrong 'till' date format" };
      endDateMoment = moment.utc(till.split("T")[0], formatYMD);
    } else {
      endDateMoment = moment.utc();
    }
    if (startDateMoment.isAfter(endDateMoment)) {
        return { error: "'from' date cannot be after 'till' date" };
    }
    const startDateString = startDateMoment.format(formatYMD);
    const endDateString = endDateMoment.format(formatYMD);

    // --- 3. Fetch Price Data ---
    const { uniqueSymbols, uniqueCurrencies, withoutPrices } =
      await checkPortfolioPricesCurrencies(allTrades, portfolioInstance.currency);
    if (portfolioInstance.baseInstrument && !uniqueSymbols.includes(portfolioInstance.baseInstrument)) {
        uniqueSymbols.push(portfolioInstance.baseInstrument);
    }
    const priceCheckStartDate = startDateMoment.clone().subtract(30, 'days').format(formatYMD);
    try {
        await checkPrices(uniqueSymbols, priceCheckStartDate);
        for (const currency of uniqueCurrencies) {
            await checkPriceCurrency(currency, portfolioInstance.currency, priceCheckStartDate);
        }
        if (withoutPrices.length > 0) {
            await fillDateHistoryFromTrades(allTrades.filter(t => moment.utc(t.tradeTime).isSameOrAfter(moment.utc(priceCheckStartDate))), withoutPrices, endDateString);
        }
    } catch (priceError) {
        console.error("Error fetching price data:", priceError);
        return { error: `Failed to fetch essential price/rate data: ${priceError instanceof Error ? priceError.message : String(priceError)}` };
    }

    // --- 4. Initialize State Variables ---
    let currentCash = 0;
    let currentShares = 0;
    let currentHoldings: HoldingsMap = {};
    const reportRows: ReportRowType[] = [];
    let accResult = 0;
    let accRealizedPL = 0;

    // --- 5. Process Initial State (Trades Before Start Date) ---
    const tradesBeforeStart = allTrades.filter(trade => moment.utc(trade.tradeTime).isBefore(startDateMoment, 'day'));
    for (const trade of tradesBeforeStart) {
        const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
        if (marketFXRateOnDay == null) {
             console.warn(`Skipping pre-start trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
             continue;
        }
        let tradeValueUnadjusted: number;
        if (trade.tradeType === TradeTypes.Trade) {
            tradeValueUnadjusted = trade.price * trade.volume;
        } else {
            tradeValueUnadjusted = trade.price;
        }
        const feeInBase = trade.fee || 0;
        let realizedPLForAccResult = 0;
        let realizedPLForAccRealizedPL = 0;
        switch (trade.tradeType) {
            case TradeTypes.Trade: {
                const dir = trade.side === "B" ? 1 : -1;
                const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - feeInBase;
                currentCash += cashChange;
                const { symbol } = trade;
                if (!currentHoldings[symbol]) {
                    currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                }
                if (dir === 1) {
                    currentHoldings[symbol].volume += trade.volume;
                    currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + (tradeValueUnadjusted * trade.rate));
                    currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeValueUnadjusted);
                } else {
                  if (currentHoldings[symbol].volume > 0) {
                     const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                     const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);
                     realizedPLForAccResult = toNumFullPrecision(
                        (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - feeInBase
                     );
                     realizedPLForAccRealizedPL = realizedPLForAccResult;
                     currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                     currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                     currentHoldings[symbol].volume -= trade.volume;
                   } else {
                       realizedPLForAccResult = toNumFullPrecision(-feeInBase);
                       realizedPLForAccRealizedPL = realizedPLForAccResult;
                       currentHoldings[symbol].volume -= trade.volume;
                   }
                   accResult += realizedPLForAccResult;
                   accRealizedPL += realizedPLForAccRealizedPL;
                }
                break;
            }
            case TradeTypes.Cash:
            case TradeTypes.Dividends:
            case TradeTypes.Investment:
            case TradeTypes.Correction: {
                const tradeInvestedBaseCurrency = (tradeValueUnadjusted * trade.rate) + feeInBase;
                currentCash += tradeInvestedBaseCurrency;
                accResult += tradeInvestedBaseCurrency;
                if (trade.shares && trade.tradeType === TradeTypes.Investment) {
                    currentShares += trade.shares;
                }
                break;
            }
        }
    }
    Object.keys(currentHoldings).forEach(symbol => {
        if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
            delete currentHoldings[symbol];
        } else {
            if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
            if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
        }
    });
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
      while (loopMoment.isSameOrBefore(endDateMoment)) {
        const currentDayString = loopMoment.format(formatYMD);
        const dayOfWeek = loopMoment.isoWeekday();
        if (dayOfWeek === 6 || dayOfWeek === 7) {
            loopMoment.add(1, 'day');
            continue;
        }
        const todaysTrades = tradesByDate[currentDayString] || [];
        for (const trade of todaysTrades) {
            const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (marketFXRateOnDay == null) {
                console.warn(`Skipping trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }
            let tradeValueUnadjusted: number;
            if (trade.tradeType === TradeTypes.Trade) {
                tradeValueUnadjusted = trade.price * trade.volume;
            } else {
                tradeValueUnadjusted = trade.price;
            }
            let realizedPLForAccResult = 0;
            let realizedPLForAccRealizedPL = 0;
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - (trade.fee || 0);
                    currentCash += cashChange;
                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                    }
                    if (dir === 1) {
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + (tradeValueUnadjusted * trade.rate));
                        currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeValueUnadjusted);
                    } else {
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                            const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);
                            realizedPLForAccResult = toNumFullPrecision(
                                (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - ((trade.fee || 0))
                            );
                            realizedPLForAccRealizedPL = realizedPLForAccResult;
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                            currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else {
                            realizedPLForAccResult = toNumFullPrecision(-((trade.fee || 0)));
                            realizedPLForAccRealizedPL = realizedPLForAccResult;
                            currentHoldings[symbol].volume -= trade.volume;
                        }
                    }
                    accResult += realizedPLForAccResult;
                    accRealizedPL += realizedPLForAccRealizedPL;
                    break;
                }
                case TradeTypes.Cash:
                case TradeTypes.Dividends:
                case TradeTypes.Investment:
                case TradeTypes.Correction: {
                    let tradeInvestedBaseCurrency = (tradeValueUnadjusted * trade.rate) + (trade.fee || 0);
                    currentCash += tradeInvestedBaseCurrency;
                    accResult += tradeInvestedBaseCurrency;
                    if (trade.shares && trade.tradeType === TradeTypes.Investment) {
                        currentShares += trade.shares;
                    }
                    break;
                }
            }
        }
        Object.keys(currentHoldings).forEach(symbol => {
            if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
                delete currentHoldings[symbol];
            } else {
                 if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
                 if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
            }
        });
        let totalMarketValue = 0;
        let totalMarketValueBase = 0;
        let totalInvested = 0;
        let totalInvestedBase = 0;
        let unrealizedPL = 0;
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
              console.warn(`Could not get market price/rate for ${symbol} on ${currentDayString}. Will affect calculation.`);
          }
        }
        const currentNAV = currentCash + totalMarketValueBase;
        const usdToBaseRate = getRate('USD', portfolioInstance.currency, currentDayString);
        const navInUsd = usdToBaseRate > 0 ? currentNAV / usdToBaseRate : currentNAV;
        let accMarketValue = totalMarketValue;
        let accMarketValueBase = totalMarketValueBase;
        let accCash = currentCash;
        let accCashBase = currentCash;

        if (includeSummaries) {
            reportRows.push({
                Date: currentDayString,
                Type: "Portfolio Summary",
                Symbol: "",
                Volume: toNumLocal(Object.values(currentHoldings).reduce((sum, h) => toNumFullPrecision(sum + h.volume), 0)),
                "Original price": toNumLocal(Object.values(currentHoldings).reduce((sum, h) => sum + h.investedValueInTradeCurrency, 0) / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)),
                MarketPrice: toNumLocal(totalMarketValue / (Object.values(currentHoldings).reduce((sum, h) => sum + h.volume, 0) || 1)),
                "Original FX": toNumLocal(1),
                MarketFX: toNumLocal(1),
                Fee: toNumLocal(0),
                Invested: toNumLocal(totalInvested),
                InvestedBase: toNumLocal(totalInvestedBase),
                MarketValue: toNumLocal(totalMarketValue),
                BaseMarketValue: toNumLocal(totalMarketValueBase),
                Realized: toNumLocal(accRealizedPL),
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
                NAV: toNumLocal(navInUsd),
                NavBase: toNumLocal(currentNAV),
            });
        }
        for (const symbol in currentHoldings) {
            const holding = currentHoldings[symbol];
            const marketPrice = getDateSymbolPrice(currentDayString, symbol);
            const marketFX = getRate(holding.currency, portfolioInstance.currency, currentDayString);
            if (marketPrice != null && marketFX != null) {
                const holdingValue = marketPrice * holding.volume;
                const holdingValueBase = holdingValue * marketFX;
                const individualUnrealizedPL = toNumFullPrecision(holdingValueBase - holding.investedValue);
                reportRows.push({
                    Date: currentDayString,
                    Type: "Position Snapshot",
                    Symbol: symbol,
                    FX: holding.currency,
                    Volume: toNumLocal(holding.volume),
                    "Original price": toNumLocal(holding.volume > 0 ? holding.investedValueInTradeCurrency / holding.volume : 0),
                    MarketPrice: toNumLocal(marketPrice),
                    "Original FX": toNumLocal(holding.investedValueInTradeCurrency !== 0 ? holding.investedValue / holding.investedValueInTradeCurrency : 1),
                    MarketFX: toNumLocal(marketFX),
                    Fee: toNumLocal(0),
                    Invested: toNumLocal(holding.investedValueInTradeCurrency),
                    InvestedBase: toNumLocal(holding.investedValue),
                    MarketValue: toNumLocal(holdingValue),
                    BaseMarketValue: toNumLocal(holdingValueBase),
                    Realized: toNumLocal(0),
                    Result: toNumLocal(individualUnrealizedPL),
                    resultBase: toNumLocal(individualUnrealizedPL),
                    "Unrealized Result": toNumLocal(individualUnrealizedPL),
                    Cash: toNumLocal(currentCash),
                    CashBase: toNumLocal(currentCash),
                    "Acc. Result": toNumLocal(accResult),
                    AccMarketVvalue: toNumLocal(accMarketValue),
                    AccMarketValueBase: toNumLocal(accMarketValueBase),
                    AccCash: toNumLocal(accCash),
                    AccCashBase: toNumLocal(accCashBase),
                    NAV: toNumLocal(currentNAV),
                    NavBase: toNumLocal(currentNAV),
                });
            } else {
                console.warn(`Could not get market price/rate for ${symbol} on ${currentDayString} for position snapshot. Skipping.`);
            }
        }
        for (const trade of todaysTrades) {
            const typeDisplay = (trade.tradeType === TradeTypes.Trade) ? `Trade (${trade.side === TradeSide.Buy ? "Buy" : "Sell"})` :
                                (trade.tradeType === TradeTypes.Cash && trade.side === TradeSide.PUT) ? "Cash Deposit" :
                                (trade.tradeType === TradeTypes.Cash && trade.side === TradeSide.WITHDRAW) ? "Cash Withdrawal" :
                                trade.tradeType;
            const tradeRateForReport = trade.rate;
            const marketFXRateForReport = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            let realizedPLCurrentTrade = 0;
            let tradeResultForAcc = 0;
            let tradeRealizedPLForAcc = 0;
            if (trade.tradeType === TradeTypes.Trade) {
                const investedOriginal = trade.price * trade.volume;
                const investedBase = investedOriginal * trade.rate;
                if (trade.side === TradeSide.Buy) {
                    realizedPLCurrentTrade = 0;
                    tradeResultForAcc = -(investedBase + (trade.fee || 0));
                } else {
                    realizedPLCurrentTrade = toNumFullPrecision(accRealizedPL);
                    tradeResultForAcc = toNumFullPrecision(accResult);
                }
                tradeRealizedPLForAcc = realizedPLCurrentTrade;
            } else {
                 realizedPLCurrentTrade = 0;
                 tradeResultForAcc = toNumFullPrecision((trade.price * trade.rate) + ((trade.fee || 0)));
                 if (trade.side === TradeSide.WITHDRAW) tradeResultForAcc *= -1;
                 tradeRealizedPLForAcc = 0;
            }
            let displayInvested: number|undefined = undefined;
            let displayInvestedBase: number|undefined = undefined;
            if (trade.tradeType === TradeTypes.Trade && trade.side === TradeSide.Buy) {
                const investedOriginal = trade.price * trade.volume;
                const investedBase = investedOriginal * trade.rate;
                displayInvested = toNumLocal(investedOriginal);
                displayInvestedBase = toNumLocal(investedBase);
            }
            reportRows.push({
                Date: currentDayString,
                Type: typeDisplay,
                Symbol: trade.symbol || "",
                FX: trade.currency,
                Volume: toNumLocal(trade.volume),
                "Original price": toNumLocal(trade.price),
                MarketPrice: toNumLocal(getDateSymbolPrice(trade.tradeTime, trade.symbol || "") || trade.price),
                "Original FX": toNumLocal(tradeRateForReport),
                MarketFX: toNumLocal(marketFXRateForReport),
                Fee: toNumLocal(trade.fee),
                Invested: displayInvested,
                InvestedBase: displayInvestedBase,
                MarketValue: toNumLocal(0),
                BaseMarketValue: toNumLocal(0),
                Realized: toNumLocal(realizedPLCurrentTrade),
                Result: toNumLocal(tradeResultForAcc),
                resultBase: toNumLocal(tradeResultForAcc),
                "Unrealized Result": toNumLocal(0),
                Cash: toNumLocal(currentCash),
                CashBase: toNumLocal(currentCash),
                "Acc. Result": toNumLocal(accResult),
                AccMarketVvalue: toNumLocal(accMarketValue),
                AccMarketValueBase: toNumLocal(accMarketValueBase),
                AccCash: toNumLocal(accCash),
                AccCashBase: toNumLocal(accCashBase),
                NAV: toNumLocal(currentNAV),
                NavBase: toNumLocal(currentNAV),
            });
        }
        if (includeSummaries) {
            reportRows.push({
                Date: currentDayString,
                Type: "Daily Close",
                Symbol: "",
                Volume: toNumLocal(0),
                Cash: toNumLocal(currentCash),
                CashBase: toNumLocal(currentCash),
                "Acc. Result": toNumLocal(accResult + unrealizedPL),
                AccMarketVvalue: toNumLocal(accMarketValue),
                AccMarketValueBase: toNumLocal(accMarketValueBase),
                AccCash: toNumLocal(accCash),
                AccCashBase: toNumLocal(accCashBase),
                NAV: toNumLocal(currentNAV),
                NavBase: toNumLocal(currentNAV),
            });
        }
        loopMoment.add(1, 'day');
       }
    } else if (granularity === "trade") {
       for (const trade of allTrades) {
            const currentDayString = moment.utc(trade.tradeTime).format(formatYMD);
            const marketFXRateOnDay = getRate(trade.currency, portfolioInstance.currency, trade.tradeTime);
            if (marketFXRateOnDay == null) {
                console.warn(`Skipping trade due to missing market FX rate: ${trade.symbol || 'CashOp'} on ${trade.tradeTime}`);
                continue;
            }
            let tradeValueUnadjusted: number;
            if (trade.tradeType === TradeTypes.Trade) {
                tradeValueUnadjusted = trade.price * trade.volume;
            } else {
                tradeValueUnadjusted = trade.price;
            }
            let tradeInvestedOriginalCurrency = tradeValueUnadjusted;
            let tradeInvestedBaseCurrency = tradeValueUnadjusted * trade.rate;
            let realizedPLCurrentTrade = 0;
            let tradeResultForAcc = 0;
            let tradeRealizedPLForAcc = 0;
            let typeDisplay = "Trade";
            switch (trade.tradeType) {
                case TradeTypes.Trade: {
                    typeDisplay = `Trade (${trade.side === TradeSide.Buy ? "Buy" : "Sell"})`;
                    const dir = trade.side === "B" ? 1 : -1;
                    const cashChange = -dir * (tradeValueUnadjusted * trade.rate) - ((trade.fee || 0));
                    currentCash += cashChange;
                    const { symbol } = trade;
                    if (!currentHoldings[symbol]) {
                        currentHoldings[symbol] = { volume: 0, currency: trade.currency, investedValue: 0, investedValueInTradeCurrency: 0 };
                    }
                    if (dir === 1) {
                        currentHoldings[symbol].volume += trade.volume;
                        currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue + tradeInvestedBaseCurrency);
                        currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency + tradeInvestedOriginalCurrency);
                    } else {
                        if (currentHoldings[symbol].volume > 0) {
                            const avgCostPerShareBase = toNumFullPrecision(currentHoldings[symbol].investedValue / currentHoldings[symbol].volume);
                            const avgCostPerShareOriginalCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency / currentHoldings[symbol].volume);
                            realizedPLCurrentTrade = toNumFullPrecision(
                                (tradeValueUnadjusted * trade.rate) - (avgCostPerShareBase * trade.volume) - ((trade.fee || 0))
                            );
                            tradeRealizedPLForAcc = realizedPLCurrentTrade;
                            currentHoldings[symbol].investedValue = toNumFullPrecision(currentHoldings[symbol].investedValue - avgCostPerShareBase * trade.volume);
                            currentHoldings[symbol].investedValueInTradeCurrency = toNumFullPrecision(currentHoldings[symbol].investedValueInTradeCurrency - avgCostPerShareOriginalCurrency * trade.volume);
                            currentHoldings[symbol].volume -= trade.volume;
                        } else {
                            realizedPLCurrentTrade = toNumFullPrecision(-((trade.fee || 0)));
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
                    tradeResultForAcc = tradeInvestedBaseCurrency + (trade.fee || 0);
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
                case TradeTypes.Dividends:
                    typeDisplay = "Dividends";
                    tradeResultForAcc = tradeInvestedBaseCurrency + (trade.fee || 0);
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
                case TradeTypes.Investment:
                    typeDisplay = "Investment";
                    tradeResultForAcc = tradeInvestedBaseCurrency + (trade.fee || 0);
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                     if (trade.shares) currentShares += trade.shares;
                    break;
                case TradeTypes.Correction:
                    typeDisplay = "Correction";
                    tradeResultForAcc = tradeInvestedBaseCurrency + (trade.fee || 0);
                    currentCash += tradeResultForAcc;
                    accResult += tradeResultForAcc;
                    break;
            }
            Object.keys(currentHoldings).forEach(symbol => {
                if (toNumFullPrecision(currentHoldings[symbol].volume) === 0) {
                    delete currentHoldings[symbol];
                } else {
                    if (isNaN(currentHoldings[symbol].investedValue)) currentHoldings[symbol].investedValue = 0;
                    if (isNaN(currentHoldings[symbol].investedValueInTradeCurrency)) currentHoldings[symbol].investedValueInTradeCurrency = 0;
                }
            });
            let totalMarketValue = 0;
            let totalMarketValueBase = 0;
            let totalInvested = 0;
            let totalInvestedBase = 0;
            let unrealizedPL = 0;
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
            const usdToBaseRate = getRate('USD', portfolioInstance.currency, currentDayString);
            const navInUsd = usdToBaseRate > 0 ? currentNAV / usdToBaseRate : currentNAV;
            let accCash = currentCash;
            let accCashBase = currentCash;
            let displayInvestedTradegranularity: number|undefined = undefined;
            let displayInvestedBaseTradegranularity: number|undefined = undefined;
            if (trade.tradeType === TradeTypes.Trade && trade.side === TradeSide.Buy) {
                const investedOriginal = trade.price * trade.volume;
                const investedBase = investedOriginal * trade.rate;
                displayInvestedTradegranularity = toNumLocal(investedOriginal);
                displayInvestedBaseTradegranularity = toNumLocal(investedBase);
            }
            reportRows.push({
                Date: currentDayString,
                Type: typeDisplay,
                Symbol: trade.symbol || "",
                FX: trade.currency,
                Volume: toNumLocal(trade.volume),
                "Original price": toNumLocal(trade.price),
                MarketPrice: toNumLocal(getDateSymbolPrice(currentDayString, trade.symbol || "") || trade.price),
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
                NavBase: toNumLocal(currentNAV),
            });
        }
    } else {
      return { error: "Invalid granularity specified. Use 'day' or 'trade'." };
    }

    if (exportToCsv) {
        const processedData = reportRows.map(row => {
            const newRow: Record<string, any> = { ...row };
            for (const key in newRow) {
                if (typeof newRow[key] === 'number') {
                    newRow[key] = toNum({ n: newRow[key], precision: 4 });
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
                    number: (value: number) => value !== undefined && value !== null ? value.toFixed(4) : '',
                    date: (value: Date) => moment(value).isValid() ? moment(value).format('YYYY-MM-DD') : '',
                }
            }, (err, result) => {
                if (err) reject(err);
                resolve(result || '');
            });
        });
        const logsDirPath = `/home/lars/projects/ps2/server/logs/`;
        await fs.mkdir(logsDirPath, { recursive: true });
        const filePath = `${logsDirPath}/${fileName}`;
        await fs.writeFile(filePath, csvContent);
        return { filePath, fileName };
    } else {
        return reportRows;
    }
  } catch (err) {
    console.error("Critical error in portfolios.debug function:", err);
    return { error: `Failed to generate debug report: ${err instanceof Error ? err.message : String(err)}` };
  }
}