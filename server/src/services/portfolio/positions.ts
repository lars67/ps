import { Trade, TradeOp } from "../../types/trade";
import { TradeModel } from "../../models/trade";
import { PortfolioModel } from "../../models/portfolio";
import {
  checkPortfolioPricesCurrencies,
  getDateSymbolPrice,
  getRate,
  priceToBaseCurrency,
} from "../../services/app/priceCashe";
import { Portfolio } from "../../types/portfolio";

import moment, { Moment } from "moment";
import { formatYMD } from "../../constants";
import {
  divideArray,
  extractUniqueFields,
  getModelInstanceByIDorName,
  isValidDateFormat,
  toNum,
} from "../../utils";
import SSEService, {
  QuoteData,
  SSEServiceInst,
} from "../../services/app/SSEService";
import eventEmitter, {sendEvent} from "../../services/app/eventEmiter";
import { getCompanyField } from "../../services/app/companies";
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

type Params = {
  _id: string;
  requestType: string;
  subscribeId?: string;
  basePrice?: string;
  marketPrice?: string;
  changes?:Partial<QuoteData[]>,
  eventName?: string
};

let sseServiceNumber = 0;

export async function positions(
  { _id, requestType, subscribeId, marketPrice = "4", basePrice = "4" , changes, eventName:SSEEventName}: Params,
  sendResponse: (data?: object) => void,
  msgId: string,
): Promise<{} | undefined> {
  if (requestType === "77") {
    Object.values(subscribers).forEach(subscriber => {
      subscriber.sseService.stop();
      eventEmitter.removeListener(
          subscriber.sseService.getEventName(),
          subscriber.handler
      );
    })
    return {msg:'Stop all positions'};
  }
  if (!_id) {
    return { error: "Portolio _id is required" };
  }
  if (requestType === "3") {
    let err;
    if (!SSEEventName) {
      err="eventName is required for emulation mode\n";
    }
    if (!changes) {
      err=`${err}changes is required for emulation mode`
    }
    if (err) {
      return {error: err};
    }
  }
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getModelInstanceByIDorName<Portfolio>(_id, PortfolioModel);
  if (error) {
    return error;
  }
  if (!portfolio) {
    return { error: `Portfolio with _id=${realId} is not exists` };
  }
console.log(`====================requestType=${requestType}=================`);


  if (requestType === "3") {
    if (changes && SSEEventName) {
      setTimeout(()=> {
        console.log(moment().format('HH:mm:ss SSS'),'emulate sendEvent ---------------->',SSEEventName, changes)
        sendEvent(SSEEventName, changes);
      }, 50);
    }
    console.log(moment().format('HH:mm:ss SSS'),'emulator send respomse', SSEEventName)
    return {emulated: true, eventName:SSEEventName, changes};
  }

  sseServiceNumber++;
  const eventName = `SSE_QUOTES_${sseServiceNumber}`;

  let rates: Record<string, number>;
  let fees: Record<string, number>;

  let portfolioPositions: Record<string, Partial<PortfolioPositionFull>>;
  let isFirst: boolean = true;

  const subscriberOnTrades = async (ev: TradeOp) => {
    console.log("subscriberOnTrades get event==========", ev);
    const allTrades = await TradeModel.find({
      portfolioId: realId,
      state: { $in: [1, 21] },
    })
      .sort({ tradeTime: 1 })
      .lean();
    const positions = await getPositions(allTrades, portfolio);

    const symbols = [
      ...positions.positions.map((p) => p.symbol),
      ...extractUniqueFields(positions.positions, "currency")
        .map(
          (c: string) =>
            c !== portfolio.currency && `${c}${portfolio.currency}:FX`,
        )
        .filter(Boolean),
    ].join(",");
    console.log("resubscribe if need ");
    subscribers[msgId].sseService.start(symbols,true);
    rates = { [portfolio.currency]: 1.0 } as Record<string, number>;
    fees = positions.fees;

    portfolioPositions = positions.positions.reduce(
      (o, p) => ({ ...o, [p.symbol as string]: p }),
      {} as Record<string, Partial<PortfolioPositionFull>>,
    );
    console.log("portfolioPositions", portfolioPositions);
    isFirst = true;
    console.log("/subscriberOnTrades get event==========");
    //
  };
  /////

  if (requestType === "2") {
    if (!subscribeId) {
      return { error: "subscribeId is required  in unsubscrube command" };
    }
    if (subscribers[subscribeId]) {
      subscribers[subscribeId].sseService.stop();
      eventEmitter.removeListener(
        subscribers[subscribeId].sseService.getEventName(),
        subscribers[subscribeId].handler,
      );
      eventEmitter.removeListener("trade.change", subscriberOnTrades);
      return {
        msg: `portfolio.positions unsubscribed from portfolio '${portfolio.name}'`,
      };
    } else {
      return { error: `subscribeId=${subscribeId} is unknown` };
    }
  }


  const allTrades = await TradeModel.find({
    portfolioId: realId,
    state: { $in: [1, 21] },
  })
    .sort({ tradeTime: 1 })
    .lean();
  const positions = await getPositions(allTrades, portfolio);

  const symbols = [
    ...positions.positions.map((p) => p.symbol),
    ...extractUniqueFields(positions.positions, "currency")
      .filter((c) => c !== portfolio.currency)
      .map((c: string) => `${c}${portfolio.currency}:FX`),
  ].join(",");
  eventEmitter.on("trade.change", subscriberOnTrades);
  const sseService = new SSEService("quotes", symbols, eventName);
  //--

  rates = { [portfolio.currency]: 1.0 } as Record<string, number>;
  fees = positions.fees;

  portfolioPositions = positions.positions.reduce(
    (o, p) => ({ ...o, [p.symbol as string]: p }),
    {} as Record<string, Partial<PortfolioPositionFull>>,
  );
  //console.log("portfolioPositions", portfolioPositions);
  isFirst = true;

  const processQuoteData = (data: QuoteData[]) => {
    const [currencyData, symbolData] = divideArray(
      data,
      (q: QuoteData) => q.symbol.indexOf(":FX") > 0,
    );
    if (requestType === "0") {
      console.log("stop");
      subscribers[msgId].sseService.stop();
      eventEmitter.removeListener(
        subscribers[msgId].sseService.getEventName(),
        subscribers[msgId].handler,
      );
    }
    console.log('isFirst--------------------->', isFirst);
    const q2Rates = prepareQuoteData2(
      currencyData,
      marketPrice,
      basePrice,
    ).filter(Boolean);
    console.log("isFirst", isFirst, "currencyData", q2Rates);

    const newRates = {} as Record<string, number>;
    q2Rates.forEach((r) => {
      const cur = (r as { symbol: string }).symbol.substring(0, 3);
      const newRate = (r as QuoteData2).marketPrice;
     // console.log((r as { symbol: string }).symbol, cur, newRate, rates[cur]);
      if (!rates[cur] && newRate) {
        newRates[cur] = newRate;
        rates[cur] = newRate;
      } else if (newRate !== rates[cur]) {
        newRates[cur] = newRate;
        rates[cur] = newRate;
      }
    });
   // console.log("rates", rates, "newRates", newRates, "fees", fees);

    const q2Symbols = prepareQuoteData2(
      symbolData,
      marketPrice,
      basePrice,
    ).filter(Boolean);
    console.log("isFirst", isFirst, "q2Symbols", q2Symbols);

    const changes: QuoteChange[] = [];
    q2Symbols.forEach((p) => {
      const { symbol, marketPrice, marketClose } = p as QuoteData2;
      let change = {} as QuoteChange;
      const cur = portfolioPositions[symbol].currency as string;
      const volume = Number(portfolioPositions[symbol].volume);
      const invested = Number(portfolioPositions[symbol].invested);
      const investedFull = Number(portfolioPositions[symbol].investedFull);
      if (isFirst) {
        portfolioPositions[symbol] = {
          ...portfolioPositions[symbol],
          marketRate: rates[cur],
          marketValue: rates[cur] * marketPrice * volume,
          marketValueSymbol: marketPrice * volume,
          //  avgPremium: volume !== 0 ? (invested + (portfolioPositions[symbol].fee || 0) ) / volume : 0,
          avgPremium: volume !== 0 ? (investedFull + fees[symbol]) / volume : 0,

          ...p,
        };

        change = portfolioPositions[symbol] as QuoteChange;
        change.result =
          (change.marketValue ||
            Number(portfolioPositions[symbol].marketValue)) -
          Number(portfolioPositions[symbol].investedFull) -
          fees[symbol];
        change.resultSymbol =
          (change.marketValueSymbol ||
            Number(portfolioPositions[symbol].marketValueSymbol)) -
          Number(portfolioPositions[symbol].investedFullSymbol) -
          fees[symbol];
        const mPrice = Number(
          p?.marketPrice || portfolioPositions[symbol].marketPrice,
        );
        const cPrice = Number(
          p?.marketClose || portfolioPositions[symbol].marketClose,
        );
        change.todayResult = (cPrice - mPrice) * volume * rates[cur];
        change.todayResultPercent =
          Math.round((10000 * (cPrice - mPrice)) / mPrice) / 100;
      } else {
        if (newRates[cur]) {
          portfolioPositions[symbol].marketRate = rates[cur];
          change.marketRate = rates[cur];
        }
        ["marketClose", "marketPrice", "bprice"].forEach((fld) => {
          const field = fld as keyof QuoteChange;

          console.log(
            `compare ${symbol} ${field} => ${portfolioPositions[symbol][field]} ${(p as QuoteChange)[field]}`,
          );
          // @ts-ignore
          if (p[field] && portfolioPositions[symbol][field] !== p[field]) {
            // @ts-ignore
            change[field] = p[field];
            // @ts-ignore
            portfolioPositions[symbol][field] = p[field as string];
          }
        });
        console.log("change by fields ", change, rates[cur], fees[symbol]);
        if (change.marketRate || change.marketPrice) {
          change.marketValue =
            rates[cur] *
            (change.marketPrice ||
              Number(portfolioPositions[symbol].marketPrice)) *
            Number(portfolioPositions[symbol].volume);

          change.result =
            (change.marketValue ||
              Number(portfolioPositions[symbol].marketValue)) -
            Number(portfolioPositions[symbol].investedFull) -
            fees[symbol];
          const mPrice = Number(
            p?.marketPrice || portfolioPositions[symbol].marketPrice,
          );
          const cPrice = Number(
            p?.marketClose || portfolioPositions[symbol].marketClose,
          );
          change.todayResult = (cPrice - mPrice) * volume * rates[cur];
          change.todayResultPercent =
            Math.round((10000 * (cPrice - mPrice)) / mPrice) / 100;



          portfolioPositions[symbol].marketValue = change.marketValue;
          portfolioPositions[symbol].todayResult = change.todayResult;
          portfolioPositions[symbol].todayResultPercent =
            change.todayResultPercent;
          portfolioPositions[symbol].result = change.result;
        }
      }
      if (Object.keys(change).length > 0) {
        // @ts-ignore
        changes.push({ symbol, ...change });
      }
    });

    isFirst = false;
    return changes;
  };

  const calcChanges = (data: object) => {
    const changes = processQuoteData(data as QuoteData[]);
    console.log("changes ==>", changes);
    if (changes.length === 0) {
      return undefined;
    }
    const marketValue = Object.keys(portfolioPositions).reduce(
      (sum, symbol) => sum + Number(portfolioPositions[symbol].marketValue),
      0,
    );
    const result = Object.keys(portfolioPositions).reduce(
      (sum, symbol) => sum + Number(portfolioPositions[symbol].result),
      0,
    );
    const todayResult = Object.keys(portfolioPositions).reduce(
      (sum, symbol) => sum + Number(portfolioPositions[symbol].todayResult),
      0,
    );
    //weights add to porfolioPositions
    Object.keys(portfolioPositions).forEach((symbol) => {
      let change = changes.find((c) => c.symbol === symbol);
      if (!change) {
        change = { symbol } as PortfolioPositionFull;
        changes.push(change);
      }
      change.weight =
        Math.round(
          (10000 * Number(portfolioPositions[symbol].marketValue)) /
            marketValue,
        ) / 100;
    });
    changes.push({
      symbol: "TOTAL",
      marketValue,
      result,
      todayResult,
    } as PortfolioPositionFull);

    return changes;
  };

  //--
  subscribers[msgId] = {
    sseService,
    handler: (data: object) => {
      console.log('handler event');
      const changes  = calcChanges(data);
      console.log(moment().format('HH:mm:ss SSS'),"subscriber SSE-> ",msgId,  data, '===>', changes);
      changes?.length && sendResponse(changes);
    },
  };

  eventEmitter.on(eventName, subscribers[msgId].handler);
  //const { positions , fees,...rest } = positions;
  return { msg: requestType === "1" ? "subscribed" : "snapshot", eventName };
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
let ipr = 0;
function prepareQuoteData2(
  data: QuoteData[],
  marketPriceModel: string,
  basePrice: string,
) {
  const qData2 = data.map((q) => {
    const { symbol, currency, volume, close, country } = q;
    //console.log('q', q)
    if (symbol) {
      const qt: Partial<QuoteData2> = {};
      const marketPrice = getMarketPrice(q, marketPriceModel) || close;
      const bprice = getBasePrice(q, basePrice);
      if (bprice) qt.bprice = bprice;
      if (close) {
        qt.marketClose = close;
      }
      /*console.log(
        symbol,
        marketPriceModel,
        marketPrice,
        q.iexAskPrice,
        q.iexBidPrice,
        q.low,
        q.high,
        q.close,
      );*/

      if (marketPrice) qt.marketPrice = marketPrice;
      //    else if ((/*symbol === "AMJ" ||*/ symbol.indexOf(':FX') >0 )&& ++ipr % 3 === 0) {
      //      qt.marketPrice = Math.round(100 * Math.random()) / 100;
      //    }
      return Object.keys(qt).length > 0 ? { symbol, ...qt } : undefined;
    }
  });
  return qData2;
}

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
