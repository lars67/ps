import { Trade, TradeOp } from "../../types/trade";
import { TradeModel } from "../../models/trade";
import { PortfolioModel } from "../../models/portfolio";

import { Portfolio } from "../../types/portfolio";

import moment, { Moment } from "moment";
import { formatYMD } from "../../constants";
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
import eventEmitter, { sendEvent } from "../../services/app/eventEmiter";
import {
  getCompanyField,
  getGICS,
  getSymbolsCountries,
} from "../../services/app/companies";
import { actualizeTrades, getPortfolioTrades } from "../../utils/portfolio";
import { SubscribeMsgs } from "../../types/other";
import { WebSocket } from "ws";
import { UserWebSocket } from "../../services/websocket";
import {
  getCountries,
  getCountryField,
  getCountryFields,
  getSubRegions,
} from "../../services/app/countries";
import { mapKeyToName } from "../../services/portfolio/helper";
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
    closed = "no",
    changes,
    eventName: SSEEventName,
  }: Params,
  sendResponse: (data?: object) => void,
  msgId: string,
  userModif: string,
  userData: any,
  socket: WebSocket,
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

  let rates: Record<string, number> = {};
  let fees: Record<string, { fee: number; feeSym: number }>;

  let portfolioPositions: Record<string, Partial<PortfolioPositionFull>>;
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
  let currr;
  let isFirst: boolean = true;
  let investedPortfolio = 0; //full portfolio invested

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
    regionInvested = positions.regionInvested;
    subRegionInvested = positions.subRegionInvested;
    countryInvested = positions.countryInvested;
    sectorInvested = positions.sectorInvested;
    industryInvested = positions.industryInvested;
    portfoliosInvested = positions.portfoliosInvested;

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
    // console.log("portfolioPositions", portfolioPositions);
    isFirst = true;
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
  regionInvested = positions.regionInvested;
  subRegionInvested = positions.subRegionInvested;
  countryInvested = positions.countryInvested;
  sectorInvested = positions.sectorInvested;
  industryInvested = positions.industryInvested;
  portfoliosInvested = positions.portfoliosInvested;

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
    console.log("processQuoteData rates", rates);
    if (requestType === "0") {
      console.log("stop!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      subscribers[userModif][msgId].sseService.stop();
      eventEmitter.removeListener(
        subscribers[userModif][msgId].sseService.getEventName(),
        subscribers[userModif][msgId].handler,
      );
    }
    //console.log("isFirst--------------------->", isFirst);
    const q2Rates = prepareQuoteData2(
      currencyData,
      marketPrice,
      basePrice,
    ).filter(Boolean);
    //  console.log( "q2Rates", q2Rates, 'rates', rates);

    const newRates = {} as Record<string, number>;
    q2Rates.forEach((r) => {
      const cur = (r as { symbol: string }).symbol.substring(0, 3);
      const newRate = (r as QuoteData2).marketPrice;
      // console.log((r as { symbol: string }).symbol, cur, newRate, rates[cur]);
      if (!rates[cur] && newRate) {
        newRates[cur] = newRate;
        rates[cur] = newRate;
      } else if (newRate && newRate !== rates[cur]) {
        newRates[cur] = newRate;
        rates[cur] = newRate;
      }
    });
    // console.log("rates", rates, "newRates", newRates, "fees", fees);

    const q2Symbols = prepareQuoteData2(
      symbolData,
      marketPrice,
      basePrice,
      isFirst,
    ).filter(Boolean);
    console.log("isFirst", isFirst, "q2Symbols", q2Symbols);

    const changes: QuoteChange[] = [];

    q2Symbols.forEach((p) => {
      const { symbol, marketPrice, marketClose } = p as QuoteData2;
      //  console.log('symbol', symbol, Object.keys(portfolioPositions));
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
    let changes = processQuoteData(data as QuoteData[]);
    //console.log("changes ==>", changes);
    if (changes.length === 0) {
      return undefined;
    }
    // console.log('$#$ portfolioPositions', portfolioPositions)
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
      case "no":
        changes = changes.filter(
          (c) => portfolioPositions[c.symbol].volume !== 0,
        );
        break;
      case "only":
        changes = changes.filter(
          (c) => portfolioPositions[c.symbol].volume === 0,
        );
        break;
      default:
        break;
    }

    summationTotal(changes, currencyInvested, "currencyTotal");
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
      changesSubReg.filter((s) => subRegs.includes(s.name)).forEach(subReg=> {
        const subregionName = subReg.name.split("_").pop() as string;

        const countries = getCountries(subregionName).map((n) => `TOTAL_${n}`);
        changes.push(...changesCountry.filter((c) => countries.includes(c.name)));
        changes.push(subReg);
      })
      //changes.push(...changesSubReg.filter((s) => subRegs.includes(s.name)));
      changes.push(reg);
    });
    //let changesCountry: PortfolioPositionFull[] = [];
   // summationTotal(changes, countryInvested, "countryTotal");
