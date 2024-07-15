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
import eventEmitter, { sendEvent } from "../../services/app/eventEmiter";
import {
  getCompanyField,
  getGICS,
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
type PortfolioCurrencyCash = {
  total: number;
  symbol: string;
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
  userData: UserData,
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
  } = await getPortfolioInstanceByIDorName(_id, userData);
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
  let cashes: Record<string, number> = {};
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
    subscribers[userModif][msgId].sseService.start(symbols.join(","), true);
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
    state: { $in: [1] },
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
  console.log("SYMBOLS", symbols);

  eventEmitter.on("trade.change", subscriberOnTrades);
  const sseService = new SSEService("quotes", symbols.join(","), eventName);
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
    console.log("processQuoteData rates", rates);
    //  console.log('currencyData,symbolData: ', currencyData.map(c=>c.symbol), symbolData.map(c=>c.symbol));
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
    //  console.log( "q2Rates$$#", q2Rates, 'rates', rates, currencyData);

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
    //console.log("rates", rates, "newRates", newRates, "fees", fees);

    const q2Symbols = prepareQuoteData2(
      symbolData.filter((d) => !isCurrency(d.symbol)),
      marketPrice,
      basePrice,
      isFirst,
    ).filter(Boolean);
    console.log("isFirst", isFirst, "q2Symbols", q2Symbols);

    const changes: CommonPortfolioPosition[] = [];

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
    if (isFirst) {
      Object.keys(cashes).forEach((key) => {
        const c: CommonPortfolioPosition = {
          symbol: `CASH_${key}`,
          total: cashes[key] as number,
        };
        changes.push(c);
      });
      console.log("positions.dividends=", positions.dividends);
      Object.keys(positions.dividends).forEach((key) => {
        const c: CommonPortfolioPosition = {
          symbol: `DIVIDENDS_${key}`,
          total: toNum({ n: positions.dividends[key]  }),
        };
        changes.push(c);
      });
    }
    isFirst = false;
    return changes;
  };

  const calcChanges = (data: object) => {
    let changes = processQuoteData(data as QuoteData[]);
    console.log("calcChanges ==>", changes);
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
      (change as PortfolioPositionFull).weight =
        Math.round(
          (10000 * Number(portfolioPositions[symbol].marketValue)) /
            marketValue,
        ) / 100;
    });
    //console.log('changes', changes)
    switch (closed) {
      case "no":
        changes = changes.filter((c): c is PortfolioPositionFull => {
          console.log(c.symbol, portfolioPositions[c.symbol]);
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
  allTrades: Trade[],
  portfolio: Portfolio,
  closed: string,
) {
  //console.log('getPositions....');
  const lastTrade = findMaxByField<Trade>(allTrades, "tradeTime");
  const endDate = lastTrade.tradeTime;
  const uniqueSymbols = extractUniqueFields(allTrades, "symbol");
  const uniqueCurrencies = extractUniqueFields(allTrades, "currency");
  const symbolCountries = await getSymbolsCountries(uniqueSymbols);
  let cashes: Record<string, number> = {};
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
    Partial<Trade & { sector?: string; industry?: string }>
  > = {};
  console.log(
    `tradeTime, symbol, side, price,volume, rate, volumeOld,volumeNew,avgPrice, realizedPnL,realized,totalCost`,
  );
  for (const trade of allTrades) {

    switch (trade.tradeType) {
      case "1":
        const { symbol } = trade;
        if (symbol.endsWith(":FX")) {
          const trgCur = symbol.slice(0, 3);
          const dirBuyTrg = trade.side === "B" ? 1 : -1;
          const vFrom = dirBuyTrg * trade.volume;
          const vTo = dirBuyTrg * trade.price * trade.volume;
          const v = dirBuyTrg * trade.price * trade.volume * trade.rate;
          if (!cashes[trade.currency]) {
            cashes[trade.currency] = -v;
          } else {
            cashes[trade.currency] -= v;
          }
          if (!cashes[trgCur]) {
            cashes[trgCur] = v;
          } else {
            cashes[trgCur] += v;
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
          const v = dirBuyTrg * trade.price * trade.volume * trade.rate;
          if (!cashes[trgCur]) {
            cashes[trgCur] = -v;
          } else {
            cashes[trgCur] -= v;
          }
          if (!cashes[portfolio.currency]) {
            cashes[trade.currency] = -trade.fee * trade.rate;
          } else {
            cashes[trade.currency] -= trade.fee * trade.rate;
          }
          //         console.log('v', symbol, v, 'fee',trade.fee*trade.rate);
        }

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
      case "20": //Dividends = "20",
          console.log('DIIIIIIIIIIIIIIIIIIIIIIv',oldPortfolio,trade.symbol);
        const dividendPerShareVol = (oldPortfolio[trade.symbol] as Trade)?.volume || 1;
        if (!dividends[trade.symbol]) {
          dividends[trade.symbol] =
            trade.price * trade.rate * dividendPerShareVol;
        } else {
          dividends[trade.symbol] +=
            trade.price * trade.rate * dividendPerShareVol;
        }
        if (!cashes[trade.currency]) {
          cashes[trade.currency] =
            trade.price * trade.rate * dividendPerShareVol;
        } else {
          cashes[trade.currency] +=
            trade.price * trade.rate * dividendPerShareVol;
        }
        console.log(
          "dividends:",
          trade.price,
          trade.rate,
          dividendPerShareVol,
          dividends,
        );
        break;
      case "31":
      case "21":
      case "22":
        if (!cashes[trade.currency]) {
          cashes[trade.currency] = trade.price * trade.rate;
        } else {
          cashes[trade.currency] += trade.price * trade.rate;
        }
        if (!cashes[portfolio.currency]) {
          cashes[portfolio.currency] = -trade.fee * trade.rate;
        } else {
          cashes[portfolio.currency] -= trade.fee * trade.rate;
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
    const { symbol, currency, volume, close, country } = q;
    //console.log('qData2=>', q)
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

 */
