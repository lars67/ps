import { Trade } from "../../types/trade";
import { FilterQuery } from "mongoose";
import { TradeModel } from "../../models/trade";
import { TradeFilter } from "../trade";
import { fetchHistory } from "../../utils/fetchData";
import { PortfolioModel } from "../../models/portfolio";
import {
  checkPortfolioPricesCurrencies,
  getDatePrices,
  getDateSymbolPrice,
  getRate,
  priceToBaseCurrency,
} from "../../services/app/priceCashe";
import { Portfolio } from "../../types/portfolio";

import moment, {Moment, weekdaysShort} from "moment";
import { formatYMD } from "../../constants";
import {getModelInstanceByIDorName, isValidDateFormat, toNum} from "../../utils";
import {getPortfolioTrades} from "../../utils/portfolio";
import {RealizedData} from "@/services/portfolio/positions";


type Params = {
  _id: string;
  from: string;
  till: string;
  detail: string; //0|1
  sample: string;
  precision:number
};
export async function history(
  { _id, from, till, detail='0', sample , precision=2}: Params,
  sendResponse: (data: any) => void,
  msgId: string,
): Promise<{}> {
  if (!_id) {
    return { error: "Portolio _id is required" };
  }

  const toNumLocal = ( n: number) => toNum({n, precision});


  const {_id:realId,error, instance:portfolio} = await  getModelInstanceByIDorName<Portfolio>(_id, PortfolioModel);

  console.log('R', realId, 'from', _id) ;

  if (error) {
    return error;
  }
  if (from) {
    if (!isValidDateFormat(from)) {
      return { error: "Wrong 'from'" };
    }
    from = `${from.split("T")[0]}T00:00:00`;
  }
  if (till) {
    if (!isValidDateFormat(till)) {
      return { error: "Wrong 'till'" };
    }
    till = `${till.split("T")[0]}T23:59:59`;
  } else {
    till = moment().format(`${formatYMD}T23:59:59`);
  }
  switch(sample){
    case '1':
    case 'day':
      sample = 'day'
      break;
    case '2':
    case 'week':
      sample = 'week'
      break;
    case '3':
    case 'month':
      sample = 'month'
      break;
    default:
      sample = ''
  }

  const allTrades = await getPortfolioTrades(realId, from, {
    state: { $in: ['1'] },
    ...(till && { tradeTime: { $lt: till } })
  } )
  if ((allTrades as {error:string}).error) {
    return allTrades as {error:string}
  }
  const trades = allTrades as Trade[]

  /*const allTrades = await TradeModel.find({
    portfolioId: realId,
    state: { $in: [1] },
    ...(till && { tradeTime: { $lt: till } }),
  })
    .sort({ tradeTime: 1 })
    .lean();*/
//console.log('allTrades', allTrades)
  const withDetail = Number(detail) !== 0;
  if (trades.length <= 0) {
    return { days: [], ...(withDetail && { rows: []})  };
  }

  const { startDate, endDate, uniqueSymbols, uniqueCurrencies } =
  await checkPortfolioPricesCurrencies(trades, portfolio.currency);
  console.log("P", startDate, uniqueSymbols, uniqueCurrencies);
  const lastDay = till.split("T")[0];
  let currentDay = startDate.split("T")[0];

  const symbolRealized: Record<string, RealizedData> = {};

  const oldPortfolio: Record<string, Partial<Trade> | {}> = {};
  let cash = 0;
  let invested = 0;
  let tradedSymbols: string[] = [];
  let days = [];
  const rows = [];
  let nav = 0;
  let totalRealized=0;

  function setSymbolRealized(symbol:string, trade: Trade, oldVolume: number) {
    if (!symbolRealized[symbol]) {
      symbolRealized[symbol] = {totalCost: 0, realized: 0}
    }
    if (trade.side === "B") {
       symbolRealized[symbol].totalCost += toNum({ n: trade.price * trade.rate * trade.volume })
    } else {
      const avgPrice = oldVolume ? symbolRealized[symbol].totalCost / oldVolume : 0;
      const realizedPnL = (trade.price * trade.rate - avgPrice) * trade.volume;
      symbolRealized[symbol].realized += realizedPnL;
      symbolRealized[symbol].totalCost -= avgPrice * trade.volume;
    }
    console.log('RRRRRRRRRRR', trade.tradeTime, symbol, symbolRealized[symbol], '|', trade.side, oldVolume,  '|', trade.volume, trade.price, trade.rate);
  }

  for (const trade of trades) {
    if (!trade.tradeTime.includes(currentDay)) {
      const nextCurrentDayWithTrade = trade.tradeTime.split("T")[0];
      if (sample) {
      //  currentDay = moment(currentDay,formatYMD).add(1, 'day').format(formatYMD)
      } else {
        //currentDay = nextCurrentDayWithTrade;
      }
      ///process as not trades all till nextCurrentDayWithTrade
      while (currentDay<nextCurrentDayWithTrade) {
        const isNotTradedDate= tradedSymbols.length===0;
        let {inv, notTradeChanges} = addNotTradesItems(
            currentDay,
            portfolio.currency,
            tradedSymbols,
            oldPortfolio,
        );

        notTradeChanges.forEach((t) => rows.push(t));
        if(!sample || true) {
          days.push({
            date: currentDay,
            invested: toNumLocal(invested + inv),
            investedWithoutTrades: toNumLocal(inv),
            cash,
            nav: toNumLocal(isNotTradedDate ? inv + cash : nav + inv),

          });
        }
        console.log(isNotTradedDate, currentDay,nextCurrentDayWithTrade, days[days.length-1]);
        currentDay = moment(currentDay,formatYMD).add(1, 'day').format(formatYMD)
        invested = 0;
        tradedSymbols = [];
        if(!sample)break;
      }

      //->
      currentDay = nextCurrentDayWithTrade;// trade.tradeTime.split("T")[0];

      Object.keys(oldPortfolio).map((p) => {
        const pi = oldPortfolio[p] as Trade;
        if (pi.volume === 0) {
          delete oldPortfolio[p];
        }
      });
    }
    const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
    switch (trade.tradeType) {
      case "1":
        const { symbol } = trade;
        tradedSymbols.push(symbol);
        if (!oldPortfolio[symbol]) {
          oldPortfolio[symbol] = {
            volume: 0,
            price: trade.price,
            rate: trade.rate,
            currency: trade.currency,
          };
        }
        const dir = trade.side === "B" ? -1 : 1;
        const oldVolume = (oldPortfolio[symbol] as Trade).volume
        let newVolume =
          oldVolume - dir * trade.volume;
        const priceN = toNum({n : trade.price});
        const cashChange =
          dir * priceN * trade.rate * trade.volume - trade.fee * trade.rate;
        (oldPortfolio[symbol] as Trade).volume = newVolume;
        (oldPortfolio[symbol] as Trade).price = trade.price;
        (oldPortfolio[symbol] as Trade).rate = trade.rate;
        cash += cashChange;
        const investedSymbol = newVolume * priceN * trade.rate;
        invested += investedSymbol; //investedTrade+investedBefore
        nav = invested + cash;
        //-
        setSymbolRealized(symbol, trade,oldVolume)//--
        rows.push({
          symbol,
          operation: trade.side === "B" ? "BUY" : "SELL",
          tradeTime: trade.tradeTime,
          currency: trade.currency,
          rate: trade.rate,
          volume: trade.volume,
          price: priceN,
          fee: trade.fee,
          cash,
          newVolume,
          nav,
          invested,
          investedSymbol,
          cashChangeSymbol: cashChange,
          realized: toNumLocal(symbolRealized[symbol].realized)
        });
        break;
      case "31":
      case "20":
        const rate = trade.rate || 1.0;
        const cashPut =  trade.price* rate
          console.log('CASHPUT',trade.tradeTime,trade.price, rate,'=', cashPut, '+',cash );
        cash += cashPut
      /*    priceToBaseCurrency(
            trade.price,
            trade.tradeTime,
            trade.currency,
            portfolio.currency,
          ) || 0;*/
        nav += cashPut;
        rows.push({
          operation: "PUT",
          tradeTime: trade.tradeTime,
          currency: trade.currency,
          rate,
          invested,
          cash,
          nav,
        });
    }
  }
  let { inv, notTradeChanges } = addNotTradesItems(
    currentDay,
    portfolio.currency,
    tradedSymbols,
    oldPortfolio,
  );
  notTradeChanges.forEach((t) => rows.push(t));
  days.push({
    date: currentDay,
    invested: toNumLocal(invested + inv),
    investedWithoutTrades: toNumLocal(inv),
    cash:  toNumLocal(cash),
    nav: toNumLocal(nav + inv),
   // realized= allSymbols.reduce((sum,symbol) => sum + symbolRealized[symbol].realized, 0);

  });
  Object.keys(oldPortfolio).map((p) => {
    const pi = oldPortfolio[p] as Trade;
    if (pi.volume === 0) {
      delete oldPortfolio[p];
    }
  });


  if (lastDay > currentDay) {
    currentDay = moment(currentDay,formatYMD).add(1, 'days').format(formatYMD)
    while (currentDay<=lastDay) {

      let {inv, notTradeChanges} = addNotTradesItems(
          currentDay,
          portfolio.currency,
          [],
          oldPortfolio,
      );
      notTradeChanges.forEach((t) => rows.push(t));
      days.push({
        date: currentDay,
        investedWithoutTrades: toNumLocal(inv),
        invested: toNumLocal(inv),
        cash: toNumLocal(cash),
        nav: toNumLocal(inv + cash),
      });
      currentDay = moment(currentDay,formatYMD).add(1, 'day').format(formatYMD)
    }
  }

  const result = {};

  if (from) {
    const fromDate  = from.split('T').shift() as string;
    return {
      days: days.filter((d) => d.date >= fromDate),
      ...(withDetail && {
        rows: rows.filter(
          (d: { tradeTime?: string }) => (d.tradeTime as string) >= from,
        ),
      }),
    };
  }
  if (sample) {
      days = resampleByTradeTime(days as TradeTimeItem[], sample )
  }
  return { days, ...(withDetail && { details: rows }) };
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
        const price = toNum({n : getDateSymbolPrice(currentDay, symbol) as number});
        const rate = getRate(pi.currency, portfolioCurrency, currentDay);
        if (!price || !rate) {
          throw `No price=${price}|rate=${rate} ${symbol} ${currentDay}`;
          return 0;
        }
        const investedSymbol = rate * pi.volume * price;
        changes.push({
          currentDay,
          symbol,
          currency: pi.currency,
          price,
          rate,
          volume: pi.volume,
          investedSymbol,
        });

        return sum + rate * pi.volume * price;
      }, 0);
  }
  return { inv, notTradeChanges: changes };
}

interface TradeTimeItem {
  date: string;
}
function resampleByTradeTime(data: TradeTimeItem[], step: string): TradeTimeItem[] {
  // Check the step parameter
  let stepDuration: moment.unitOfTime.DurationConstructor;
  switch (step) {
    case 'day':
    case '1':
      stepDuration = 'days';
      break;
    case 'week':
    case '2':
      stepDuration = 'weeks';
      break;
    case 'month':
    case '3':
      stepDuration = 'months';
      break;
    default:
      return data;
  }

  // Group the data by the resampled time periods
  const resampled = data.reduce((acc: { [key: string]: TradeTimeItem }, curr: TradeTimeItem) => {
    const tradeTime: Moment = moment(curr.date);
    const resampledTime: string = tradeTime.startOf(stepDuration).format('YYYY-MM-DD');

    if (!acc[resampledTime]) {
      acc[resampledTime] = {
        ...curr
      };
    }
    return acc;
  }, {});

  // Convert the object to an array
  return Object.values(resampled);
}