//sector->industry
    const sectorIndustryMap = {} as Record<string, Set<string>>;
    Object.values(portfolioPositions)
      .filter((p) => !(p as PortfolioPositionFull).totalType)
      .forEach(({ sector, industry }) => {
        if (sector && industry) {
          if (!sectorIndustryMap[sector]) sectorIndustryMap[sector] = new Set();
          sectorIndustryMap[sector].add(industry);
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
      const indRegs = sectorIndustryMap[aname]
        ? Array.from(sectorIndustryMap[aname]).map((n) => `TOTAL_${n}`)
        : [];
      //console.log("indRegs", indRegs);
      changes.push(...changesInd.filter((s) => indRegs.includes(s.name)));
      changes.push(reg);
    });

    summationTotal(changes, portfoliosInvested, "portfoliosTotal");

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

    return changes;
  };

  subscribers[userModif][msgId] = {
    sseService,
    handler: (data: object) => {
      //console.log("handler event");
      const actualChanges = (data as QuoteData[]).filter((d: QuoteData) =>
        d.lastTradeTime
          ? Object.keys(d).length > 2
          : Object.keys(d).length >= 2,
      );
      if (actualChanges.length === 0) {
        return;
      }
      const changes = calcChanges(actualChanges);
      console.log(
        moment().format("HH:mm:ss SSS"),
        "subscriber SSE-> ",
        userModif,
        msgId,
        //data,
        "===>",
        changes?.length,
      );
      changes && sendResponse(changes);

      if (socket.readyState === WebSocket.CLOSED) {
        if (!(socket as UserWebSocket).waitNum) {
          (socket as UserWebSocket).waitNum = Date.now();
        } else if (Date.now() - (socket as UserWebSocket).waitNum > 30000) {
          console.log(
            "STOPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP SSE",
            sseService.getEventName(),
          );
          sseService.stop();
          eventEmitter.removeListener(
            sseService.getEventName(),
            subscribers[userModif][msgId].handler,
          );
        }
      } else if (socket.readyState === WebSocket.OPEN) {
        (socket as UserWebSocket).waitNum = 0;
      }
    },
  };

  eventEmitter.on(eventName, subscribers[userModif][msgId].handler);
  //const { positions , fees,...rest } = positions;
  return { msg: requestType === "1" ? "subscribed" : "snapshot", eventName };
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
  allTrades0: Trade[],
  portfolio: Portfolio,
  closed: string,
) {
  //console.log('getPositions....');
  const allTrades = actualizeTrades(allTrades0);
  const lastTrade = findMaxByField<Trade>(allTrades, "tradeTime");
  const endDate = lastTrade.tradeTime;
  const uniqueSymbols = extractUniqueFields(allTrades, "symbol");
  const uniqueCurrencies = extractUniqueFields(allTrades, "currency");
  const symbolCountries = await getSymbolsCountries(uniqueSymbols);
  //  const { startDate, endDate, uniqueSymbols, uniqueCurrencies } =
  //    await checkPortfolioPricesCurrencies(allTrades, portfolio.currency);
  //console.log("positions.467", startDate, uniqueSymbols, uniqueCurrencies);
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
    Partial<Trade & { sector?: string; industry?: string }>
  > = {};
  console.log(
    `tradeTime, symbol, side, price,volume, rate, volumeOld,volumeNew,avgPrice, realizedPnL,realized,totalCost`,
  );
  for (const trade of allTrades) {
    switch (trade.tradeType) {
      case "1":
        const { symbol } = trade;
        const country = symbolCountries[symbol];
        const { region, subRegion } = getCountryFields(country, [
          "a2",
          "region",
          "subRegion",
        ]);
        const { sector, industry } = await getGICS(symbol);
        const dir = trade.side === "B" ? 1 : -1; //calculate invested
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
          ? o.volume + dir * trade.volume
          : +dir * trade.volume;

        oldPortfolio[symbol] = {
          symbol,
          volume: newVolume,
          price: trade.price,
          //?   rate: trade.rate,
          currency: trade.currency,
          //?  fee: trade.fee,
          invested: newVolume * trade.price * trade.rate, //invwstedSymbol
          tradeTime: trade.tradeTime,
          sector,
          industry,
        };
        const vs = /*-*/ trade.price * trade.volume * dir;
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

        break;
      case "31":
      case "20":
      /*  const cashPut = trade.price * trade.rate;
        cash += cashPut;
        if (!currencyInvested[trade.currency]) {
          currencyInvested[trade.currency] = { invested: 0, investedSymbol: 0, fee:0 , feeSymbol:0 };
        }
        currencyInvested[trade.currency].invested += cashPut;
        currencyInvested[trade.currency].investedSymbol += trade.price;*/
    }
  }
  let currentDay = endDate.split("T")[0];
  const nowDay = moment().format(formatYMD); //!!!!!!!!!!!!!!!!!!!!!!!!
  const allSymbols = Object.keys(oldPortfolio);
  //console.log('oldPortfolio', oldPortfolio);
  const actualSymbols = allSymbols.filter((s) => {
    switch (closed) {
      case "no":
        return true; //oldPortfolio[s].volume !== 0;
      case "only":
        return true; //oldPortfolio[s].volume === 0;
      default:
        return true;
    }
  });

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
  console.log("curentPositions", curentPositions, "positions", positions);
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
    portfoliosInvested: await mapKeyToName(portfoliosInvested),
    uniqueSymbols,
    uniqueCurrencies,
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
    const { symbol, currency, volume, close, country } = q;
    //console.log('qData2', q)
    if (symbol) {
      const qt: Partial<QuoteData2> = {};
      const marketPrice = getMarketPrice(q, marketPriceModel);
      const bprice = getBasePrice(q, basePrice);
      if (bprice) qt.bprice = bprice;
      if (close) {
        qt.marketClose = close;
      }
      if (needAddNameCountry) {
        const { a2, region, subRegion } = getCountryFields(q.country, [
          "a2",
          "region",
          "subRegion",
        ]);
        console.log(q.country, a2, region, subRegion);
        qt.name = q.companyName;
        qt.country = q.country;
        qt.a2 = a2; //getCountryField(q.country)
        qt.region = region;
        qt.subRegion = subRegion;
      }

      qt.marketPrice = marketPrice;
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
