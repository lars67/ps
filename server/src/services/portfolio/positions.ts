import { Trade, TradeOp } from "../../types/trade";
import { TradeModel } from "../../models/trade";
import { PortfolioModel } from "../../models/portfolio";

import { Portfolio } from "../../types/portfolio";

import moment, { Moment } from "moment";
import { errorMsgs, formatYMD } from "../../constants";
import {
  divideArray,
  extractUniqueFields,
  findMaxByField,
  getModelInstanceByIDorName,
  isCurrency,
  isValidDateFormat,
  toNum,
} from "../../utils";
import SSEService, { QuoteData } from "../../services/app/SSEService";
import { monitorSSEConnection } from "../../monitoring";
import eventEmitter, { sendEvent } from "../../services/app/eventEmiter";
import {
  getCompanyField,
  getGICS,
  getSymbolCountry,
  getSymbolsCountries,
} from "../../services/app/companies";
import { actualizeTrades, getPortfolioTrades } from "../../utils/portfolio";
import { SubscribeMsgs } from "../../types/other";
import { WebSocket } from "ws";
import { UserData, UserWebSocket } from "../../services/websocket";
import {
  getCountries,
  getCountryField,
  getCountryFields,
  getSubRegions,
} from "../../services/app/countries";
import {
  checkAccessByRole,
  getPortfolioInstanceByIDorName,
  mapKeyToName,
} from "../../services/portfolio/helper";
import logger from "../../utils/logger";
import { isGBXQuoted } from "../../services/app/companies";
import profiler from "../../utils/profiler";
const subscribers: Record<string, SubscribeMsgs> = {}; //userModif-> SubscribeMsgs

// Track previous subscription count for debugging
let prevSubscriptionCount = 0;

function logSubscriptionCount(context: string) {
  let totalCount = 0;
  for (const userModif in subscribers) {
    totalCount += Object.keys(subscribers[userModif]).length;
  }
  if (totalCount !== prevSubscriptionCount) {
    console.log(`\n[SUBSCRIPTION DEBUG] ${context}: Active subscriptions: ${totalCount} (was: ${prevSubscriptionCount})`);
    prevSubscriptionCount = totalCount;
  }
}

// Cleanup all subscriptions for a user when their socket disconnects
export function cleanupUserSubscriptions(userModif: string) {
  if (!subscribers[userModif]) {
    return;
  }

  console.log(`[SUBSCRIPTION DEBUG] Cleaning up subscriptions for user: ${userModif}`);

  Object.keys(subscribers[userModif]).forEach((subscribeId) => {
    const sub = subscribers[userModif][subscribeId];
    sub.sseService.stop();
    eventEmitter.removeListener(sub.sseService.getEventName(), sub.registeredHandler);
    if (sub.tradeHandler) {
      eventEmitter.removeListener("trade.change", sub.tradeHandler);
    }

    // Clear subscription data to help GC free memory
    if (sub.data) {
      sub.data.portfolioPositions = {} as any;
      sub.data.rates = {};
      sub.data.fees = {} as any;
      sub.data.cashes = {};
      sub.data.currencyInvested = {};
      sub.data.regionInvested = {};
      sub.data.subRegionInvested = {};
      sub.data.countryInvested = {};
      sub.data.sectorInvested = {};
      sub.data.industryInvested = {};
      sub.data.portfoliosInvested = {};
    }
  });

  delete subscribers[userModif];
  logSubscriptionCount('socket_disconnect');

  // Hint to garbage collector that we've freed memory
  if ((global as any).gc) {
    setImmediate(() => (global as any).gc());
  }
}

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
  name: string;
  a2: string;
  country: string;
  region: string;
  subRegion: string;
  sector: string;
  industry: string;
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
  country: string;
  a2: string;
  region: string;
  subRegion: string;
  sector: string;
  industry: string;
};

type PortfolioPositionFull = PortfolioPosition &
  QuoteData2 & {
    total?: number;
    totalSymbol?: number;
    totalType?: string;
   };
type PortfolioCurrencyCash = {
  total: number;
  symbol: string;
  rate?: number;
  totalLocal?:number;

};

type CommonPortfolioPosition = PortfolioPositionFull | PortfolioCurrencyCash;

