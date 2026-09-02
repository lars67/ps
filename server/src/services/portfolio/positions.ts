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
  fxCurrency,
  getModelInstanceByIDorName,
  isCurrency,
  isPenceQuoted,
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
  preloadSymbolCurrencies,
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
import profiler from "../../utils/profiler";
import { checkPriceCurrency, checkPrices, getDateSymbolPrice, getLastKnownPrice, getRate } from "../../services/app/priceCashe";
import { buildContractCalcContexts, ContractCalcContext } from "../../services/derivatives/buildContractCalcContexts";
import { calcTheoPrice } from "../../services/derivatives/calcTheoPrice";
import { ContractModel } from "../../models/contract";
import { resolveContractSettings } from "../../services/derivatives/resolveContractSettings";
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
    if (sub.initialTimer) {
      clearTimeout(sub.initialTimer);
      sub.initialTimer = null;
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
  // Theoretical price for option/future positions (see types/trade.ts's contractId), recomputed
  // whenever the underlying's live quote ticks - see buildContractCalcContexts.ts/calcTheoPrice.ts.
  // undefined for plain equity positions and for contract positions until the JCalc addon exists
  // (docs/derivatives/03-migration-notes.md in portfolio-server) - calcTheoPrice.ts is a stub.
  theoPrice?: number;
  // null when the symbol's FX rate to the portfolio base currency is unknown —
  // we emit null rather than a silently-wrong x1 figure. See processQuoteData.
  marketRate: number | null;
  marketValue: number | null;
  marketValueSymbol: number;
  marketClose: number;
  bprice: number;
  result: number | null;
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
  // Set only for option/future positions - see types/trade.ts's contractId.
  contractId?: string;
  // Contract/lot size (see resolveContractSettings.ts) - 1 for plain equity/cash positions.
  // investedFull/investedFullSymbol already have this baked in (see getPositions' priceAdj);
  // avgPremium/marketValue/result need it applied explicitly to stay in the position's real
  // per-share/unit price terms rather than inheriting investedFull's scaled terms.
  multiplier?: number;
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

// "Theoretical" as a marketPrice choice (see getMarketPrice's switch, values "0"-"8" for
// bid/ask/last/close/etc): contract positions (option/future) value at theoPrice instead of
// whatever real quote arrives for their own symbol - feeds marketValue/result/TOTAL the same way
// a real quote would, see the contractCalcContexts handling in processQuoteData. Meaningless for
// non-contract positions (no theoPrice concept) - handled there directly rather than added to
// getMarketPrice's switch, since it needs contractCalcContexts/theoPrice, not just the quote `q`.
const MARKET_PRICE_THEORETICAL = "9";

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
      if (sub.initialTimer) {
        clearTimeout(sub.initialTimer);
        sub.initialTimer = null;
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
    contractCalcContexts: {} as Record<string, ContractCalcContext>,
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
  let contractCalcContexts = portfolioData.contractCalcContexts;
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
    // An Aktia lookup failure here must not take down this trade.change listener (it's shared
    // across the subscription's lifetime, not a single request) - degrade to "no theoPrice" for
    // this cycle rather than propagate.
    try {
      contractCalcContexts = await buildContractCalcContexts(positions.positions.filter((p) => p.volume !== 0));
    } catch (err) {
      logger.error(`[contractCalcContexts] failed to build: ${err}`);
    }
    const symbols = [
      ...positions.positions.map((p) => p.symbol),
      ...extractUniqueFields(positions.positions, "currency")
        .map(
          (c: string) =>
            fxCurrency(c) !== portfolio.currency && `${fxCurrency(c)}${portfolio.currency}:FX`,
        )
        .filter(Boolean),
      // Option/future positions need their underlying's live quote too - theoPrice recomputes
      // off that tick, not the contract's own symbol (see buildContractCalcContexts.ts).
      ...new Set(Object.values(contractCalcContexts).map((c) => c.priceDriverSymbol)),
    ];
    positions.uniqueCurrencies
      .filter((u) => fxCurrency(u) !== portfolio.currency)
      .forEach((u) => {
        const r = `${portfolio.currency}${fxCurrency(u)}:FX`;
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

  // An Aktia lookup failure here must not fail the whole positions request - degrade to
  // "no theoPrice this cycle" rather than propagate.
  try {
    contractCalcContexts = await buildContractCalcContexts(positions.positions.filter((p) => p.volume !== 0));
  } catch (err) {
    logger.error(`[contractCalcContexts] failed to build: ${err}`);
  }

  const symbols = [
    ...positions.positions.map((p) => p.symbol),
    ...extractUniqueFields(
      trades.filter((t) => t.tradeType === "1" && t.symbol?.endsWith(":FX")),
      "symbol",
    ),
    ...extractUniqueFields(positions.positions, "currency")
      .filter((c) => fxCurrency(c) !== portfolio.currency)
      .map((c: string) => `${fxCurrency(c)}${portfolio.currency}:FX`),
    // Option/future positions need their underlying's live quote too - theoPrice recomputes off
    // that tick, not the contract's own symbol (see buildContractCalcContexts.ts).
    ...new Set(Object.values(contractCalcContexts).map((c) => c.priceDriverSymbol)),
  ];
  positions.uniqueCurrencies
    .filter((u) => fxCurrency(u) !== portfolio.currency)
    .forEach((u) => {
      const r = `${portfolio.currency}${fxCurrency(u)}:FX`;
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
    if (existing.initialTimer) {
      clearTimeout(existing.initialTimer);
      existing.initialTimer = null;
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

  // Actively fetch every FX rate this portfolio needs before any quote processing runs -
  // getRate()/getDateSymbolPrice() below only ever read dateHistory passively, they never
  // fetch. Previously the only thing that ever populated FX data was a live SSE tick for
  // that exact pair (unreliable outside its market hours) or an incidental side effect of
  // the separate tools.statistic call racing this one. Confirmed in production: on a
  // freshly-restarted server (empty cache) a USD-denominated holding (Vibeke Holst,
  // HEAL:XLON) showed a real marketPrice with marketValue=null, purely because nothing
  // had actively fetched USD/DKK yet. Bounded so a slow/dead proxy can't stall setup.
  const neededCurrencies = positions.uniqueCurrencies.filter((c) => fxCurrency(c) !== portfolio.currency);
  if (neededCurrencies.length > 0) {
    try {
      const fxStartFrom = moment().subtract(10, "days").format(formatYMD);
      await Promise.race([
        Promise.all(neededCurrencies.map((c) => checkPriceCurrency(c, portfolio.currency, fxStartFrom))),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch (err) {
      logger.warn(`[positions] FX rate warm-up failed ${userModif}|${msgId}: ${err}`);
    }
  }

  const processQuoteData = (data: QuoteData[]) => {
    const [currencyData, symbolData] = divideArray(
      data,
      //    (q: QuoteData) => !positions.uniqueSymbols.includes(q.symbol),
      (q: QuoteData) => isCurrency(q.symbol),
    );
    // Reduced verbose logging for quote processing
    logger.log(`[QUOTE_PROCESSING] Processing ${data.length} quotes: ${currencyData.length} FX, ${symbolData.length} symbols`);

    // Currencies whose FX rate to the portfolio base currency we don't actually
    // know (no FX quote arrived). For these, base-currency outputs (result,
    // marketValue, marketRate) are nulled instead of faked with a 1:1 rate.
    const missingRates = new Set<string>();

    positions.uniqueCurrencies.forEach(cur=> {
      // GBX (pence) carries no FX rate of its own — it uses the GBP rate. The pence->GBP
      // scale is applied to prices (isPenceQuoted), not here. rates stays keyed by the
      // original currency so downstream rates[cur] lookups keep working for GBX positions.
      const fxCur = fxCurrency(cur);
      if (fxCur === portfolio.currency) {
        rates[cur] = 1
      } else {
        let fxData = data.find(d => d.symbol === `${fxCur}${portfolio.currency}:FX`);
        let inv = false;
        if (!fxData) {
          fxData = data.find(d => d.symbol === `${portfolio.currency}${fxCur}:FX`);
          inv = true;
        }
        // FX rate source: live price, then close, then the average spread
        // (bid/ask mid) when no close is available.
        let fxPrice = fxData ? (fxData.latestPrice ?? fxData.close) : undefined;
        if (fxPrice == null && fxData &&
            fxData.iexBidPrice != null && fxData.iexAskPrice != null &&
            fxData.iexBidPrice > 0 && fxData.iexAskPrice > 0) {
          fxPrice = 0.5 * (fxData.iexBidPrice + fxData.iexAskPrice);
        }
        if (fxPrice != null) {
          rates[cur] = inv ? 1.0 / fxPrice : fxPrice;
          missingRates.delete(cur);
        } else if (!(cur in rates)) {
          // No live FX tick this batch. The initial snapshot (emitInitialSnapshot) has its
          // own one-time cache fallback for this, but every later live-driven update runs
          // through here too - without also trying the cache, any position whose OWN price
          // ticks before its FX pair ever does gets marketValue nulled despite a real,
          // current marketPrice. Confirmed in production: Vibeke Holst's HEAL:XLON
          // (USD/DKK) showed a live marketPrice with marketValue=null on exactly this path.
          const cachedRate = getRate(fxCur, portfolio.currency, moment().format(formatYMD));
          if (cachedRate != null) {
            rates[cur] = cachedRate;
            missingRates.delete(cur);
          } else {
            // Genuinely missing, cache included. Keep a neutral 1 so any legacy arithmetic
            // stays finite, but flag the currency so base-currency results are nulled
            // rather than faked.
            rates[cur] = 1;
            missingRates.add(cur);
            logger.error(`[FX_RATE] Missing FX data for ${cur} (fx ${fxCur}) vs ${portfolio.currency}`);
          }
        }
        // else: this batch is a delta that simply didn't repeat the FX quote —
        // keep the rate resolved in a previous batch instead of clobbering it.
      }
    });
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
          missingRates.delete(cur);
        } else if (newRate && newRate !== rates[cur]) {
          newRates[cur] = newRate;
          rates[cur] = newRate;
          missingRates.delete(cur);
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
          const rateMissing = missingRates.has(cur);
          investedPortfolio += investedFull;
          portfolioPositions[symbol] = {
            ...portfolioPositions[symbol],
            marketRate: rateMissing ? null : (rates[cur] || 1),
            marketValue: rateMissing ? null : (rates[cur] || 1) * marketPrice * volume,
            marketValueSymbol: marketPrice * volume,
            // investedFull/investedFullSymbol already have multiplier baked in (getPositions'
            // priceAdj) - divide it back out here so avgPremium stays per-share/unit, matching
            // the live "Price" column's convention rather than showing a multiplier-inflated cost.
            avgPremium: volume !== 0 ? (investedFull + fees[symbol].fee) / (volume * (pos.multiplier ?? 1)) : 0,
            avgPremiumSymbol: volume !== 0 ? (investedFullSymbol + fees[symbol].feeSym) / (volume * (pos.multiplier ?? 1)) : 0,
            marketPrice,
            marketClose: 0, // Default close price when no quote data available
            bprice,
            fee: fees[symbol].fee,
            feeSymbol: fees[symbol].feeSym,
          };

          const change = portfolioPositions[symbol] as QuoteChange;
          change.resultSymbol = ((change.marketValueSymbol || 0) - Number(pos.investedFullSymbol) - fees[symbol].feeSym);
          // Without a known FX rate we can't express result in the base currency.
          change.result = rateMissing ? null : change.resultSymbol * (rates[cur] || 1);
          change.todayResult = 0; // No quote data, so no today result
          change.todayResultPercent = 0;

          changes.push(change);
        }
      });
    }

    // Compute theoPrice for every contract position up front (needs the underlying's tick from
    // this batch, in `data` - not the position's own symbol). Always exposed as its own field
    // below regardless of the marketPrice setting, so a "theoretical" position can still be
    // visually compared against a real quote if one ever exists. When marketPrice is
    // MARKET_PRICE_THEORETICAL, additionally splice a synthetic quote (keyed by the position's
    // own symbol, marketPrice = theoPrice) into q2Symbols *before* the main valuation loop runs,
    // so theoPrice drives marketValue/result/todayResult/investedPortfolio through the exact
    // same, already-correct formulas real quotes use below - no duplicated valuation math, and
    // TOTAL picks it up for free since it's summed from portfolioPositions the same way as
    // everything else.
    const contractTheoPrices: Record<string, number> = {};
    Object.keys(contractCalcContexts).forEach((positionSymbol) => {
      const ctx = contractCalcContexts[positionSymbol];
      const underlyingTick = data.find((d) => d.symbol === ctx.priceDriverSymbol);
      let spotPrice = underlyingTick?.latestPrice ?? underlyingTick?.close;
      // London-listed underlyings quote in pence (GBX) - every other price path in this file
      // (prepareQuoteData2, todayResult's cPrice) scales this; the theoPrice spot input needs the
      // same treatment or a GBX underlying prices ~100x too high (JCalc needs GBP major units).
      // Pass the underlying's real currency explicitly (see priceDriverCurrency's comment) rather
      // than relying on isPenceQuoted's symbolCurrencyMap fallback, which only gets populated for
      // symbols that are themselves a held position.
      if (spotPrice != null && isPenceQuoted(ctx.priceDriverSymbol, ctx.priceDriverCurrency)) spotPrice /= 100;
      const position = portfolioPositions[positionSymbol];
      if (spotPrice == null || !position) return;

      const theoPrice = calcTheoPrice({
        ...ctx,
        spotPrice,
        calcDate: moment().format(formatYMD),
      });
      if (theoPrice == null) return;
      contractTheoPrices[positionSymbol] = theoPrice;

      if (marketPrice === MARKET_PRICE_THEORETICAL) {
        // Theoretical mode is authoritative for contract positions - replace any real quote for
        // this same symbol already queued this batch rather than letting both compete.
        const existingIdx = q2Symbols.findIndex((q) => q && (q as QuoteData2).symbol === positionSymbol);
        if (existingIdx >= 0) q2Symbols.splice(existingIdx, 1);
        q2Symbols.push({
          symbol: positionSymbol,
          currency: position.currency as string,
          marketPrice: theoPrice,
          // Seed the day's baseline from whatever's already stored (so todayResult keeps
          // comparing against the same reference point tick to tick), falling back to this
          // theoPrice itself only the very first time this position is priced.
          bprice: position.bprice ?? theoPrice,
        } as QuoteData2);
      } else if (
        position.marketValue === undefined &&
        !q2Symbols.some((q) => q && (q as QuoteData2).symbol === positionSymbol)
      ) {
        // Market mode, and this contract position has never been enriched at all - which for an
        // option/future is permanent, not transient, since there's no real options/futures quote
        // feed to ever supply one. Without this, such a position never goes through the main loop
        // below (only reached via a real quote in q2Symbols, or the "isFirst && q2Symbols.length
        // === 0" fallback above, which only fires when *nothing* in the whole portfolio has a
        // quote yet) - it would stay a near-empty shell forever, missing investedFull/volume/
        // avgPremium/name/currency, with only the decorative theoPrice field below ever populated.
        // marketPrice 0 matches that same whole-portfolio-empty fallback's convention - theoPrice
        // stays visible for reference without driving valuation, same as normal market mode.
        // Skip entirely if a real quote for this exact symbol already exists in q2Symbols this
        // batch (rare, but possible) - that real entry already handles enrichment on its own via
        // the same isFirstForSymbol path below, a synthetic one here would only duplicate the row.
        q2Symbols.push({
          symbol: positionSymbol,
          currency: position.currency as string,
          marketPrice: 0,
          bprice: 0,
        } as QuoteData2);
      }
    });

    q2Symbols.forEach((p) => {
      const { symbol, marketPrice, marketClose } = p as QuoteData2;
      let change = {} as QuoteChange;
      if (!portfolioPositions[symbol]) {
        logger.warn(`Skipping quote data for symbol ${symbol} not in current portfolio positions (likely old data after position changes)`);
        return;
      }
      const cur = portfolioPositions[symbol].currency as string;
      const rateMissing = missingRates.has(cur);
      const volume = Number(portfolioPositions[symbol].volume);
      // Contract/lot size (see resolveContractSettings.ts) - 1 for plain equity/cash positions.
      const multiplier = Number(portfolioPositions[symbol].multiplier) || 1;
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

          marketRate: rateMissing ? null : rates[cur],
          marketValue: rateMissing ? null : rates[cur] * marketPrice * volume * multiplier,
          marketValueSymbol: marketPrice * volume * multiplier,
          // investedFull/investedFullSymbol already have multiplier baked in (getPositions'
          // priceAdj) - divide it back out so avgPremium stays per-share/unit, matching the live
          // "Price" column's convention rather than showing a multiplier-inflated cost.
          avgPremium:
            volume !== 0 ? (investedFull + fees[symbol].fee) / (volume * multiplier) : 0,
          avgPremiumSymbol:
            volume !== 0
              ? (investedFullSymbol + fees[symbol].feeSym) / (volume * multiplier)
              : 0,
          // Mirrors marketPrice for non-contract rows, so the Theo.Price column shows something
          // for every symbol, not just options/futures - whatever quote field marketPrice is
          // configured to resolve (Last/Close/Middle/...) shows up here too. Contract positions
          // get overwritten below with the real JCalc-computed value once that block runs.
          theoPrice: marketPrice,
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
        change.result = rateMissing ? null : change.resultSymbol * rates[cur];
        //         console.log(symbol, cur, rates[cur], change.resultSymbol, change.result);
        const mPrice = Number(
          p?.marketPrice || portfolioPositions[symbol].marketPrice,
        );
        let cPrice = Number(
          p?.bprice || portfolioPositions[symbol].bprice,
        );
        if (isPenceQuoted(symbol)) cPrice /= 100;
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
          change.marketValue = rateMissing ? null :
            (change.marketRate || rates[cur]) *
            (change.marketPrice ||
              Number(portfolioPositions[symbol].marketPrice)) *
            Number(portfolioPositions[symbol].volume) *
            multiplier;
          console.log(
            "change.marketValue=",
            change.marketValue,
            cur,
            rates[cur],
            portfolioPositions[symbol],
          );

          change.result = rateMissing ? null :
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
          if (isPenceQuoted(symbol)) cPrice /= 100;
          change.todayResult = (mPrice - cPrice) * volume * rates[cur];
          change.todayResultPercent =
            Math.round((10000 * (mPrice - cPrice)) / cPrice) / 100;

          portfolioPositions[symbol].marketValue = change.marketValue;
          portfolioPositions[symbol].todayResult = change.todayResult;
          portfolioPositions[symbol].todayResultPercent =
            change.todayResultPercent;
          portfolioPositions[symbol].result = change.result;
          // See the isFirstForSymbol branch's comment above - same mirror, non-contract rows only
          // (contract positions get overwritten with the real computed value further below).
          change.theoPrice = Number(portfolioPositions[symbol].marketPrice);
          portfolioPositions[symbol].theoPrice = change.theoPrice;
        }
      }
      if (Object.keys(change).length > 0) {
        // @ts-ignore
        changes.push({ symbol, ...change });
      }
    });

    // Always expose theoPrice as its own field, independent of whether valuationMode used it to
    // drive marketValue/result above - lets a "theoretical" position still be compared against a
    // real quote if one ever exists, and gives "market" mode a preview of the theoretical value.
    Object.entries(contractTheoPrices).forEach(([positionSymbol, theoPrice]) => {
      if (portfolioPositions[positionSymbol].theoPrice === theoPrice) return;
      portfolioPositions[positionSymbol].theoPrice = theoPrice;
      // A contract can in principle also receive its own live quote in this same tick batch (the
      // loop above would have already pushed a change for positionSymbol in that case) - merge
      // into that entry rather than pushing a second, competing partial object for the same
      // symbol into this batch.
      const existingChange = changes.find((c) => (c as QuoteChange).symbol === positionSymbol);
      if (existingChange) {
        (existingChange as QuoteChange).theoPrice = theoPrice;
      } else {
        changes.push({ symbol: positionSymbol, theoPrice } as QuoteChange);
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
        // Emit the full position record (volume, currency, invested, ...) rather than
        // a bare {symbol} shell, so a holding that never received a quote still carries
        // its known fields instead of arriving empty.
        change = {
          ...(portfolioPositions[symbol] as PortfolioPositionFull),
          symbol,
        };
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

  // For one-shot snapshot requests (requestType "0") we reuse the exact same warmup
  // path as subscriptions, but instead of streaming via sendResponse we resolve this
  // with the single completed snapshot and tear the subscription down. Null for "1".
  let resolveOneShot: ((snap: object | undefined) => void) | null = null;

  // --- Cold-snapshot completeness ---
  // The data proxy delivers quotes over a stream; on a cold connection the first
  // event(s) often carry only a subset of the requested symbols. We must NOT emit
  // the initial snapshot from a partial first event (that produced "empty shell"
  // holdings with no marketPrice/volume). Instead we accumulate quotes across the
  // early events and emit a single, complete initial snapshot once every held
  // symbol has a priced quote — or, as a fallback, after a short timeout (filling
  // any still-missing symbol from the last-known cached close).
  const INITIAL_SNAPSHOT_TIMEOUT_MS = 3000;
  const accumulatedQuotes: Record<string, QuoteData> = {};
  // Symbols that must be priced before the snapshot is considered complete: the
  // actual non-zero holdings (closed/zero-volume rows are filtered out anyway).
  const requiredSymbols = Object.keys(portfolioPositions).filter(
    (s) => Number(portfolioPositions[s].volume) !== 0,
  );
  const quoteHasPrice = (q?: QuoteData) =>
    !!q &&
    (q.latestPrice != null ||
      q.close != null ||
      q.iexBidPrice != null ||
      q.iexAskPrice != null);
  const haveAllRequiredQuotes = () =>
    requiredSymbols.every((s) => quoteHasPrice(accumulatedQuotes[s]));

  const emitInitialSnapshot = async (timedOut: boolean = false) => {
    if (!subscriptionState.isInitial) {
      return;
    }
    const sub = subscribers[userModif]?.[msgId];
    if (!sub) {
      return; // subscription torn down before we could emit
    }
    if (sub.initialTimer) {
      clearTimeout(sub.initialTimer);
      sub.initialTimer = null;
    }
    subscriptionState.isInitial = false;

    if (timedOut) {
      // Fall back to the last-known cached close for any holding the stream never
      // priced, so it still carries marketPrice/marketValue rather than an empty shell.
      const today = moment().format(formatYMD);
      const unpriced = requiredSymbols.filter((s) => !quoteHasPrice(accumulatedQuotes[s]));
      if (unpriced.length > 0) {
        // The close-price cache is only ever populated on demand - nothing else in this
        // request path calls checkPrices for these symbols, so without this call
        // getDateSymbolPrice below has nothing to return and the row stays blank forever.
        // Bounded so a slow/dead data proxy can't extend the warmup indefinitely.
        try {
          // 10 days back, matching getDateSymbolPrice's own backward-search window below -
          // "today" alone can come back empty on a non-trading day and leave nothing to find.
          const fetchFrom = moment().subtract(10, "days").format(formatYMD);
          await Promise.race([
            checkPrices(unpriced, fetchFrom),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
        } catch (err) {
          logger.warn(`[positions] checkPrices fallback failed ${userModif}|${msgId}: ${err}`);
        }
      }
      requiredSymbols.forEach((s) => {
        if (!quoteHasPrice(accumulatedQuotes[s])) {
          const cachedPrice = getDateSymbolPrice(today, s);
          if (cachedPrice != null) {
            accumulatedQuotes[s] = {
              ...(accumulatedQuotes[s] || ({ symbol: s } as QuoteData)),
              symbol: s,
              currency: portfolioPositions[s].currency as string,
              close: cachedPrice,
              latestPrice: cachedPrice,
            } as QuoteData;
          }
        }
      });

      // Last resort for whatever's still unpriced: a symbol that's delisted/acquired (IPG:XNYS,
      // acquired by Omnicom Nov 2025) or barely covered by any provider can have real cached
      // history that's simply older than the 10-day window above - the narrow "from" used for
      // the checkPrices call above actively filters that older data OUT (readLocalCSVData drops
      // any row before "from"), so it's never even considered otherwise. A second, wider-window
      // fetch (bounded, same as above) gives checkPrices a real chance to find and cache it, then
      // getLastKnownPrice picks up whatever's there however old. Marked priceStale below - this
      // must never be presented identically to a live/recent price.
      const staleSymbols: Record<string, string> = {}; // symbol -> price date
      const stillMissing = requiredSymbols.filter((s) => !quoteHasPrice(accumulatedQuotes[s]));
      if (stillMissing.length > 0) {
        try {
          const wideFrom = moment().subtract(2, "years").format(formatYMD);
          await Promise.race([
            checkPrices(stillMissing, wideFrom),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
        } catch (err) {
          logger.warn(`[positions] wide last-known-price fallback failed ${userModif}|${msgId}: ${err}`);
        }
        stillMissing.forEach((s) => {
          if (quoteHasPrice(accumulatedQuotes[s])) return;
          const last = getLastKnownPrice(s);
          if (last != null) {
            accumulatedQuotes[s] = {
              ...(accumulatedQuotes[s] || ({ symbol: s } as QuoteData)),
              symbol: s,
              currency: portfolioPositions[s].currency as string,
              close: last.price,
              latestPrice: last.price,
            } as QuoteData;
            staleSymbols[s] = last.date;
          }
        });
      }

      const priced = requiredSymbols.filter((s) => quoteHasPrice(accumulatedQuotes[s])).length;
      logger.warn(
        `[positions] initial snapshot timeout ${userModif}|${msgId}: ${priced}/${requiredSymbols.length} holdings priced` +
          (Object.keys(staleSymbols).length > 0 ? `, ${Object.keys(staleSymbols).length} stale (${Object.keys(staleSymbols).join(",")})` : ""),
      );
      (subscriptionState as { staleSymbols?: Record<string, string> }).staleSymbols = staleSymbols;
    }

    // Holdings can reach "all priced" (or time out) before the FX pair quotes arrive.
    // Without the FX rate, result can't be expressed in the base currency, so fill any
    // still-missing holding-currency rate from the cache before computing the snapshot.
    {
      const fxDay = moment().format(formatYMD);
      const baseCur = portfolio.currency as string;
      const seenFx = new Set<string>();
      requiredSymbols.forEach((s) => {
        const cur = portfolioPositions[s].currency as string;
        if (!cur) return;
        const fxCur = fxCurrency(cur);
        if (fxCur === baseCur || seenFx.has(fxCur)) return;
        seenFx.add(fxCur);
        const pair = `${fxCur}${baseCur}:FX`;
        const invPair = `${baseCur}${fxCur}:FX`;
        if (
          quoteHasPrice(accumulatedQuotes[pair]) ||
          quoteHasPrice(accumulatedQuotes[invPair])
        ) {
          return;
        }
        const rate = getRate(fxCur, baseCur, fxDay);
        if (rate != null) {
          accumulatedQuotes[pair] = {
            symbol: pair,
            currency: fxCur,
            latestPrice: rate,
            close: rate,
          } as QuoteData;
        }
      });
    }

    // Build a single complete snapshot from every quote gathered during warmup,
    // exactly as if the proxy had delivered them all in one message.
    isFirst = true;
    const snapshot = calcChanges(
      Object.values(accumulatedQuotes),
      includeAttribution,
      totalsMode,
      true,
    );

    // Tag positions priced from getLastKnownPrice's wide, stale-tolerant lookup above -
    // done here on the final output rather than threaded through calcChanges/QuoteData,
    // since that pipeline builds its result objects field-by-field and won't otherwise
    // pass an unrecognized property through. Must never look identical to a live price.
    const staleMap = (subscriptionState as { staleSymbols?: Record<string, string> }).staleSymbols;
    if (staleMap && Object.keys(staleMap).length > 0 && Array.isArray(snapshot)) {
      snapshot.forEach((row) => {
        const r = row as PortfolioPositionFull & { priceStale?: boolean; priceDate?: string };
        if (r.symbol && staleMap[r.symbol]) {
          r.priceStale = true;
          r.priceDate = staleMap[r.symbol];
        }
      });
    }

    // One-shot snapshot (requestType "0"): return it to the caller and tear the
    // subscription down — there is no ongoing stream for "0".
    if (resolveOneShot) {
      const resolve = resolveOneShot;
      resolveOneShot = null;
      const sub2 = subscribers[userModif]?.[msgId];
      if (sub2) {
        sub2.sseService.stop();
        eventEmitter.removeListener(eventName, registeredHandler);
        eventEmitter.removeListener("trade.change", subscriberOnTrades);
        delete subscribers[userModif][msgId];
        logSubscriptionCount("snapshot_complete");
      }
      console.log(
        moment().format("HH:mm:ss SSS"),
        "snapshot (requestType 0)-> ",
        userModif,
        msgId,
        "===>",
        snapshot?.length,
        timedOut ? "(timeout)" : "(complete)",
      );
      resolve(snapshot);
      return;
    }

    if (snapshot && snapshot.length > 0) {
      console.log(
        moment().format("HH:mm:ss SSS"),
        "subscriber SSE initial-> ",
        userModif,
        msgId,
        "===>",
        snapshot.length,
        timedOut ? "(timeout)" : "(complete)",
      );
      sendResponse(snapshot);
    }
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

    // Warmup phase: accumulate quotes (merging partials per symbol) and only emit
    // the initial snapshot once every holding is priced. Don't send anything yet.
    if (subscriptionState.isInitial) {
      actualChanges.forEach((q) => {
        if (q && q.symbol) {
          accumulatedQuotes[q.symbol] = {
            ...accumulatedQuotes[q.symbol],
            ...q,
          };
        }
      });
      if (haveAllRequiredQuotes()) {
        emitInitialSnapshot(false);
      }
      return;
    }

    const changes = calcChanges(actualChanges, false, "minimal", false);

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

  // Bound the warmup: if not all holdings get priced quickly (e.g. an illiquid or
  // delisted symbol the stream never quotes), emit the best-available snapshot
  // anyway rather than leaving the client without data.
  if (requestType === "1") {
    subscribers[userModif][msgId].initialTimer = setTimeout(() => {
      emitInitialSnapshot(true);
    }, INITIAL_SNAPSHOT_TIMEOUT_MS);
  }

  profiler.endTimer("positions.main", userModif, msgId, {
    success: true,
    totalDuration: Date.now() - startTime,
    symbolsSubscribed: symbols.length,
    eventName: requestType === "1" ? "subscribed" : "snapshot"
  });

  // Snapshot requests (requestType "0") reuse the subscription warmup: wait for the
  // live quotes (or the same timeout fallback that fills from cache), then return the
  // one completed snapshot and tear down. This is the path that yields correct
  // base-currency results instead of an unpriced x1 shell.
  if (requestType === "0") {
    subscribers[userModif][msgId].initialTimer = setTimeout(() => {
      emitInitialSnapshot(true);
    }, INITIAL_SNAPSHOT_TIMEOUT_MS);
    const snapshotPositions = await new Promise<object | undefined>((resolve) => {
      let done = false;
      // Idempotent: emitInitialSnapshot and the safety net below may both race here.
      resolveOneShot = (snap) => {
        if (done) return;
        done = true;
        resolve(snap);
      };
      // Hard safety net: never leave the request hung even if the subscription is torn
      // down (e.g. socket close clears the warmup timer) before a snapshot is emitted.
      setTimeout(() => {
        if (!done) {
          resolveOneShot = null;
          done = true;
          resolve(undefined);
        }
      }, INITIAL_SNAPSHOT_TIMEOUT_MS + 2000);
      // Nothing to price (cash-only / fully closed portfolio): emit immediately so we
      // don't sit through the warmup timeout for a portfolio with no holdings to quote.
      if (requiredSymbols.length === 0) {
        emitInitialSnapshot(false);
      }
    });
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
  // Preload authoritative currencies so isPenceQuoted() only scales GBP London lines.
  await preloadSymbolCurrencies(uniqueSymbols);
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
    Partial<Trade & { sector?: string; industry?: string; country?: string; multiplier?: number }>
  > = {};
  
  // Contract/lot size per contractId (see resolveContractSettings.ts) - batched once for every
  // distinct contract these trades reference, not per trade. Plain equity/cash/dividend trades
  // have no contractId and are unaffected (multiplierByContractId.get() misses -> defaults to 1
  // at each use site below). Needed so a booked option trade's invested/cash impact reflects its
  // real economics (e.g. 100 shares/contract), not just price*volume as if multiplier were 1.
  const contractIds = Array.from(new Set(allTrades.map((t) => t.contractId).filter((id): id is string => !!id)));
  const multiplierByContractId = new Map<string, number>();
  if (contractIds.length > 0) {
    const contractsForMultiplier = await ContractModel.find({ _id: { $in: contractIds } }).lean();
    await Promise.all(
      contractsForMultiplier.map(async (c) => {
        const settings = await resolveContractSettings({
          underlyingSymbolMic: c.underlyingSymbolMic,
          expirationDate: c.expirationDate,
          multiplier: c.multiplier,
        });
        multiplierByContractId.set(String(c._id), settings.multiplier);
      }),
    );
  }

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
        // Trades entered in pence (GBX) are converted to GBP; GBP-labelled trades are
        // already in pounds. The currency label — not the exchange — carries the scale.
        const gbxAdjustedPrice = trade.currency === 'GBX' ? trade.price / 100 : trade.price;
        // Option/future trades: price is quoted per share/unit (matching the live "Price" column's
        // convention), but the position's actual dollar exposure is multiplier times bigger (e.g.
        // 100 shares/contract) - scale it in here, right where cash/invested/realized are computed
        // from priceAdj below, rather than touching trade.price itself (which stays per-share/unit
        // for display - see oldPortfolio[symbol].price a few lines down, deliberately unscaled).
        const contractMultiplier = trade.contractId ? multiplierByContractId.get(trade.contractId) ?? 1 : 1;
        const priceAdj = gbxAdjustedPrice * contractMultiplier;
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
          // Fall back to the prior trade's contractId: a later trade on the same symbol that
          // doesn't resupply a contract spec (e.g. a plain close-out) must not silently drop the
          // position's contract linkage - see types/trade.ts's contractId.
          contractId: trade.contractId ?? o.contractId,
          // Same fallback as contractId above - a later trade without its own contractId (e.g. a
          // close-out) must not reset an already-established position back to multiplier 1.
          multiplier: trade.contractId ? contractMultiplier : (o.multiplier ?? 1),
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

      // London-listed stocks come from the price source in pence; convert pence -> GBP.
      let finalMarketPrice = marketPrice;
      if (marketPrice && isPenceQuoted(symbol)) {
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
