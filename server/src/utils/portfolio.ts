import { Trade, TradeOp } from "../types/trade";
import { TradeModel } from "../models/trade";
import { PortfolioModel } from "../models/portfolio";
import {
    checkPortfolioPricesCurrencies,
    getDateSymbolPrice,
    getRate,
    priceToBaseCurrency,
} from "../services/app/priceCashe";
import { Portfolio } from "../types/portfolio";

import moment, { Moment } from "moment";
import { formatYMD } from "../constants";
import {
    divideArray,
    extractUniqueFields,
    getModelInstanceByIDorName,
    isValidDateFormat,
    toNum,
} from "../utils";
import SSEService, {
    QuoteData,
    SSEServiceInst,
} from "../services/app/SSEService";
import eventEmitter, {sendEvent} from "../services/app/eventEmiter";
import { getCompanyField } from "../services/app/companies";
import { TradeFilter } from "@/services/trade";
type SubscribeObj = { handler: (o: object) => void; sseService: SSEService };
const subscribers: Record<string, SubscribeObj> = {};

type QuoteData2 = {
    symbol: string;
    currency: string;
    marketPrice: number;
    marketRate: number;
    marketValue: number;
    marketValueSymbol: number;
    marketClose: number;
    bprice: number;
    result: number;
    resultSymbol: number;
    avgPremium: number;
    todayResult: number;
    todayResultPercent: number;
};

type PortfolioPosition = {
    symbol: string;
    name: string;
    volume: number;
    rate: number;
    invested: number;
    currency: string;
    tradeTime: string;
    fee: number;
    investedFull: number;
    investedFullSymbol: number;
    weight: number;
};

type PortfolioPositionFull = PortfolioPosition & QuoteData2;

type QuoteChange = PortfolioPositionFull;
/*QuoteData2 & {
  name: string;
  volume: number;
  invested: number;
};*/

export const getCurrentPosition = async (_id:string) => {
    let rates: Record<string, number>;
    let fees: Record<string, number>;

    let portfolioPositions: Record<string, Partial<PortfolioPositionFull>>;

    const {
        _id: realId,
        error,
        instance: portfolio,
    } = await getModelInstanceByIDorName<Portfolio>(_id, PortfolioModel);
    if (error) {
        return error;
    }
    const allTrades = await TradeModel.find({
        portfolioId: realId,
        state: {$in: [1, 21]},
    })
        .sort({tradeTime: 1})
        .lean();
    const positions = await getPositions(allTrades, portfolio);

    return positions;
    //console.log("portfolioPositions", portfolioPositions);
}




async function getPositions(allTrades: Trade[], portfolio: Portfolio) {
    const { startDate, endDate, uniqueSymbols, uniqueCurrencies } =
        await checkPortfolioPricesCurrencies(allTrades, portfolio.currency);
    console.log("P", startDate, uniqueSymbols, uniqueCurrencies);

    let cash = 0;
    const fees: Record<string, number> = {};
    const symbolFullInvestedSymbol: Record<string, number> = {};
    const symbolFullInvested: Record<string, number> = {};
    const appendFee = (symbol: string, fee: number): number => {
        if (!fees[symbol]) {
            fees[symbol] = fee;
        } else {
            fees[symbol] += fee;
        }
        return fee;
    };

    let oldPortfolio: Record<string, Partial<Trade>> = {};
    for (const trade of allTrades) {
        const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
        switch (trade.tradeType) {
            case "1":
                const { symbol } = trade;
                const dir = trade.side === "B" ? -1 : 1;
                const priceN = toNum(trade.price);

                const cashChange =
                    dir * priceN * trade.rate * trade.volume -
                    appendFee(symbol, trade.fee * trade.rate);
                cash += cashChange;
                const o = oldPortfolio[symbol] || {};
                const newVolume: number = o.volume
                    ? o.volume - dir * trade.volume
                    : -dir * trade.volume;

                oldPortfolio[symbol] = {
                    symbol,
                    volume: newVolume,
                    price: trade.price,
                    rate: trade.rate,
                    currency: trade.currency,
                    fee: trade.fee,
                    invested: newVolume * trade.price * trade.rate, //invwstedSymbol
                    tradeTime: trade.tradeTime,
                };
                const vs = -trade.price * trade.volume * dir;
                const v = vs * trade.rate;
                symbolFullInvested[symbol] = symbolFullInvested[symbol]
                    ? symbolFullInvested[symbol] + v
                    : v;
                symbolFullInvestedSymbol[symbol] = symbolFullInvestedSymbol[symbol]
                    ? symbolFullInvestedSymbol[symbol] + vs
                    : vs;
                break;
            case "31":
            case "20":
                const cashPut = trade.price * trade.rate;
                cash += cashPut;
            /*
              cash +=
                priceToBaseCurrency(
                  trade.price,
                  trade.tradeTime,
                  trade.currency,
                  portfolio.currency,
                ) || 0;*/
        }
    }
    let currentDay = endDate.split("T")[0];
    const nowDay = moment().format(formatYMD); //!!!!!!!!!!!!!!!!!!!!!!!!
    const actualKeys = Object.keys(oldPortfolio).filter(
        (s) => oldPortfolio[s].volume !== 0,
    );
    console.log("OOOO", currentDay, nowDay, actualKeys);
    const positions: Record<string, Partial<Trade>> = actualKeys.reduce(
        (p, s) => ({ ...p, [s]: oldPortfolio[s] }),
        {},
    );

    const tradedSymbols = Object.keys(positions).filter(
        (s) => positions[s].tradeTime?.split("T")[0] === currentDay,
    );
    // console.log("tradedSymbols", tradedSymbols, "positions", positions);
    let invested = 0;
    const curentPositions = tradedSymbols.map((s) => positions[s]);
    //if (currentDay <= nowDay) {

    if (curentPositions.length < Object.keys(positions).length) {
        let { inv, notTradeChanges } = addNotTradesItems(
            currentDay,
            portfolio.currency,
            tradedSymbols,
            positions,
        );
        //invested += inv;
        // console.log("notTradeChanges", notTradeChanges);
        curentPositions.push(...Object.values(notTradeChanges));
    }
    for (const p of curentPositions) {
        const symbol = p.symbol as string;
        p.name = await getCompanyField(symbol);
        (p as PortfolioPosition).investedFull = symbolFullInvested[symbol];
        (p as PortfolioPosition).investedFullSymbol =
            symbolFullInvestedSymbol[symbol];
        invested += Number(p.invested);
    }

    return {
        date: nowDay,
        invested,
        cash,
        nav: cash + invested,
        positions: curentPositions as PortfolioPosition[],
        fees,
    };
}