export type QuoteChange = PortfolioPositionFull;
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
  includeAttribution?: boolean;
  totalsMode?: string;
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
    marketPrice = "2",
    basePrice = "4",
    closed = "no",
    changes,
    eventName: SSEEventName,
    includeAttribution = false,
    totalsMode = "all",
  }: Params,
  sendResponse: (data?: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
  socket: WebSocket,
): Promise<{} | undefined> {
  profiler.startTimer("positions.main", userModif, msgId, { 
    requestType, 
    portfolioId: _id,
    includeAttribution,
    totalsMode,
    closed 
  });
  
  const startTime = Date.now();
  logger.log(`POSITIONS CALL ${userModif}|${msgId} `);
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
  // Unsubscribe does not need _id — handle before validation
  if (requestType === "2") {
    if (!subscribeId) {
      return { error: "subscribeId is required in unsubscribe command" };
    }
    if (!subscribers[userModif]) {
      return { error: `subscribeId=${subscribeId} is unknown` };
    }
    logger.log(`[SSEService.stop ${userModif}|${subscribeId} ${subscribers[userModif][subscribeId] ? 'defined' : 'undefined'}]`);
    if (subscribers[userModif][subscribeId]) {
      const sub = subscribers[userModif][subscribeId];
      sub.sseService.stop();
      eventEmitter.removeListener(sub.sseService.getEventName(), sub.registeredHandler);
      if (sub.tradeHandler) {
        eventEmitter.removeListener("trade.change", sub.tradeHandler);
      }

      // Clear subscription data to help GC free memory
      if (sub.data) {
        sub.data.portfolioPositions = {} as any;
        sub.data.rates = {};
        sub.data.fees = {} as any;
        sub.data.cashes = {};
        sub.data.currencyInvested = {};
        sub.data.regionInvested = {};
        sub.data.subRegionInvested = {};
        sub.data.countryInvested = {};
        sub.data.sectorInvested = {};
        sub.data.industryInvested = {};
        sub.data.portfoliosInvested = {};
      }

      delete subscribers[userModif][subscribeId];
      logSubscriptionCount('unsubscribe');

      // Hint to garbage collector after cleanup
      if ((global as any).gc && Object.keys(subscribers[userModif]).length === 0) {
        setImmediate(() => (global as any).gc());
      }

      return { msg: `portfolio.positions unsubscribed` };
    } else {
      return { error: `subscribeId=${subscribeId} is unknown` };
    }
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
  profiler.logPoint("positions.main", userModif, msgId, "get_portfolio_start");
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getPortfolioInstanceByIDorName(_id, userData);
  profiler.logPoint("positions.main", userModif, msgId, "get_portfolio_end", { portfolioId: realId });
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

  // Portfolio data stored per-subscription to avoid closure capture
  // This object will be attached to the subscription and freed when subscription is deleted
  const portfolioData = {
    rates: {} as Record<string, number>,
    fees: {} as Record<string, { fee: number; feeSym: number }>,
    cashes: {} as Record<string, number>,
    portfolioPositions: {} as Record<string, Partial<PortfolioPositionFull>>,
    currencyInvested: {} as Record<string, any>,
    regionInvested: {} as Record<string, any>,
    subRegionInvested: {} as Record<string, any>,
    countryInvested: {} as Record<string, any>,
    sectorInvested: {} as Record<string, any>,
    industryInvested: {} as Record<string, any>,
    portfoliosInvested: {} as Record<string, any>,
    isFirst: true,
    investedPortfolio: 0,
    totalRealized: 0,
  };

  // Local references for calculations - these reference the shared data object
  let rates = portfolioData.rates;
  let fees = portfolioData.fees;
  let cashes = portfolioData.cashes;
  let portfolioPositions = portfolioData.portfolioPositions;
  let currencyInvested = portfolioData.currencyInvested;
  let regionInvested = portfolioData.regionInvested;
  let subRegionInvested = portfolioData.subRegionInvested;
  let countryInvested = portfolioData.countryInvested;
  let sectorInvested = portfolioData.sectorInvested;
  let industryInvested = portfolioData.industryInvested;
  let portfoliosInvested = portfolioData.portfoliosInvested;
  let currr;
  let isFirst: boolean = portfolioData.isFirst;
  let investedPortfolio = portfolioData.investedPortfolio;
  let totalRealized = portfolioData.totalRealized;

  const subscriberOnTrades = async (ev: TradeOp) => {
    // Check if subscription still exists (socket may have disconnected)
    if (!subscribers[userModif] || !subscribers[userModif][msgId]) {
      console.log("subscriberOnTrades: subscription no longer exists, cleaning up");
      return;
    }

    console.log("subscriberOnTrades get event==========", ev,msgId, realId, portfolio);
    const allTrades = await TradeModel.find({
      portfolioId: realId,
      state: { $in: [1] },
    })
      .sort({ tradeTime: 1 })
      .lean();
    console.log("allTrades.length", allTrades.length);
    if (allTrades.length === 0) {
      return;
    }

    const positions = await getPositions(allTrades, portfolio, closed);
    currencyInvested = positions.currencyInvested;
    regionInvested = positions.regionInvested;
    subRegionInvested = positions.subRegionInvested;
    countryInvested = positions.countryInvested;
    sectorInvested = positions.sectorInvested;
    industryInvested = positions.industryInvested;
    portfoliosInvested = positions.portfoliosInvested;
    cashes = positions.cashes;
    //    console.log('cashes', cashes)
    const symbols = [
      ...positions.positions.map((p) => p.symbol),
      ...extractUniqueFields(positions.positions, "currency")
        .map(
          (c: string) =>
            c !== portfolio.currency && `${c}${portfolio.currency}:FX`,
        )
        .filter(Boolean),
    ];
    positions.uniqueCurrencies
      .filter((u) => u !== portfolio.currency)
      .forEach((u) => {
        const r = `${portfolio.currency}${u}:FX`;
        if (!symbols.includes(r)) {
          symbols.push(r);
        }
      });
    console.log("resubscribe if need ", symbols);

    // Re-check subscription exists before accessing
    if (!subscribers[userModif] || !subscribers[userModif][msgId]) {
      return;
    }

    subscribers[userModif][msgId].sseService.start(symbols.join(","), true);
    logger.log(`[SSEService.start ${userModif}|${msgId}] ${symbols.join(",")} ${subscribers[userModif][msgId].sseService.getEventName()}`)
    rates = { [portfolio.currency]: 1.0 } as Record<string, number>;
    fees = positions.fees;

    portfolioPositions = positions.positions.reduce(
      (o, p) => ({ ...o, [p.symbol as string]: p }),
      {} as Record<string, Partial<PortfolioPositionFull>>,
    );
    // console.log("portfolioPositions", portfolioPositions);
    isFirst = true;
    //
  };
  /////


  profiler.startTimer("positions.fetch_trades", userModif, msgId, { portfolioId: realId });
  const allTrades = await getPortfolioTrades(realId, undefined, {
    state: { $in: [1] },
  });
  if ((allTrades as { error: string }).error) {
    profiler.endTimer("positions.fetch_trades", userModif, msgId, { error: true });
    return allTrades as { error: string };
  }
  const trades = allTrades as Trade[];
  profiler.endTimer("positions.fetch_trades", userModif, msgId, { tradesCount: trades.length });
  
  if (trades.length === 0) {
    profiler.endTimer("positions.main", userModif, msgId, { result: "empty" });
    return [];
  }
  
  profiler.startTimer("positions.calculate_positions", userModif, msgId, { tradesCount: trades.length });
  const positions = await getPositions(trades, portfolio, closed);
  profiler.endTimer("positions.calculate_positions", userModif, msgId, { 
    positionsCount: positions.positions.length,
    uniqueSymbols: positions.uniqueSymbols.length,
    uniqueCurrencies: positions.uniqueCurrencies.length
  });
  currencyInvested = positions.currencyInvested;
  regionInvested = positions.regionInvested;
  subRegionInvested = positions.subRegionInvested;
  countryInvested = positions.countryInvested;
  sectorInvested = positions.sectorInvested;
  industryInvested = positions.industryInvested;
  portfoliosInvested = positions.portfoliosInvested;
  cashes = positions.cashes;

  const symbols = [
    ...positions.positions.map((p) => p.symbol),
    ...extractUniqueFields(
      trades.filter((t) => t.tradeType === "1" && t.symbol?.endsWith(":FX")),
      "symbol",
    ),
    ...extractUniqueFields(positions.positions, "currency")
      .filter((c) => c !== portfolio.currency)
      .map((c: string) => `${c}${portfolio.currency}:FX`),
  ];
  positions.uniqueCurrencies
    .filter((u) => u !== portfolio.currency)
    .forEach((u) => {
      const r = `${portfolio.currency}${u}:FX`;
      if (!symbols.includes(r)) {
        symbols.push(r);
      }
    });

  // Cleanup any existing subscription for this msgId to prevent duplicate handlers
  if (subscribers[userModif][msgId]) {
    const existing = subscribers[userModif][msgId];
    existing.sseService.stop();
    eventEmitter.removeListener(existing.sseService.getEventName(), existing.registeredHandler);
    if (existing.tradeHandler) {
      eventEmitter.removeListener("trade.change", existing.tradeHandler);
    }
    delete subscribers[userModif][msgId];
    console.log(`Cleaned up stale subscription for ${userModif}|${msgId}`);
  }

  eventEmitter.on("trade.change", subscriberOnTrades);
  const sseService = new SSEService("quotes", symbols.join(","), eventName);
  monitorSSEConnection(sseService);
  logger.log(`[new SSEService. ${userModif}|${msgId} ] ${symbols.join(",")}, ${eventName}`)


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
      //    (q: QuoteData) => !positions.uniqueSymbols.includes(q.symbol),
      (q: QuoteData) => isCurrency(q.symbol),
    );
    // Reduced verbose logging for quote processing
    logger.log(`[QUOTE_PROCESSING] Processing ${data.length} quotes: ${currencyData.length} FX, ${symbolData.length} symbols`);
    
    positions.uniqueCurrencies.forEach(cur=> {
      if (cur === portfolio.currency) {
        rates[cur] = 1
      } else {
        let fxData = data.find(d => d.symbol === `${cur}${portfolio.currency}:FX`);
        let inv = false;
        if (!fxData) {
          fxData = data.find(d => d.symbol === `${portfolio.currency}${cur}:FX`);
          inv = true;
        }
        const fxPrice = fxData ? (fxData.latestPrice ?? fxData.close) : undefined;
        rates[cur] = fxPrice != null ? (inv ? 1.0 / fxPrice : fxPrice) : 1;
        // Only log significant rate changes or errors
        if (!fxData) {
          logger.error(`[FX_RATE] Missing FX data for ${cur} vs ${portfolio.currency}`);
        }
      }
    });
    if (requestType === "0") {
      console.log("stop!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", rates);
      logger.log(`[SSEService.stop for requestType=0 ${userModif}|${msgId} ${subscribers[userModif]?.[msgId]? 'defined' : 'undefined'}]`)

      if (subscribers[userModif]?.[msgId]) {
        subscribers[userModif][msgId].sseService.stop();
        eventEmitter.removeListener(
          subscribers[userModif][msgId].sseService.getEventName(),
          subscribers[userModif][msgId].handler,
        );
      }
    }
    //console.log("isFirst--------------------->", isFirst);
    const q2Rates = prepareQuoteData2(
      currencyData,
      marketPrice,
      basePrice,
    ).filter(Boolean);
    //  console.log( "q2Rates$$#", q2Rates, 'rates', rates, currencyData);

    const newRates = {} as Record<string, number>;
    q2Rates.forEach((r) => {
      let cur = (r as { symbol: string }).symbol.substring(0, 3);
      const cur2 = (r as { symbol: string }).symbol.substring(3, 6);
      let  newRate = (r as QuoteData2).marketPrice;
      let haveRate = true;
      if (cur === portfolio.currency) {
        newRate = 1/newRate
        cur = cur2
      } else if (cur2 !== portfolio.currency) {
        haveRate =false;
      }
      if (haveRate) {
        if (!rates[cur] && newRate) {
          newRates[cur] = newRate;
          rates[cur] = newRate;
        } else if (newRate && newRate !== rates[cur]) {
          newRates[cur] = newRate;
          rates[cur] = newRate;
        }
      }
    });

    const q2Symbols = prepareQuoteData2(
      symbolData.filter((d) => !isCurrency(d.symbol)),
      marketPrice,
      basePrice,
      isFirst,
    ).filter(Boolean);

    const changes: CommonPortfolioPosition[] = [];

    // If this is the first processing and we have no quote data, enrich positions with default market data
    if (isFirst && q2Symbols.length === 0) {
      Object.keys(portfolioPositions).forEach((symbol) => {
        const pos = portfolioPositions[symbol];
        if (pos && !pos.marketValue) { // Only enrich if not already enriched
          const cur = pos.currency as string;
          const volume = Number(pos.volume);
          const invested = Number(pos.invested);
          const investedFull = Number(pos.investedFull);
          const investedFullSymbol = Number(pos.investedFullSymbol);

          // Use default market price of 0 if no quote data available
          const marketPrice = 0;
          const bprice = 0;

          console.log(
            symbol,
            "volume,investedFull, fees (no quotes)",
            volume,
            investedFull,
            fees[symbol].fee,
          );
          investedPortfolio += investedFull;
          portfolioPositions[symbol] = {
            ...portfolioPositions[symbol],
            marketRate: rates[cur] || 1,
            marketValue: (rates[cur] || 1) * marketPrice * volume,
            marketValueSymbol: marketPrice * volume,
            avgPremium: volume !== 0 ? (investedFull + fees[symbol].fee) / volume : 0,
            avgPremiumSymbol: volume !== 0 ? (investedFullSymbol + fees[symbol].feeSym) / volume : 0,
            marketPrice,
            marketClose: 0, // Default close price when no quote data available
            bprice,
            fee: fees[symbol].fee,
            feeSymbol: fees[symbol].feeSym,
          };

          const change = portfolioPositions[symbol] as QuoteChange;
          change.resultSymbol = ((change.marketValueSymbol || 0) - Number(pos.investedFullSymbol) - fees[symbol].feeSym);
          change.result = change.resultSymbol * (rates[cur] || 1);
          change.todayResult = 0; // No quote data, so no today result
          change.todayResultPercent = 0;

          changes.push(change);
        }
      });
    }

    q2Symbols.forEach((p) => {
      const { symbol, marketPrice, marketClose } = p as QuoteData2;
      let change = {} as QuoteChange;
      if (!portfolioPositions[symbol]) {
        logger.warn(`Skipping quote data for symbol ${symbol} not in current portfolio positions (likely old data after position changes)`);
        return;
      }
      const cur = portfolioPositions[symbol].currency as string;
      const volume = Number(portfolioPositions[symbol].volume);
      const invested = Number(portfolioPositions[symbol].invested);
      const investedFull = Number(portfolioPositions[symbol].investedFull);
      const investedFullSymbol = Number(
        portfolioPositions[symbol].investedFullSymbol,
      );
      // Treat as first-time initialization if marketValue was never set
      // (can happen when a symbol's first quote arrives after the initial isFirst pass)
      const isFirstForSymbol = isFirst || portfolioPositions[symbol].marketValue === undefined;
      if (isFirstForSymbol) {
        console.log(
          symbol,
          "volume,investedFull, fees",
          volume,
          investedFull,
          fees[symbol].fee,
        );
        investedPortfolio += investedFull;
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
        /*change.result =
          (change.marketValue ||
            Number(portfolioPositions[symbol].marketValue)) -
          Number(portfolioPositions[symbol].investedFull) -
          fees[symbol].fee;*/

        change.resultSymbol =
          (change.marketValueSymbol ||
            Number(portfolioPositions[symbol].marketValueSymbol)) -
          Number(portfolioPositions[symbol].investedFullSymbol) -
          fees[symbol].feeSym;
        change.result = change.resultSymbol * rates[cur];
        //         console.log(symbol, cur, rates[cur], change.resultSymbol, change.result);
        const mPrice = Number(
          p?.marketPrice || portfolioPositions[symbol].marketPrice,
        );
        let cPrice = Number(
          p?.bprice || portfolioPositions[symbol].bprice,
        );
        if (cur === 'GBX') cPrice /= 100;
        change.todayResult = (mPrice - cPrice) * volume * rates[cur];
        change.todayResultPercent =
          Math.round((10000 * (mPrice - cPrice)) / cPrice) / 100;
      } else {
        if (newRates[cur]) {
          portfolioPositions[symbol].marketRate = rates[cur];
          change.marketRate = rates[cur];
        }
        ["marketClose", "marketPrice", "bprice"].forEach((fld) => {
          const field = fld as keyof QuoteChange;

          //  console.log(
          //   `compare ${symbol} ${field} => ${portfolioPositions[symbol][field]} ${(p as QuoteChange)[field]}`,
          //  );
          // @ts-ignore
          if (p[field] && portfolioPositions[symbol][field] !== p[field]) {
            // @ts-ignore
            change[field] = p[field];
            // @ts-ignore
            portfolioPositions[symbol][field] = p[field as string];
          }
        });
        if (change.marketRate || change.marketPrice) {
          change.marketValue =
            (change.marketRate || rates[cur]) *
            (change.marketPrice ||
              Number(portfolioPositions[symbol].marketPrice)) *
            Number(portfolioPositions[symbol].volume);
          console.log(
            "change.marketValue=",
            change.marketValue,
            cur,
            rates[cur],
            portfolioPositions[symbol],
          );

          change.result =
            (change.marketValue ||
              Number(portfolioPositions[symbol].marketValue)) -
            Number(portfolioPositions[symbol].investedFull) -
            fees[symbol].fee;
          const mPrice = Number(
            p?.marketPrice || portfolioPositions[symbol].marketPrice,
          );
          let cPrice = Number(
            p?.bprice || portfolioPositions[symbol].bprice,
          );
          if (cur === 'GBX') cPrice /= 100;
          change.todayResult = (mPrice - cPrice) * volume * rates[cur];
          change.todayResultPercent =
            Math.round((10000 * (mPrice - cPrice)) / cPrice) / 100;

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
    if (isFirst) {
      Object.keys(cashes).forEach((key) => {
        const c: CommonPortfolioPosition = {
          symbol: `CASH_${key}`,
          total:cashes[key]*rates[key],
          rate: rates[key],
          totalLocal: cashes[key] as number,
        };
        changes.push(c);
      });
      console.log("positions.dividends=", positions.dividends);
      Object.keys(positions.dividends).forEach((key) => {
        const symbol = key;
        const cur = portfolioPositions[symbol]?.currency || portfolio.currency;
        const rate = rates[cur] || 1;
        const c: CommonPortfolioPosition = {
          symbol: `DIVIDENDS_${key}`,
          total: toNum({ n: positions.dividends[key] * rate }),
        };
        changes.push(c);
      });
    }
    isFirst = false;
    return changes;
  };

  const calcChanges = (data: object, includeAttribution: boolean = false, totalsMode: string = "all", isInitialSnapshot: boolean = false) => {
    let neutral_trading = 0;
    let neutral_passive = 0;
    let changes = processQuoteData(data as QuoteData[]);
    if (changes.length === 0 && !isInitialSnapshot) {
      return undefined;
    }
    // For initial snapshots, ensure we have positions data even if no changes
    if (changes.length === 0 && isInitialSnapshot) {
      // Force processing with current data to get positions
      changes = processQuoteData([]); // This should create positions from current state
      if (changes.length === 0) {
        // If still no changes, we need to build positions manually
        Object.keys(portfolioPositions).forEach(symbol => {
          const pos = portfolioPositions[symbol];
          if (pos && !changes.find(c => c.symbol === symbol)) {
            changes.push(pos as QuoteChange);
          }
        });
      }
    }
    // console.log('$#$ portfolioPositions', portfolioPositions)
    const marketValue = Object.keys(portfolioPositions).reduce((sum, symbol) => {
      const posValue = Number(portfolioPositions[symbol]?.marketValue);
      // Ensure NaN or undefined values don't corrupt the sum, treat them as 0
      return sum + (isNaN(posValue) ? 0 : posValue);
    }, 0);
    const result = Object.keys(portfolioPositions).reduce(
      (sum, symbol) => sum + Number(portfolioPositions[symbol].result),
      0,
    );
    const todayResult = Object.keys(portfolioPositions).reduce(
      (sum, symbol) => sum + Number(portfolioPositions[symbol].todayResult),
      0,
    );

    // Ensure all portfolio symbols are in changes (regardless of totalsMode)
    // This covers symbols that didn't receive a quote yet (late-arriving or new symbols)
    Object.keys(portfolioPositions).forEach((symbol) => {
      let change = changes.find((c) => c.symbol === symbol);
      if (!change) {
        change = { symbol } as PortfolioPositionFull;
        changes.push(change);
      }
      // Weights calculation - only when totalsMode is not "none"
      if (totalsMode !== "none") {
        (change as PortfolioPositionFull).weight =
          Math.round(
            (10000 * Number(portfolioPositions[symbol].marketValue)) /
              marketValue,
          ) / 100;
      }
    });
    //console.log('changes', changes)
    switch (closed) {
      case "no":
        changes = changes.filter((c): c is PortfolioPositionFull => {
          return portfolioPositions[c.symbol]?.volume !== 0;
        });
        break;
      case "only":
        changes = changes.filter(
          (c): c is PortfolioPositionFull =>
            portfolioPositions[c.symbol]?.volume === 0,
        );
        break;
      default:
        break;
    }

    // Determine which totals to include based on totalsMode
    // "all" = include all totals (currency, region, subregion, country, sector, industry, portfolios)
    // "minimal" = only main TOTAL row
    // "none" = no totals at all
    if (totalsMode === "all") {
      summationTotal(
        changes as PortfolioPositionFull[],
        currencyInvested,
        "currencyTotal",
      );
      //region -> subregion
      let changesReg: PortfolioPositionFull[] = [];
      summationTotal(changesReg, regionInvested, "regionTotal");
      let changesSubReg: PortfolioPositionFull[] = [];
      summationTotal(changesSubReg, subRegionInvested, "subregionTotal");
      let changesCountry: PortfolioPositionFull[] = [];
      summationTotal(changesCountry, countryInvested, "countryTotal");

      changesReg.forEach((reg) => {
        const regionName = reg.name.split("_").pop() as string;
        const subRegs = getSubRegions(regionName).map((n) => `TOTAL_${n}`);
        //console.log("subRegs", subRegs);
        changesSubReg
          .filter((s) => subRegs.includes(s.name))
          .forEach((subReg) => {
            const subregionName = subReg.name.split("_").pop() as string;

            const countries = getCountries(subregionName).map(
              (n) => `TOTAL_${n}`,
            );
            changes.push(
              ...changesCountry.filter((c) => countries.includes(c.name)),
            );
            changes.push(subReg);
          });
        //changes.push(...changesSubReg.filter((s) => subRegs.includes(s.name)));
        changes.push(reg);
      });
      //let changesCountry: PortfolioPositionFull[] = [];
      // summationTotal(changes, countryInvested, "currencyTotal");
      //sector->industry
      const sectorIndustryMap = new Map<string, string[]>();
      Object.values(portfolioPositions)
        .filter((p) => !(p as PortfolioPositionFull).totalType)
        .forEach(({ sector, industry }) => {
          if (sector && industry) {
            if (!sectorIndustryMap.get(sector)) sectorIndustryMap.set(sector, []);
            sectorIndustryMap.get(sector)!.push(industry);
          }
        });

      //console.log("sectorIndustryMap", sectorIndustryMap);
      let changesSec: PortfolioPositionFull[] = [];
      summationTotal(changesSec, sectorInvested, "sectorTotal");
      let changesInd: PortfolioPositionFull[] = [];
      summationTotal(changesInd, industryInvested, "industryTotal");
      changesSec.forEach((reg) => {
        const aname = reg.name.split("_").pop() || "";
        //console.log("aname=", aname, sectorIndustryMap[aname]);
        const indRegs = sectorIndustryMap.get(aname)
          ? Array.from(sectorIndustryMap.get(aname) || []).map((n) => `TOTAL_${n}`)
          : [];
        //console.log("indRegs", indRegs);
        changes.push(...changesInd.filter((s) => indRegs.includes(s.name)));
        changes.push(reg);
      });

      summationTotal(
        changes as PortfolioPositionFull[],
        portfoliosInvested,
        "portfoliosTotal",
      );

      changes.push({
        symbol: "TOTAL",
        name: "TOTAL",
        investedFull: toNum({ n: investedPortfolio }),
        investedFullSymbol: toNum({ n: investedPortfolio }),

        marketValue: toNum({ n: marketValue }),
        result: toNum({ n: result }),
        todayResult: toNum({ n: todayResult }),
        realized: toNum({ n: totalRealized }),
        totalType: "total",
      } as PortfolioPositionFull);
    } else if (totalsMode === "minimal") {
      changes.push({
        symbol: "TOTAL",
        name: "TOTAL",
        investedFull: toNum({ n: investedPortfolio }),
        investedFullSymbol: toNum({ n: investedPortfolio }),

        marketValue: toNum({ n: marketValue }),
        result: toNum({ n: result }),
        todayResult: toNum({ n: todayResult }),
        realized: toNum({ n: totalRealized }),
        totalType: "total",
      } as PortfolioPositionFull);
    }

    const invested_rates: Record<string, number> = {};
    Object.keys(portfolioPositions).forEach(symbol => {
      const pos = portfolioPositions[symbol];
      if (pos && pos.investedFullSymbol && pos.investedFullSymbol > 0) {
        invested_rates[symbol] = pos.investedFull! / pos.investedFullSymbol;
      }
    });

    neutral_trading = Object.keys(portfolioPositions).reduce((sum, symbol) => {
      const pos = portfolioPositions[symbol];
      if (pos?.resultSymbol) {
        const invested_rate = invested_rates[symbol];
        if (invested_rate) {
          sum += pos.resultSymbol * invested_rate;
        }
      }
      return sum;
    }, 0);

    neutral_passive = Object.keys(positions.dividends).reduce((sum, symbol) => {
      const invested_rate = invested_rates[symbol];
      if (invested_rate) {
        sum += positions.dividends[symbol] * invested_rate;
      }
      return sum;
    }, 0);

    if (includeAttribution) {
      const trading = neutral_trading;
      const passive = Object.keys(positions.dividends).reduce((sum, key) => {
        const symbol = key;
        const cur = portfolioPositions[symbol]?.currency || portfolio.currency;
        const rate = rates[cur] || 1;
        return sum + positions.dividends[key] * rate;
      }, 0);
      const dividendsSumBase = passive;
      const totalReturn = (marketValue || 0) + dividendsSumBase - investedPortfolio;
      const currency = totalReturn - trading - passive;

      changes.push({
        symbol: "ATTRIBUTION",
        baseCurrency: portfolio.currency,
        totalReturn: toNum({ n: totalReturn }),
        breakdown: {
          trading: {
            amount: toNum({ n: trading }),
            percent: totalReturn !== 0 ? Math.round((trading / totalReturn) * 10000) / 100 : 0,
          },
          passive: {
            amount: toNum({ n: passive }),
            percent: totalReturn !== 0 ? Math.round((passive / totalReturn) * 10000) / 100 : 0,
          },
          currency: {
            amount: toNum({ n: currency}),
            percent: totalReturn !== 0 ? Math.round((currency / totalReturn) * 10000) / 100 : 0,
          },
        },
      } as any);
    }

    return changes;
  };

  // Store subscription state separately to avoid closure capture of large objects
  const subscriptionState = {
    isInitial: true,
  };

  const registeredHandler = (data: object) => {
    const actualChanges = (data as QuoteData[]).filter((d: QuoteData) =>
      d.lastTradeTime
        ? Object.keys(d).length > 2
        : Object.keys(d).length >= 2,
    );
    if (actualChanges.length === 0) {
      return;
    }

    // Check if subscription still exists (socket may have disconnected)
    if (!subscribers[userModif] || !subscribers[userModif][msgId]) {
      return;
    }

    const streamingTotalsMode = subscriptionState.isInitial ? totalsMode : "minimal";
    const streamingIncludeAttribution = subscriptionState.isInitial ? includeAttribution : false;
    const changes = calcChanges(actualChanges, streamingIncludeAttribution, streamingTotalsMode, subscriptionState.isInitial);

    if (changes && changes.length > 0) {
      console.log(
        moment().format("HH:mm:ss SSS"),
        "subscriber SSE-> ",
        userModif,
        msgId,
        "===>",
        changes.length,
      );
      sendResponse(changes);
    }

    subscriptionState.isInitial = false;

    // Check socket state and cleanup if necessary
    if (socket.readyState === WebSocket.CLOSED) {
      if (!(socket as UserWebSocket).waitNum) {
        (socket as UserWebSocket).waitNum = Date.now();
      } else if (Date.now() - (socket as UserWebSocket).waitNum > 30000) {
        // Clean up dead subscription
        if (subscribers[userModif]?.[msgId]) {
          const sub = subscribers[userModif][msgId];
          logger.log(`[SSEService cleanup in closed state ${userModif}|${msgId} ${sseService.getEventName()}]`);
          sseService.stop();
          eventEmitter.removeListener(sseService.getEventName(), registeredHandler);

          // Clear subscription data to help GC free memory
          if (sub.data) {
            sub.data.portfolioPositions = {} as any;
            sub.data.rates = {};
            sub.data.fees = {} as any;
            sub.data.cashes = {};
            sub.data.currencyInvested = {};
            sub.data.regionInvested = {};
            sub.data.subRegionInvested = {};
            sub.data.countryInvested = {};
            sub.data.sectorInvested = {};
            sub.data.industryInvested = {};
            sub.data.portfoliosInvested = {};
          }

          delete subscribers[userModif][msgId];
          logSubscriptionCount('socket_cleanup');
        }
      }
    } else if (socket.readyState === WebSocket.OPEN) {
      (socket as UserWebSocket).waitNum = 0;
    }
  };

  let subscriptionResolved = false;

  subscribers[userModif][msgId] = {
    sseService,
    tradeHandler: subscriberOnTrades,
    handler: registeredHandler,
    registeredHandler,
    data: portfolioData,
  };
  logSubscriptionCount('subscribe');

  eventEmitter.on(eventName, registeredHandler);

  profiler.endTimer("positions.main", userModif, msgId, {
    success: true,
    totalDuration: Date.now() - startTime,
    symbolsSubscribed: symbols.length,
    eventName: requestType === "1" ? "subscribed" : "snapshot"
  });

  // For snapshot requests (requestType "0"), return positions immediately
  if (requestType === "0") {
    isFirst = true;
    processQuoteData([]);
    const snapshotPositions = calcChanges([], includeAttribution, totalsMode, true);
    return snapshotPositions;
  }

  // For subscribe requests, return immediately - the registeredHandler will send updates via sendResponse
  if (requestType === "1") {
    return { msg: "subscribed", eventName };
  }

  return { msg: "snapshot" };
}

//--

const summationFields = (
  currencyInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  >,
  keyField: string,
  v: number,
  vs: number,
  f: number,
  fs: number,
): void => {
  if (!currencyInvested[keyField]) {
    currencyInvested[keyField] = {
      invested: 0,
      investedSymbol: 0,
      fee: 0,
      feeSymbol: 0,
    };
  }
  currencyInvested[keyField].invested += v;
  currencyInvested[keyField].investedSymbol += vs;
  currencyInvested[keyField].fee += f;
  currencyInvested[keyField].feeSymbol += fs;
};

const summationTotal = (
  changes: QuoteChange[],
  invested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  >,
  totalType: string,
): void => {
  Object.keys(invested).forEach((symbol) => {
    changes.push({
      symbol: `TOTAL_${symbol}`,
      name: `TOTAL_${symbol}`,
      investedFull: toNum({ n: invested[symbol].invested }),
      investedFullSymbol: toNum({ n: invested[symbol].investedSymbol }),
      fee: toNum({ n: invested[symbol].fee }),
      feeSymbol: toNum({ n: invested[symbol].feeSymbol }),
      total: toNum({ n: invested[symbol].invested - invested[symbol].fee }),
      totalSymbol: toNum({
        n: invested[symbol].investedSymbol - invested[symbol].feeSymbol,
      }),
      totalType,
    } as PortfolioPositionFull);
  });
};

async function getPositions(
  allTrades: Trade[],
  portfolio: Portfolio,
  closed: string,
) {
  profiler.startTimer("getPositions.total", "system", "getPositions");
  profiler.logPoint("getPositions.total", "system", "getPositions", "start", { tradesCount: allTrades.length });
  
  const lastTrade = findMaxByField<Trade>(allTrades, "tradeTime");
  const endDate = lastTrade.tradeTime;
  const uniqueSymbols = extractUniqueFields(allTrades, "symbol");
  const uniqueCurrencies = extractUniqueFields(allTrades, "currency");
  
  // Declare gicsCache at function level so it is accessible in trade loop
  let gicsCache = new Map<string, { sector: string; industry: string }>();

  profiler.startTimer("getPositions.symbolCountries", "system", "getPositions");
  const symbolCountries = await getSymbolsCountries(uniqueSymbols);
  profiler.endTimer("getPositions.symbolCountries", "system", "getPositions", { symbolsCount: uniqueSymbols.length });
  
  // Always fetch GICS data for now - it's needed for sector/industry totals
  // TODO: Make this conditional on totalsMode parameter when available
  profiler.startTimer("getPositions.gicsLookup", "system", "getPositions");
  const nonFXSymbols = uniqueSymbols.filter((s) => !s.endsWith(":FX"));

  // Batch GICS + country lookup for all symbols
  const symbolCountryMap = new Map<string, string>();
  for (const symbol of nonFXSymbols) {
    const { sector, industry } = await getGICS(symbol);
    gicsCache.set(symbol, { sector, industry });
    const country = await getSymbolCountry(symbol);
    symbolCountryMap.set(symbol, country);
  }
  profiler.endTimer("getPositions.gicsLookup", "system", "getPositions", {
    symbolsCount: nonFXSymbols.length,
    cacheSize: gicsCache.size,
    skipped: false
  });
  
  let cashes: Record<string, number> = {}; //local,port
  let dividends: Record<string, number> = {};
  //console.log('uniqueSymbols', uniqueSymbols, 'uniqueCurrencies', uniqueCurrencies);
  let currencyInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let regionInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let subRegionInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let countryInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let sectorInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let industryInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let portfoliosInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  > = {};
  let cash = 0;
  const fees: Record<string, { fee: number; feeSym: number }> = {};
  const symbolFullInvestedSymbol: Record<string, number> = {};
  const symbolFullInvested: Record<string, number> = {};
  const symbolRealized: Record<string, RealizedData> = {};
  const symbolFullCash: Record<string, number> = {};
  const symbolFullCashSymbol: Record<string, number> = {};

  let oldPortfolio: Record<
    string,
    Partial<Trade & { sector?: string; industry?: string; country?: string }>
  > = {};
  
  profiler.startTimer("getPositions.tradeLoop", "system", "getPositions");
  profiler.logPoint("getPositions.tradeLoop", "system", "getPositions", "start_loop", { tradesCount: allTrades.length });
  
  let gicsCallCount = 0;
  let tradeProcessCount = 0;
  
  for (const trade of allTrades) {
    tradeProcessCount++;

    switch (trade.tradeType) {
      case "1":
        const { symbol } = trade;
        if (symbol.endsWith(":FX")) {
          const trgCur = symbol.slice(0, 3);
          const fromCur = symbol.slice(3, 6);
          const dirBuyTrg = trade.side === "B" ? 1 : -1;
          const v = dirBuyTrg * trade.price * trade.volume;//* trade.rate;
          let r = trade.currency === portfolio.currency ? trade.rate : 1
          if (!cashes[trade.currency]) {

            cashes[trade.currency] = -v*r;
          } else {
            cashes[trade.currency] -= v*r;
          }
          r = trgCur === portfolio.currency ? trade.rate : 1
          if (!cashes[trgCur]) {
            cashes[trgCur] = v*r;
          } else {
            cashes[trgCur] += v*r;
          }
          if (!cashes[portfolio.currency]) {
            cashes[portfolio.currency] = -trade.fee * trade.rate;
          } else {
            cashes[portfolio.currency] -= trade.fee * trade.rate;
          }
          //          console.log('v,vFrom, vTo', v, symbol, vFrom, vTo, 'fee', trade.fee*trade.rate);
          break;
        } else {
          const trgCur = trade.currency;
          const dirBuyTrg = trade.side === "B" ? 1 : -1;
          const v = dirBuyTrg * trade.price * trade.volume;// * trade.rate;
          if (!cashes[trgCur]) {
            cashes[trgCur] = -v;
          } else {
            cashes[trgCur] -= v;
          }
          if (!cashes[portfolio.currency]) {
            cashes[portfolio.currency] = -trade.fee * trade.rate;
          } else {
            cashes[portfolio.currency] -= trade.fee * trade.rate;
          }
          //         console.log('v', symbol, v, 'fee',trade.fee*trade.rate);
        }

        const country = symbolCountryMap.get(symbol) || symbolCountries[symbol] || "";
        const { a2, region, subRegion } = getCountryFields(country, [
          "a2",
          "region",
          "subRegion",
        ]);
        
        // Use cached GICS data instead of making individual calls per trade
        const gicsData = gicsCache.get(symbol) || { sector: '', industry: '' };
        const { sector, industry } = gicsData;
        const dir = trade.side === "B" ? 1 : -1; //calculate invested
        const isGBX = trade.currency === 'GBX';
        const priceAdj = isGBX ? trade.price / 100 : trade.price;
        const priceN = toNum({ n: priceAdj });
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
          ? o.volume + dir * trade.volume
          : +dir * trade.volume;

        oldPortfolio[symbol] = {
          symbol,
          volume: newVolume,
          price: trade.price,
          //?   rate: trade.rate,
          currency: trade.currency,
          //?  fee: trade.fee,
          invested: newVolume * priceAdj * trade.rate, //invwstedSymbol
          tradeTime: trade.tradeTime,
          sector,
          industry,
          country,
        };
        const vs = /*-*/ priceAdj * trade.volume * dir;
        const v = vs * trade.rate;
        symbolFullInvested[symbol] = symbolFullInvested[symbol]
          ? symbolFullInvested[symbol] + v
          : v;
        symbolFullInvestedSymbol[symbol] = symbolFullInvestedSymbol[symbol]
          ? symbolFullInvestedSymbol[symbol] + vs
          : vs;

        summationFields(currencyInvested, trade.currency, v, vs, f, fs);
        summationFields(regionInvested, region as string, v, vs, f, fs);
        summationFields(subRegionInvested, subRegion as string, v, vs, f, fs); //if (dir > 0) {
        summationFields(countryInvested, country as string, v, vs, f, fs); //if (dir > 0) {
        summationFields(sectorInvested, sector, v, vs, f, fs);
        summationFields(industryInvested, industry, v, vs, f, fs);
        summationFields(portfoliosInvested, trade.portfolioId, v, vs, f, fs);

        const vi = toNum({ n: priceAdj * trade.rate * trade.volume });
        if (!symbolRealized[symbol]) {
          symbolRealized[symbol] = { totalCost: 0, realized: 0 };
        }
        let avgPrice = 0;
        let realizedPnL = 0;
        if (trade.side === "B") {
          symbolRealized[symbol].totalCost += vi;
        } else {
          avgPrice = o.volume ? symbolRealized[symbol].totalCost / o.volume : 0;
          realizedPnL = (priceAdj * trade.rate - avgPrice) * trade.volume;
          symbolRealized[symbol].realized += realizedPnL;
          symbolRealized[symbol].totalCost -= avgPrice * trade.volume;
        }

        break;
      case "20": //Dividends = "20",
        const dividendPriceAdj = trade.currency === 'GBX' ? trade.price / 100 : trade.price;
        if (!dividends[trade.symbol]) {
          dividends[trade.symbol] = dividendPriceAdj;
        } else {
          dividends[trade.symbol] += dividendPriceAdj;
        }
        if (!cashes[trade.currency]) {
          cashes[trade.currency] = dividendPriceAdj;// * trade.rate;
        } else {
          cashes[trade.currency] += dividendPriceAdj;//trade.rate *
        }
        console.log(
          "dividends:",
          trade.price,
          trade.rate,
          dividends,
        );
        break;
      case "31":
      case "21":
      case "22":
        if (!cashes[trade.currency]) {
          cashes[trade.currency] = trade.price
        } else {
          cashes[trade.currency] += trade.price;
        }
        if (!cashes[portfolio.currency]) {
          cashes[portfolio.currency] = -trade.fee* trade.rate;
        } else {
          cashes[portfolio.currency] -= trade.fee* trade.rate;
        }
      /*  const cashPut = trade.price * trade.rate;
        cash += cashPut;
        if (!currencyInvested[trade.currency]) {
          currencyInvested[trade.currency] = { invested: 0, investedSymbol: 0, fee:0 , feeSymbol:0 };
        }
        currencyInvested[trade.currency].invested += cashPut;
        currencyInvested[trade.currency].investedSymbol += trade.price;*/
    }
  }
  
  profiler.endTimer("getPositions.tradeLoop", "system", "getPositions", { 
    tradesProcessed: tradeProcessCount,
    gicsCallsTotal: gicsCallCount 
  });
  
  let currentDay = endDate.split("T")[0];
  const nowDay = moment().format(formatYMD); //!!!!!!!!!!!!!!!!!!!!!!!!
  const allSymbols = Object.keys(oldPortfolio);
  //console.log('oldPortfolio', oldPortfolio);
  const actualSymbols = allSymbols.filter((s) => !s.endsWith(":FX"));

  //console.log("positions.OOOO", currentDay, nowDay, actualSymbols);
  const positions: Record<string, Partial<Trade>> = actualSymbols.reduce(
    (p, s) => ({ ...p, /*positionType:1,*/ [s]: oldPortfolio[s] }),
    {},
  );

  const tradedSymbols = Object.keys(positions).filter(
    (s) => positions[s].tradeTime?.split("T")[0] === nowDay, //currentDay,
  );
  // console.log("tradedSymbols", tradedSymbols, "positions", positions);
  let invested = 0;
  //const curentPositions = tradedSymbols.map((s) => positions[s]);
  //console.log("symbolRealized", symbolRealized, 'traded.length:', curentPositions.length, 'positions.length',Object.keys(positions).length);
  /*if (curentPositions.length < Object.keys(positions).length) { !!!!!
    let { inv, notTradeChanges } = addNotTradesItems(
      nowDay,
      portfolio.currency,
      tradedSymbols,
      positions,
    );
    //invested += inv;
  //  console.log("notTradeChanges", notTradeChanges);
    curentPositions.push(...Object.values(notTradeChanges));
  }*/
  const curentPositions = Object.values(positions);
  let realized = allSymbols.reduce(
    (sum, symbol) => sum + symbolRealized[symbol].realized,
    0,
  );
  for (const p of curentPositions) {
    const symbol = p.symbol as string;

    //use compamyMame from subscr p.name = await getCompanyField(symbol);

    (p as PortfolioPosition).investedFull = symbolFullInvested[symbol];
    (p as PortfolioPosition).investedFullSymbol =
      symbolFullInvestedSymbol[symbol];
    invested += Number(p.invested);
    (p as PortfolioPosition).realized = symbolRealized[symbol].realized;
  }
  /* const currencyTotals = Object.keys(currencyInvested).map((cur) => ({
    currency: cur,
    invested: currencyInvested[cur].invested,
    currencyInvestedSymbol: currencyInvested[cur].investedSymbol,
  }));*/
  // console.log('getPositiins.curentPositions ', curentPositions )

  profiler.startTimer("getPositions.mapKeyToName", "system", "getPositions");
  const mappedPortfoliosInvested = await mapKeyToName(portfoliosInvested);
  profiler.endTimer("getPositions.mapKeyToName", "system", "getPositions", { 
    portfolioCount: Object.keys(portfoliosInvested).length 
  });

  profiler.endTimer("getPositions.total", "system", "getPositions", { 
    totalPositions: curentPositions.length,
    totalSymbols: actualSymbols.length,
    totalRealized: realized
  });

  return {
    date: nowDay,
    invested,
    cash,
    nav: cash + invested,
    positions: curentPositions as PortfolioPosition[],
    fees,
    realized,
    currencyInvested,
    regionInvested,
    subRegionInvested,
    countryInvested,
    sectorInvested,
    industryInvested,
    portfoliosInvested: mappedPortfoliosInvested,
    uniqueSymbols,
    uniqueCurrencies,
    cashes,
    dividends,
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
  needAddNameCountry: boolean = false,
) {
  data.forEach((d) => {
    if (!d.currency && isCurrency(d.symbol)) {
      d.currency = d.symbol.substring(3, 6);
    }
  });
  const qData2 = data.map((q) => {
    const { symbol, currency, volume, country } = q;
    //console.log('qData2=>', q)
    if (symbol) {
      const qt: Partial<QuoteData2> = {};
      const marketPrice = getMarketPrice(q, marketPriceModel);
      const bprice = getBasePrice(q, basePrice);
      if (bprice) qt.bprice = bprice;

      // @ts-ignore - previousClose may not be in QuoteData type but exists in API response
      const close = q.previousClose;
      if (close !== undefined) {
        qt.marketClose = close;
      }
      if (needAddNameCountry) {
        qt.name = q.companyName;
        // country/a2/region/subRegion come from MongoDB via oldPortfolio — do not overwrite with SSE data
      }

      // Apply GBX scaling for LSE stocks (all GBP-denominated stocks from LSE are quoted in pence)
      let finalMarketPrice = marketPrice;
      if (marketPrice && currency === 'GBP') {
        // All UK stocks with GBP currency are quoted in GBX (pence), divide by 100 to get GBP
        finalMarketPrice = marketPrice / 100;
      }

      qt.marketPrice = finalMarketPrice;
      //console.log('qt',symbol,  qt)
      return Object.keys(qt).length > 0 ? { symbol, ...qt } : undefined;
    }
  });
  return qData2;
}

function getMarketPrice(
  q: QuoteData,
  marketPrice?: string,
): number | undefined {
  // console.log("marketPrice", marketPrice, q.iexBidPrice, q.iexAskPrice);
  switch (marketPrice) {
    case "0":
      return q.iexBidPrice;
    case "1":
      return q.iexAskPrice;
    case "2":
      return q.latestPrice ?? q.close;
    //case 3: return 'open'
    case "4":
      return q.latestPrice || (q.close + (q.change || 0));
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
        //console.log(q.iexBidPrice, q.iexAskPrice, typeof q.iexBidPrice);
        return 0.5 * (q.iexBidPrice + q.iexAskPrice);
      }
      if (q.iexBidPrice && q.iexBidPrice > 0) {
        return q.iexBidPrice;
      }
      if (q.iexAskPrice && q.iexAskPrice > 0) {
        return q.iexAskPrice;
      }
      return q.close;
    case "8":
      if (q.latestPrice) return q.latestPrice;
      if (
        q.iexBidPrice &&
        q.iexAskPrice &&
        q.iexBidPrice > 0 &&
        q.iexAskPrice > 0
      ) {
        return 0.5 * (q.iexBidPrice + q.iexAskPrice);
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

    case "8":
      if (q.latestPrice) return q.latestPrice;
      if (
        q.iexBidPrice &&
        q.iexAskPrice &&
        q.iexBidPrice > 0 &&
        q.iexAskPrice > 0
      ) {
        return 0.5 * (q.iexBidPrice + q.iexAskPrice);
      }
      return q.close;
    default:
      return q.close;
  }
}

/*
buy EURUSD:FX   quantity =10000   price:1.0692 fee=2 currency USD
so we in trade: USD sell+fee  = 10000*1.0692+2=10694 this amount need for buy 10000EUR
Change in USD CASH = 100372 - 10694 = 89678 ! and in screen 3 we have too 89678, all good
Change in EUR CASH = -39 +10692= 10653
So all currencies cash in portfolio currency USD

SELL EURDKK DKK 7.4585 20000  Buy evro 20000 by 7.4585=149170 DKK -> USD



Interactive Brokers (IB) calculates the cash change for a buy or sell trade of the EURUSD currency pair based on the portfolio currency, which in this example can be either EUR or DKK.

Here's how the cash change would be calculated in each scenario:

    Portfolio Currency is EUR:
        If you buy EURUSD:
            The cash change would be the cost of the trade in EUR, which is the traded volume multiplied by the EURUSD price.
            For example, if you buy 100,000 EURUSD at a price of 1.2000, the cash change would be 100,000 * 1.2000 = 120,000 EUR.
        If you sell EURUSD:
            The cash change would be the proceeds of the trade in EUR, which is the traded volume multiplied by the EURUSD price.
            For example, if you sell 100,000 EURUSD at a price of 1.2000, the cash change would be 100,000 * 1.2000 = 120,000 EUR.

    Portfolio Currency is DKK:
        If you buy EURUSD:
            The cash change would be the cost of the trade in DKK, which is the traded volume multiplied by the EURUSD price and then converted to DKK using the EUR/DKK exchange rate.
            For example, if you buy 100,000 EURUSD at a price of 1.2000 and the EUR/DKK rate is 7.4500, the cash change would be (100,000 * 1.2000) * 7.4500 = 894,000 DKK.
        If you sell EURUSD:
            The cash change would be the proceeds of the trade in DKK, which is the traded volume multiplied by the EURUSD price and then converted to DKK using the EUR/DKK exchange rate.
            For example, if you sell 100,000 EURUSD at a price of 1.2000 and the EUR/DKK rate is 7.4500, the cash change would be (100,000 * 1.2000) * 7.4500 = 894,000 DKK.

The key factors are:

    If the portfolio currency is the same as the base currency of the trade (EUR in this case), the cash change is simply the trade volume multiplied by the price.
    If the portfolio currency is different from the base currency of the trade (DKK in this case), the cash change is calculated by converting the trade value to the portfolio currency using the applicable exchange rate.

Interactive Brokers would handle these currency conversions and cash changes automatically as part of the trade execution and settlement process.

Operations:
  CASH   ->   Local_cash
  FX       Local_cash <-> Local_cash
  Symbol   Local_cash  <-> Investment
 */
