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
  getModelInstanceByIDorName, isCurrency,
  isValidDateFormat,
  toNum,
} from "../../utils";
import SSEService, {
  QuoteData,
  SSEServiceInst,
} from "../../services/app/SSEService";
import eventEmitter, { sendEvent } from "../../services/app/eventEmiter";
import { getCompanyField } from "../../services/app/companies";
import { TradeFilter } from "@/services/trade";
import { summationFlatPortfolios } from "../../services/portfolio/helper";
import {actualizeTrades, getPortfolioTrades} from "../../utils/portfolio";
import { SubscribeMsgs } from "../../types/other";
//type SubscribeObj = { handler: (o: object) => void; sseService: SSEService };
//type SubscribeMsgs = Record<string, SubscribeObj>
const subscribers: Record<string, SubscribeMsgs> = {}; //userModif-> SubscribeMsgs

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
  avgPremiumSymbol: number;
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
  feeSymbol: number;
  investedFull: number;
  investedFullSymbol: number;
  weight: number;
  realized: number;
};

type PortfolioPositionFull = PortfolioPosition & QuoteData2 &{
  total?: number;
  totalSymbol?: number
};

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
  changes?: Partial<QuoteData[]>;
  eventName?: string;
  closed?: string;
};

export type RealizedData = {
  realized: number;
  totalCost: number;
};
let sseServiceNumber = 0;