/*
  symbol: string;
  currency: string;
  marketPrice: number;
  marketRate: number;
  marketValue: number;
  marketClose: number;
  bprice: number;
*/

function addNotTradesItems(
    currentDay: string,
    portfolioCurrency: string,
    tradedSymbols: String[],
    oldPortfolio: Record<string, Partial<Trade>>,
) {
    let inv = 0;
    const changes: object[] = [];
    if (tradedSymbols.length < Object.keys(oldPortfolio).length) {
        inv = Object.keys(oldPortfolio)
            .filter((k) => !tradedSymbols.includes(k))
            .reduce((sum, symbol) => {
                const pi = oldPortfolio[symbol] as Trade;
                const price = toNum(getDateSymbolPrice(currentDay, symbol) as number);
                const rate = getRate(pi.currency, portfolioCurrency, currentDay);
                if (!price || !rate) {
                    throw `No price=${price}|rate=${rate} ${symbol} ${currentDay}`;
                    return 0;
                }
                const invested = rate * pi.volume * price; //investedSymbol
                changes.push({
                    currentDay,
                    symbol,
                    currency: pi.currency,
                    price,
                    rate,
                    volume: pi.volume,
                    invested, //InvwstedSymbol
                    fee: pi.fee,
                });

                return sum + invested;
            }, 0);
    }

    return { inv, notTradeChanges: changes };
}

function getMarketPrice(
    q: QuoteData,
    marketPrice?: string,
): number | undefined {
    console.log("marketPrice", marketPrice, q.iexBidPrice, q.iexAskPrice);
    switch (marketPrice) {
        case "0":
            return q.iexBidPrice;
        case "1":
            return q.iexAskPrice;
        case "2":
            return q.latestPrice;
        //case 3: return 'open'
        case "4":
            return q.close;
        case "5":
            return q.high;
        case "6":
            return q.low;
        case "7":
            if (
                q.iexBidPrice &&
                q.iexAskPrice &&
                q.iexBidPrice > 0 &&
                q.iexAskPrice > 0
            ) {
                console.log(q.iexBidPrice, q.iexAskPrice, typeof q.iexBidPrice);
                return 0.5 * (q.iexBidPrice + q.iexAskPrice);
            }
            if (q.iexBidPrice && q.iexBidPrice > 0) {
                return q.iexBidPrice;
            }
            if (q.iexAskPrice && q.iexAskPrice > 0) {
                return q.iexAskPrice;
            }
            return q.close;
        default:
            return q.close;
    }
}

function getBasePrice(q: QuoteData, basePrice?: string): number | undefined {
    switch (basePrice) {
        case "0":
            return q.iexBidPrice;
        case "1":
            return q.iexAskPrice;
        case "2":
            return q.latestPrice;
        //case 3: return 'open'
        case "4":
            return q.close;
        case "5":
            return q.high;
        case "6":
            return q.low;
        case "7":
            if (
                q.iexBidPrice &&
                q.iexAskPrice &&
                q.iexBidPrice > 0 &&
                q.iexAskPrice > 0
            ) {
                return 0.5 * (q.iexBidPrice + q.iexAskPrice);
            }
            if (q.iexBidPrice && q.iexBidPrice > 0) {
                return q.iexBidPrice;
            }
            if (q.iexAskPrice && q.iexAskPrice > 0) {
                return q.iexAskPrice;
            }
            return q.close;
        default:
            return q.close;
    }
}