export async function positions(
  {
    _id,
    requestType,
    subscribeId,
    marketPrice = "4",
    basePrice = "4",
    closed = 'no',
    changes,
    eventName: SSEEventName,
  }: Params,
  sendResponse: (data?: object) => void,
  msgId: string,
  userModif: string,
): Promise<{} | undefined> {
  if (requestType === "77") {
    Object.values(subscribers[userModif]).forEach((subscriber) => {
      console.log("stop", subscriber.sseService.getEventName());
      subscriber.sseService.stop();
      eventEmitter.removeListener(
        subscriber.sseService.getEventName(),
        subscriber.handler,
      );
    });
    return { msg: "Stop all positions" };
  }
  if (!_id) {
    return { error: "Portolio _id is required" };
  }
  if (requestType === "3") {
    let err;
    if (!SSEEventName) {
      err = "eventName is required for emulation mode\n";
    }
    if (!changes) {
      err = `${err}changes is required for emulation mode`;
    }
    if (err) {
      return { error: err };
    }
  }
  if (!subscribers[userModif]) {
    subscribers[userModif] = {};
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
  console.log(
    `====================requestType=${requestType}=================`,
  );

  if (requestType === "3") {
    if (changes && SSEEventName) {
      setTimeout(() => {
        console.log(
          moment().format("HH:mm:ss SSS"),
          "emulate sendEvent ---------------->",
          SSEEventName,
          changes,
        );
        sendEvent(SSEEventName, changes);
      }, 50);
    }
    console.log(
      moment().format("HH:mm:ss SSS"),
      "emulator send respomse",
      SSEEventName,
    );
    return { emulated: true, eventName: SSEEventName, changes };
  }

  sseServiceNumber++;
  const eventName = `SSE_QUOTES_${sseServiceNumber}`;

  let rates: Record<string, number>;
  let fees: Record<string, { fee: number; feeSym: number }>;

  let portfolioPositions: Record<string, Partial<PortfolioPositionFull>>;
  let currencyInvested: Record<
    string,
    { invested: number; investedSymbol: number, fee:number, feeSymbol:number }
  > = {};

  let currr;
  let isFirst: boolean = true;
  let totalRealized = 0;
  const subscriberOnTrades = async (ev: TradeOp) => {
    console.log("subscriberOnTrades get event==========", ev);
    const allTrades = await TradeModel.find({
      portfolioId: realId,
      state: { $in: [1, 21] },
    })
      .sort({ tradeTime: 1 })
      .lean();
    console.log("allTrades.length", allTrades.length);
    if (allTrades.length === 0) {
      return;
    }

    const positions = await getPositions(allTrades, portfolio, closed);
    currencyInvested = positions.currencyInvested;
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
    subscribers[userModif][msgId].sseService.start(symbols, true);
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
    if (subscribers[userModif][subscribeId]) {
      subscribers[userModif][subscribeId].sseService.stop();
      eventEmitter.removeListener(
        subscribers[userModif][subscribeId].sseService.getEventName(),
        subscribers[userModif][subscribeId].handler,
      );
      eventEmitter.removeListener("trade.change", subscriberOnTrades);
      return {
        msg: `portfolio.positions unsubscribed from portfolio '${portfolio.name}'`,
      };
    } else {
      return { error: `subscribeId=${subscribeId} is unknown` };
    }
  }
  /*
  let portfolioFilter={}
  if (portfolio.portfolioType=== 'summation') {
   // const {portfolioRateMap,portfolioFilterItems, flatPortfolios:sumPortfolios} =
   //     await processSumation(portfolio)
    const portfolioFilterItems = await summationFlatPortfolios(portfolio);
    portfolioFilter = {portfolioId:{$in: portfolioFilterItems}}
    console.log('>>>>>>>> portfolioFilter=', portfolioFilter);// 'portfolioRateMap', portfolioRateMap);
  } else {
    portfolioFilter = {portfolioId: realId}
  }
  const allTrades = await TradeModel.find({
    ...portfolioFilter,
    state: { $in: [1, 21] },
  })
    .sort({ tradeTime: 1 })
    .lean();
*/
  const allTrades = await getPortfolioTrades(realId, undefined, {
    state: { $in: [1, 21] },
  });
  if ((allTrades as { error: string }).error) {
    return allTrades as { error: string };
  }
  const trades = allTrades as Trade[];
  console.log("allTrades.length", trades.length);
  if (trades.length === 0) {
    return;
  }
  const positions = await getPositions(trades, portfolio, closed);
  currencyInvested = positions.currencyInvested;

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
  totalRealized = positions.realized;
  portfolioPositions = positions.positions.reduce(
    (o, p) => ({ ...o, [p.symbol as string]: p }),
    {} as Record<string, Partial<PortfolioPositionFull>>,
  );
  //console.log("portfolioPositions", portfolioPositions);
  isFirst = true;

  const processQuoteData = (data: QuoteData[]) => {
    const [currencyData, symbolData] = divideArray(
      data,
      (q: QuoteData) => !positions.uniqueSymbols.includes(q.symbol),
    );
    if (requestType === "0") {
      console.log("stop!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      subscribers[userModif][msgId].sseService.stop();
      eventEmitter.removeListener(
        subscribers[userModif][msgId].sseService.getEventName(),
        subscribers[userModif][msgId].handler,
      );
    }
    console.log("isFirst--------------------->", isFirst);
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
      console.log('symbol', symbol, Object.keys(portfolioPositions));
      let change = {} as QuoteChange;
      const cur = portfolioPositions[symbol].currency as string;
      const volume = Number(portfolioPositions[symbol].volume);
      const invested = Number(portfolioPositions[symbol].invested);
      const investedFull = Number(portfolioPositions[symbol].investedFull);
      const investedFullSymbol = Number(
        portfolioPositions[symbol].investedFullSymbol,
      );
      if (isFirst) {
        console.log(
            symbol,
          "volume,investedFull, fees",
          volume,
          investedFull,
          fees[symbol].fee,
        );

        portfolioPositions[symbol] = {
          ...portfolioPositions[symbol],
          marketRate: rates[cur],
          marketValue: rates[cur] * marketPrice * volume,
          marketValueSymbol: marketPrice * volume,
          //  avgPremium: volume !== 0 ? (invested + (portfolioPositions[symbol].fee || 0) ) / volume : 0,
          avgPremium:
            volume !== 0 ? (investedFull + fees[symbol].fee) / volume : 0,
          avgPremiumSymbol:
            volume !== 0
              ? (investedFullSymbol + fees[symbol].feeSym) / volume
              : 0,
          ...p,
          fee: fees[symbol].fee,
          feeSymbol: fees[symbol].feeSym,
        };

        change = portfolioPositions[symbol] as QuoteChange;
        change.result =
          (change.marketValue ||
            Number(portfolioPositions[symbol].marketValue)) -
          Number(portfolioPositions[symbol].investedFull) -
          fees[symbol].fee;
        change.resultSymbol =
          (change.marketValueSymbol ||
            Number(portfolioPositions[symbol].marketValueSymbol)) -
          Number(portfolioPositions[symbol].investedFullSymbol) -
          fees[symbol].feeSym;
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
            (rates[cur] || change.marketRate) *
            (change.marketPrice ||
              Number(portfolioPositions[symbol].marketPrice)) *
            Number(portfolioPositions[symbol].volume);

          change.result =
            (change.marketValue ||
              Number(portfolioPositions[symbol].marketValue)) -
            Number(portfolioPositions[symbol].investedFull) -
            fees[symbol].fee;
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
    return changes
  };

  const calcChanges = (data: object) => {
    let changes = processQuoteData(data as QuoteData[]);
    console.log("changes ==>", changes);
    if (changes.length === 0) {
      return undefined;
    }
    console.log('$#$ portfolioPositions', portfolioPositions)
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
    /*const realized = Object.keys(portfolioPositions).reduce(
        (sum, symbol) => sum + Number(portfolioPositions[symbol].realized),
        0,
    );*/
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

    switch (closed) {
      case 'no':
        changes = changes.filter(c=> portfolioPositions[c.symbol].volume !==0);
        break;
      case 'only':
        changes = changes.filter(c=> portfolioPositions[c.symbol].volume ===0);
        break;
      default:
        break;
    }


    Object.keys(currencyInvested).forEach((symbol) => {
      changes.push({
        symbol: `TOTAL_${symbol}`,
        investedFull: toNum({n:currencyInvested[symbol].invested}),
        investedFullSymbol: toNum({n:currencyInvested[symbol].investedSymbol}),
        fee: toNum({n:currencyInvested[symbol].fee}),
        feeSymbol: toNum({n:currencyInvested[symbol].feeSymbol}),
        total:toNum({n:currencyInvested[symbol].invested-currencyInvested[symbol].fee}),
        totalSymbol:toNum({n:currencyInvested[symbol].investedSymbol-currencyInvested[symbol].feeSymbol}),
      } as PortfolioPositionFull);
    });
    changes.push({
      symbol: "TOTAL",
      marketValue:toNum({n:marketValue}),
      result:toNum({n:result}),
      todayResult:toNum({n:todayResult}),
      realized: toNum({n:totalRealized}),
    } as PortfolioPositionFull);

    return changes;

  };

  //--
  subscribers[userModif][msgId] = {
    sseService,
    handler: (data: object) => {
      console.log("handler event");
      const changes = calcChanges(data);
      console.log(
        moment().format("HH:mm:ss SSS"),
        "subscriber SSE-> ",
        userModif,
        msgId,
        data,
        "===>",
        changes,
      );
      changes?.length && sendResponse(changes);
    },
  };

  eventEmitter.on(eventName, subscribers[userModif][msgId].handler);
  //const { positions , fees,...rest } = positions;
  return { msg: requestType === "1" ? "subscribed" : "snapshot", eventName };
}

async function getPositions(allTrades0: Trade[], portfolio: Portfolio, closed:string) {
  console.log('getPositions....');
  const allTrades = actualizeTrades(allTrades0);
  const { startDate, endDate, uniqueSymbols, uniqueCurrencies } =
    await checkPortfolioPricesCurrencies(allTrades, portfolio.currency);
  console.log("positions.467", startDate, uniqueSymbols, uniqueCurrencies);
  let currencyInvested: Record<
    string,
    { invested: number; investedSymbol: number, fee:number, feeSymbol:number }
  > = {};
  let cash = 0;
  const fees: Record<string, { fee: number; feeSym: number }> = {};
  const symbolFullInvestedSymbol: Record<string, number> = {};
  const symbolFullInvested: Record<string, number> = {};
  const symbolRealized: Record<string, RealizedData> = {};
  const symbolFullCash: Record<string, number> = {};
  const symbolFullCashSymbol: Record<string, number> = {};

  let oldPortfolio: Record<string, Partial<Trade>> = {};
  console.log(
      `tradeTime, symbol, side, price,volume, rate, volumeOld,volumeNew,avgPrice, realizedPnL,realized,totalCost`);

  for (const trade of allTrades) {
    const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
    switch (trade.tradeType) {
      case "1":
        const { symbol } = trade;
        const dir = trade.side === "B" ? -1 : 1;
        const priceN = toNum({ n: trade.price });
        const fs = trade.fee;
        const f = fs * trade.rate;
        if (!fees[symbol]) fees[symbol] = { fee: 0, feeSym: 0 };

        fees[symbol].fee += f;
        fees[symbol].feeSym += fs;
        const cashChange = dir * priceN * trade.rate * trade.volume - f;
        const cashChangeSymbol = dir * priceN * trade.volume - fs;
        cash += cashChange;
        symbolFullCash[symbol] = symbolFullCash[symbol]
          ? symbolFullCash[symbol] + cashChange
          : cashChange;
        symbolFullCashSymbol[symbol] = symbolFullCashSymbol[symbol]
          ? symbolFullCashSymbol[symbol] + cashChangeSymbol
          : cashChangeSymbol;
        const o = oldPortfolio[symbol] || {};
        const newVolume: number = o.volume
          ? o.volume - dir * trade.volume
          : -dir * trade.volume;

        oldPortfolio[symbol] = {
          symbol,
          volume: newVolume,
          price: trade.price,
          //?   rate: trade.rate,
          currency: trade.currency,
          //?  fee: trade.fee,
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

        if (!currencyInvested[trade.currency]) {
          currencyInvested[trade.currency] = { invested: 0, investedSymbol: 0, fee:0 , feeSymbol:0 };
        }
        currencyInvested[trade.currency].invested -= v;
        currencyInvested[trade.currency].investedSymbol -= vs;
        currencyInvested[trade.currency].fee += f;
        currencyInvested[trade.currency].feeSymbol += fs;
        //if (dir > 0) {
        /*const close = toNum({
            n: getDateSymbolPrice(trade.tradeTime, trade.symbol) as number,
          });
          const rateClose = getRate(
            trade.currency,
            portfolio.currency,
            trade.tradeTime,
          );
          const v = toNum({ n: close * rateClose * trade.volume });*/
        const vi = toNum({ n: trade.price * trade.rate * trade.volume });
        if (!symbolRealized[symbol]) {
          symbolRealized[symbol] = { totalCost: 0, realized: 0 };
        }
        let avgPrice = 0;
        let realizedPnL = 0;
        if (trade.side === "B") {
          symbolRealized[symbol].totalCost += vi;
        } else {
          avgPrice = o.volume ? symbolRealized[symbol].totalCost / o.volume : 0;
          realizedPnL = (trade.price * trade.rate - avgPrice) * trade.volume;
          symbolRealized[symbol].realized += realizedPnL;
          symbolRealized[symbol].totalCost -= avgPrice * trade.volume;
        }
        //console.log('RRRRRRRRRRR', trade.tradeTime, symbol, symbolRealized[symbol], '|', trade.side, o.volume, newVolume, '|',trade.volume, trade.price);
        console.log(
          `${trade.tradeTime}, ${symbol},  ${trade.side}, ${trade.price},${trade.volume}, ${trade.rate}, ${o.volume || 0},${newVolume},${avgPrice.toFixed(4)}, ${realizedPnL.toFixed(4)},${symbolRealized[symbol].realized.toFixed(4)},${symbolRealized[symbol].totalCost.toFixed(4)}`,
        );
        //}
        break;
      case "31":
      case "20":
        const cashPut = trade.price * trade.rate;
        cash += cashPut;
        if (!currencyInvested[trade.currency]) {
          currencyInvested[trade.currency] = { invested: 0, investedSymbol: 0, fee:0 , feeSymbol:0 };
        }
        currencyInvested[trade.currency].invested += cashPut;
        currencyInvested[trade.currency].investedSymbol += trade.price;

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
  const allSymbols = Object.keys(oldPortfolio);
  console.log('oldPortfolio', oldPortfolio);
  const actualSymbols = allSymbols.filter((s) => {
    switch (closed) {
      case 'no':
        return true;//oldPortfolio[s].volume !== 0;
      case 'only':
        return true;//oldPortfolio[s].volume === 0;
      default:
        return true;
    }
  });

  console.log("positions.OOOO", currentDay, nowDay, actualSymbols);
  const positions: Record<string, Partial<Trade>> = actualSymbols.reduce(
    (p, s) => ({ ...p, /*positionType:1,*/ [s]: oldPortfolio[s] }),
    {},
  );

  const tradedSymbols = Object.keys(positions).filter(
    (s) => positions[s].tradeTime?.split("T")[0] === nowDay, //currentDay,
  );
  // console.log("tradedSymbols", tradedSymbols, "positions", positions);
  let invested = 0;
  const curentPositions = tradedSymbols.map((s) => positions[s]);
  console.log("symbolRealized", symbolRealized, 'traded.length:', curentPositions.length, 'positions.length',Object.keys(positions).length);
  if (curentPositions.length < Object.keys(positions).length) {
    let { inv, notTradeChanges } = addNotTradesItems(
      nowDay,
      portfolio.currency,
      tradedSymbols,
      positions,
    );
    //invested += inv;
    console.log("notTradeChanges", notTradeChanges);
    curentPositions.push(...Object.values(notTradeChanges));
  }
  let realized = allSymbols.reduce(
    (sum, symbol) => sum + symbolRealized[symbol].realized,
    0,
  );
  for (const p of curentPositions) {
    const symbol = p.symbol as string;
    console.log(`getCompanyField(${symbol})`);
    p.name = await getCompanyField(symbol);
    console.log(`/getCompanyField(${symbol})`);

    (p as PortfolioPosition).investedFull = symbolFullInvested[symbol];
    (p as PortfolioPosition).investedFullSymbol =
      symbolFullInvestedSymbol[symbol];
    invested += Number(p.invested);
    (p as PortfolioPosition).realized = symbolRealized[symbol].realized;
  }
  const currencyTotals = Object.keys(currencyInvested).map((cur) => ({
    currency: cur,
    invested: currencyInvested[cur].invested,
    currencyInvestedSymbol: currencyInvested[cur].investedSymbol,
  }));
  console.log('getPositiins.curentPositions ', curentPositions )


  return {
    date: nowDay,
    invested,
    cash,
    nav: cash + invested,
    positions: curentPositions as PortfolioPosition[],
    fees,
    realized,
    currencyInvested,
    uniqueSymbols
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

  data.forEach(d=> {
    if (!d.currency && isCurrency(d.symbol) ) {
      d.currency =d.symbol.substring(3,6)
    }
  })
  const qData2 = data.map((q) => {
    const { symbol, currency, volume, close, country } = q;
    console.log('qData2', q)
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
  console.log('qt',symbol,  qt)
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
        let n = getDateSymbolPrice(currentDay, symbol);
        if (!n && isCurrency(symbol)) {
           n = getRate(symbol.substring(0,3), symbol.substring(3,6),  currentDay)
        }
        const price = toNum({  n : n as number})

        const rate = getRate(pi.currency, portfolioCurrency, currentDay);
        if (!price || !rate) {
          throw `No price(rate)=${price}|rate=${rate} ${symbol} ${currentDay}`;
          //return 0;
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
          realized: 0,
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

/*
async function processSumation(portfolio:Portfolio)  {
  const portfolioRateMap={} as Record<string, string[]>
  let sumPortfolios: Portfolio[] =[] //flat portfolios im all sum
  const portfolioFilterItems: string[]=[];

  console.log('processSumation.portfolio', portfolio);
  const rateMap = async (portfolio:Portfolio,rates:string[]=[]) => {

    console.log('rateMap() portfolioType:',portfolio.portfolioType, portfolio.portfolioIds);
    if (portfolio.portfolioType==='summation'  && portfolio.portfolioIds) {
      for (let pid of portfolio.portfolioIds){
        console.log('pid ', pid);
        const {
          _id: childId,
          error,
          instance,
        } = await getModelInstanceByIDorName<Portfolio>(pid, PortfolioModel);
        if (error) {
          return {error: "Error processing child portfolio"};
        }
        sumPortfolios.push(instance);
        if (instance.portfolioType!=='summation'){
          portfolioFilterItems.push(childId)

        }
         if (instance) {
          await rateMap(instance, instance.currency==portfolio.currency ? rates : [...rates,`${instance.currency}${portfolio.currency}`])
        }
      }
    } else {
      portfolioRateMap[portfolio.name]= rates;
      console.log(portfolio.name, ':',rates);
    }
  }

  await  rateMap(portfolio,[])
  console.log('SUMMATION PROCESS',portfolioRateMap,portfolioFilterItems, sumPortfolios);
  return {portfolioRateMap,portfolioFilterItems, flatPortfolios:sumPortfolios};
}
*/

/*

symbolRealized {
  FDIS: [
    [ 94, 7231.420000000001 ],
    [ 45, 3424.49991 ],
    [ 185, 14287.550555 ],
    [ 552, 42255.601656 ]
  ],
  XLC: [
    [ 59, 4354.789882 ],
    [ 6, 442.85998799999993 ],
    [ 127, 9503.410253999999 ],
    [ 71, 5409.490142000001 ]
  ],
  AMJ: [
    [ 25, 644.5000249999999 ],
    [ 286, 7278.700286 ],
    [ 7, 185.919993 ],
    [ 60, 1602.59994 ]
  ],
  IYC: [ [ 18, 1369.619928 ] ]


totalQuantity = trades.reduce((total, trade) => total + trade.quantity, 0);

// Step 2: Separate buy and sell trades to calculate average cost and realized value
const buyTrades = trades.filter(trade => trade.type === 'Buy');
const sellTrades = trades.filter(trade => trade.type === 'Sell');

// Calculate average cost and realized value for buy and sell trades separately
const averageCostBuy = buyTrades.reduce((total, trade) => total + trade.quantity * trade.price, 0)
/ buyTrades.reduce((total, trade) => total + trade.quantity, 0);
const realizedValueBuy = buyTrades.reduce((total, trade) => total + trade.quantity * (trade.price - sellTrades[sellTrades.length - 1].price), 0);
const averageCostSell = sellTrades.reduce((total, trade) => total + trade.quantity * trade.price, 0) / sellTrades.reduce((total, trade) => total + trade.quantity, 0);
const realizedValueSell = sellTrades.reduce((total, trade) => total + trade.quantity * (sellTrades[sellTrades.length - 1].price - trade.price), 0);

// Step 3: Calculate the total cost, realized value, and average cost
totalCost = totalQuantity * averageCostBuy;
totalRealized = totalCost + realizedValueSell - realizedValueBuy;

console.log({ totalCost, totalRealized, averageCostBuy, averageCostSell });

In thi
 */
