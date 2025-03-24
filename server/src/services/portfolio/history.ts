import { Trade } from "../../types/trade";

import {
  checkPortfolioPricesCurrencies,
  checkPrices, fillDateHistoryFromTrades,
  getDatePrices,
  getDateSymbolPrice,
  getRate,
  priceToBaseCurrency,
} from "../../services/app/priceCashe";


import moment, { Moment, weekdaysShort } from "moment";
import { errorMsgs, formatYMD } from "../../constants";
import {
  getModelInstanceByIDorName,
  isValidDateFormat,
  toNum,
} from "../../utils";
import { getPortfolioTrades } from "../../utils/portfolio";
import { RealizedData } from "../../services/portfolio/positions";
import {
  checkAccessByRole,
  getPortfolioInstanceByIDorName,
} from "../../services/portfolio/helper";
import { UserData } from "../../services/websocket";


export type DayType = {
  date: string;
  invested: number,
  investedWithoutTrades: number,
  cash: number,
  nav: number,
  index: number,
  perfomance: number;
  shares: number;
  navShare: number;
  perfShare: number;
}

type Params = {
  _id: string;
  from?: string;
  till?: string;
  detail: string; //0|1
  sample: string;
  precision: number;
};

function getSymbolReturnFunc(symbol: string, invest: number) {
  let prevPrice: number | null = null;
  let ret = invest;
  return (date: string) => {
    const newPrice = getDateSymbolPrice(date, symbol);
    if (prevPrice && newPrice) {
      ret += newPrice - prevPrice;
     // console.log(symbol, date, prevPrice, newPrice, newPrice - prevPrice, ret);
      prevPrice = newPrice;
      return ret;
    } else {
      console.log(symbol, date, newPrice, ret);
      prevPrice = newPrice;
      return ret;
    }
  };
}

export async function history(
  { _id, from, till, detail = "0", sample, precision = 2 }: Params,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<{}> {
  try {
    if (!_id) {
      return { error: "Portolio _id is required" };
    }

    const toNumLocal = (n: number) => toNum({ n, precision });

    const {
      _id: realId,
      error,
      instance: portfolio,
    } = await getPortfolioInstanceByIDorName(_id, userData);
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
  switch (sample) {
    case "1":
    case "day":
      sample = "day";
      break;
    case "2":
    case "week":
      sample = "week";
      break;
    case "3":
    case "month":
      sample = "month";
      break;
    default:
      sample = "";
  }

  const allTrades = await getPortfolioTrades(realId, from, {
    state: { $in: ["1"] },
    ...(till && { tradeTime: { $lt: till } }),
  });
  if ((allTrades as { error: string }).error) {
    return allTrades as { error: string };
  }
  const trades = allTrades as Trade[];

  //console.log('allTrades', allTrades)
  const withDetail = Number(detail) !== 0;
  if (trades.length <= 0) {
    return { days: [], ...(withDetail && { rows: [] }) };
  }

  const { startDate, endDate, uniqueSymbols, uniqueCurrencies, withoutPrices } =
    await checkPortfolioPricesCurrencies(trades, portfolio.currency);
  console.log("PSTART", startDate, endDate, uniqueSymbols, uniqueCurrencies, withoutPrices);
  const lastDay = till.split("T")[0];
  let currentDay = startDate.split("T")[0]
  try {
    await checkPrices(
        [portfolio.baseInstrument],
        moment(currentDay, formatYMD).add(-5, "day").format(formatYMD),
    );
  } catch(err) {
   console.log('ERR:',err)
  }
  if (withoutPrices.length > 0) {

    await fillDateHistoryFromTrades(trades, withoutPrices, endDate)
  }
  const symbolRealized: Record<string, RealizedData> = {};

  const oldPortfolio: Record<string, Partial<Trade> | {}> = {};
  let cash = 0;
  let invested = 0;
  let tradedSymbols: string[] = [];
  let days:DayType[] = [];
  const rows = [];
  let nav = 0;
  let totalRealized = 0;
  let perfomanceAcc=0;
  let shares = 0;
  let cashChanged:string[]= []

  const pushDay = (currentDay:string, isNotTradedDate:boolean,  inv:number, invested: number =0) => {
    const navDay = isNotTradedDate ? inv + cash : nav + inv
    const isFirst = days.length===0
    
    // Prevent division by zero
    if (shares === 0) {
      shares = 1; // Default to 1 share if none exist
      console.warn(`No shares found for ${currentDay}, defaulting to 1 share`);
    }
    
    const navShare = navDay / shares
    console.log(currentDay, isNotTradedDate , inv , cash , nav,'|', navDay,'|',invested);
    days.push({
      date: currentDay,
      invested: toNumLocal(invested + inv),
      investedWithoutTrades: toNumLocal(inv),
      cash,
      nav: toNumLocal(navDay),
      index: symbolReturnFunc(currentDay),
      perfomance: perfomanceAcc,
      shares,
      navShare: toNumLocal(navShare),
      perfShare: isFirst ? 100 : toNumLocal(100 * navShare/ days[0].navShare)
    });
  }


let symbolReturnFunc: (date: string) => number = (s) => 0;
function setSymbolRealized(symbol: string, trade: Trade, oldVolume: number) {
  if (!symbolRealized[symbol]) {
    symbolRealized[symbol] = { totalCost: 0, realized: 0 };
  }
  if (trade.side === "B") {
    symbolRealized[symbol].totalCost += toNum({
      n: trade.price * trade.rate * trade.volume,
    });
  } else {
    const avgPrice = oldVolume
      ? symbolRealized[symbol].totalCost / oldVolume
      : 0;
    const realizedPnL = (trade.price * trade.rate - avgPrice) * trade.volume;
    symbolRealized[symbol].realized += realizedPnL;
    symbolRealized[symbol].totalCost -= avgPrice * trade.volume;
  }
  // console.log('RRRRRRRRRRR', trade.tradeTime, symbol, symbolRealized[symbol], '|', trade.side, oldVolume,  '|', trade.volume, trade.price, trade.rate);
}

for (const trade of trades) {
  if (!trade.tradeTime.includes(currentDay)) {
    if (currentDay === startDate.split("T")[0]) {
      //cree
      symbolReturnFunc = getSymbolReturnFunc(portfolio.baseInstrument, nav);
    }
    const nextCurrentDayWithTrade = trade.tradeTime.split("T")[0];

    ///process as not trades all till nextCurrentDayWithTrade
    while (currentDay < nextCurrentDayWithTrade) {
      const isNotTradedDate = tradedSymbols.length === 0;
  //    console.log('isNotTradedDate', isNotTradedDate, tradedSymbols.length);
      let { inv, notTradeChanges, perfomance } = addNotTradesItems(
        currentDay,
        portfolio.currency,
        tradedSymbols,
        oldPortfolio,

      );
      perfomanceAcc+=perfomance;
      notTradeChanges.forEach((t) => rows.push(t));

      pushDay(currentDay,isNotTradedDate, inv, invested);
      currentDay = moment(currentDay, formatYMD)
        .add(1, "day")
        .format(formatYMD);
      invested = 0;
      tradedSymbols = [];
      if (!sample) break;
    }

    //->
    currentDay = nextCurrentDayWithTrade; // trade.tradeTime.split("T")[0];
    Object.keys(oldPortfolio).map((p) => {
      const pi = oldPortfolio[p] as Trade;
      if (pi.volume === 0) {
        delete oldPortfolio[p];
      }
    });
  }
  const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
  let dividendPerShareVol =1;

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
      const oldVolume = (oldPortfolio[symbol] as Trade).volume;
      let newVolume = oldVolume - dir * trade.volume;
      const priceN = toNum({ n: trade.price });
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
      setSymbolRealized(symbol, trade, oldVolume); //--
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
        realized: toNumLocal(symbolRealized[symbol].realized),
      });
      break;

    case "20"://Dividends = "20",
      dividendPerShareVol = (oldPortfolio[trade.symbol] as Trade)?.volume || 1;
    case "31":
    case "21":
      if (trade.shares)
        shares+=trade.shares;
      else
        shares+=1
    case "22":
      const rate = trade.rate || 1.0;
      const cashPut = trade.price * rate*dividendPerShareVol;


      cash += cashPut;
      nav += cashPut;
      cashChanged.push(currentDay);
      rows.push({
        operation: "PUT",
        tradeTime: trade.tradeTime,
        currency: trade.currency,
        shares:trade.shares,
        rate,
        invested,
        cash,
        nav,
      });
  }
}
// Skip weekends and holidays where prices might be missing
const dayOfWeek = moment(currentDay).isoWeekday();
if (dayOfWeek === 6 || dayOfWeek === 7) {
  console.log(`Skipping weekend day ${currentDay}`);
  // Skip this day
} else {
  let inv = 0;
  let notTradeChanges: any[] = [];
  let perfomance = 0;

  try {
    ({ inv, notTradeChanges, perfomance } = addNotTradesItems(
      currentDay,
      portfolio.currency,
      tradedSymbols,
      oldPortfolio,
    ));
    
    // Only add the day if there were no errors
    perfomanceAcc += perfomance;
    notTradeChanges.forEach((t) => rows.push(t));
    pushDay(currentDay, cashChanged.includes(currentDay), inv, invested);
  } catch (err) {
    console.error(`Error in addNotTradesItems for ${currentDay}:`, err);
    // Skip this day
  }
}

  Object.keys(oldPortfolio).map((p) => {
    const pi = oldPortfolio[p] as Trade;
    if (pi.volume === 0) {
      delete oldPortfolio[p];
    }
  });

  if (lastDay > currentDay) {
    currentDay = moment(currentDay, formatYMD).add(1, "days").format(formatYMD);
    while (currentDay <= lastDay) {
      // Skip weekends and holidays where prices might be missing
      const dayOfWeek = moment(currentDay).isoWeekday();
      if (dayOfWeek === 6 || dayOfWeek === 7) {
        console.log(`Skipping weekend day ${currentDay}`);
        // Skip this day
      } else {
        let inv = 0;
        let notTradeChanges: any[] = [];
        let perfomance = 0;
        
        try {
          ({ inv, notTradeChanges, perfomance } = addNotTradesItems(
            currentDay,
            portfolio.currency,
            [],
            oldPortfolio,
          ));
          
          // Only add the day if there were no errors
          perfomanceAcc += perfomance;
          notTradeChanges.forEach((t) => rows.push(t));
          pushDay(currentDay, true, inv, 0);
        } catch (err) {
          console.error(`Error in addNotTradesItems for ${currentDay}:`, err);
          // Skip this day
        }
      }
      currentDay = moment(currentDay, formatYMD)
        .add(1, "day")
        .format(formatYMD);
    }
  }

  //const perfomance=calculatePerfomance(days);
  const result = {};

  if (from) {
    const fromDate = from.split("T").shift() as string;
    const filteredRows = Boolean(from) ? rows.filter(
        (d: { tradeTime?: string }) => (d.tradeTime as string) >= (from || '')
    ) : rows;
    return {
      days: days.filter((d) => d.date >= fromDate),
      ...(withDetail && {
        rows: filteredRows,
      }),
    };
  }
  if (sample) {
    days = resampleByTradeTime(days, sample);
  }
  //console.log("DAYS", days);
  return { ...(withoutPrices.length > 0  && {info:`Used trades for inerpolate prices/rates: ${withoutPrices.join(',')}`}), days, ...(withDetail && { details: rows }) };
  } catch (err) {
    console.error("Error in history function:", err);
    // Return an empty result to avoid breaking the client
    return { days: [], info: `Error processing history: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function getPortfolioPerfomance(
  currentDay: string,
  portfolioCurrency: string,
  oldPortfolio: Record<string, Partial<Trade>>,
) {
  let sum = 0;
  let sumInvested = 0;
  const beforeDay = moment(currentDay, formatYMD)
    .add(-1, "day")
    .format(formatYMD);
  Object.keys(oldPortfolio).forEach((symbol: string) => {
    const pi = oldPortfolio[symbol] as Trade;
    let price = toNum({
      n: getDateSymbolPrice(currentDay, symbol) as number,
    });
    let rate = getRate(pi.currency, portfolioCurrency, currentDay);
    let priceBefore = toNum({
      n: getDateSymbolPrice(beforeDay, symbol) as number,
    });
    let rateBefore = getRate(pi.currency, portfolioCurrency, beforeDay);
    
    // Handle missing prices or rates
    if (!price || !rate || !priceBefore || !rateBefore) {
      // Try to get last available price if current price is missing
      if (!price) {
        const dates = getDatePrices(symbol);
        if (dates) {
          const lastDate = Object.keys(dates).sort().reverse().find((date: string) => moment(date).isBefore(moment(currentDay)));
          if (lastDate) {
            price = toNum({ n: dates[lastDate] });
            console.warn(`Using last available price for ${symbol} on ${currentDay}: lastDate=${lastDate}, price=${price}`);
          }
        }
      }
      
      // Try to get last available price if previous day price is missing
      if (!priceBefore) {
        const dates = getDatePrices(symbol);
        if (dates) {
          const lastDate = Object.keys(dates).sort().reverse().find((date: string) => moment(date).isBefore(moment(beforeDay)));
          if (lastDate) {
            priceBefore = toNum({ n: dates[lastDate] });
            console.warn(`Using last available price for ${symbol} on ${beforeDay}: lastDate=${lastDate}, price=${priceBefore}`);
          }
        }
      }
      
      // If still missing prices or rates, skip this symbol
      if (!price || !rate || !priceBefore || !rateBefore) {
        console.warn(`Skipping performance calculation for ${symbol} due to missing price or rate`);
        return; // Skip this iteration
      }
    }
    
    sum += (price * rate - priceBefore * rateBefore) * pi.volume;
    sumInvested += priceBefore * rateBefore * pi.volume;
  });
  return sumInvested>0 ?  Math.round((10000 * sum) / sumInvested) / 100 : 0;
}

function addNotTradesItems(
  currentDay: string,
  portfolioCurrency: string,
  tradedSymbols: String[],
  oldPortfolio: Record<string, Partial<Trade>>,
) {
  let inv = 0;
  const changes: object[] = [];
  // Check if the current day is a weekend
  const dayOfWeek = moment(currentDay).isoWeekday();
  const isWeekend = dayOfWeek === 6 || dayOfWeek === 7; // 6 = Saturday, 7 = Sunday
  
  if (isWeekend) {
    console.log(`Skipping calculations for weekend day ${currentDay}`);
    return { inv: 0, notTradeChanges: [], perfomance: 0 };
  }

  if (tradedSymbols.length < Object.keys(oldPortfolio).length) {
    inv = Object.keys(oldPortfolio)
      .filter((k) => !tradedSymbols.includes(k))
      .reduce((sum, symbol) => {
        const pi = oldPortfolio[symbol] as Trade;
        const rate = getRate(pi.currency, portfolioCurrency, currentDay);
        let price = toNum({
          n: getDateSymbolPrice(currentDay, symbol) as number,
        });

        if (!price) {
          const dates = getDatePrices(symbol);
          if (dates) {
            const lastDate = Object.keys(dates).sort().reverse().find((date: string) => moment(date).isBefore(moment(currentDay)));
            if (lastDate) {
              price = toNum({ n: dates[lastDate] });
              const twoDaysAgo = moment(currentDay, formatYMD).subtract(2, 'days');
              if (moment(lastDate).isBefore(twoDaysAgo)) {
                console.warn(`Using a price more than 2 days old for ${symbol} on ${currentDay}: lastDate=${lastDate}, price=${price}`);
                // If it's Monday and the last price is from Friday, use the last price
                if (moment(currentDay).isoWeekday() === 1 && moment(lastDate).isoWeekday() === 5) {
                  console.warn(`Using Friday's price for Monday for ${symbol}`);
                }
              }
            }
          }
          
          // Try FX fallback if still no price
          if (!price && symbol.endsWith(':FX')) {
            price = toNum({
              n: getDateSymbolPrice(currentDay, symbol.split(':').shift() as string) as number,
            });
          }
        }


        if (!price || !rate) {
          console.warn(`No price=${price}|rate=${rate} ${symbol} ${currentDay} ${pi.currency} - skipping`);
          return sum;
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
  let perfomance = 0;
  try {
    perfomance = getPortfolioPerfomance(
      currentDay,
      portfolioCurrency,
      oldPortfolio,
    );
  } catch (err) {
    console.error(`Error in getPortfolioPerfomance for ${currentDay}:`, err);
    // Continue with default value of 0 for perfomance
  }
  return { inv, notTradeChanges: changes, perfomance };
}


function resampleByTradeTime(
  data: DayType[],
  step: string,
): DayType[] {
  // Check the step parameter
  let stepDuration: moment.unitOfTime.DurationConstructor;
  switch (step) {
    case "day":
    case "1":
      stepDuration = "days";
      break;
    case "week":
    case "2":
      stepDuration = "weeks";
      break;
    case "month":
    case "3":
      stepDuration = "months";
      break;
    default:
      return data;
  }

  // Group the data by the resampled time periods
  const resampled = data.reduce(
    (acc: { [key: string]: DayType }, curr: DayType) => {
      const tradeTime: Moment = moment(curr.date);
      const resampledTime: string = tradeTime
        .startOf(stepDuration)
        .format("YYYY-MM-DD");

      if (!acc[resampledTime]) {
        acc[resampledTime] = {
          ...curr,
        };
      }
      return acc;
    },
    {},
  );

  // Convert the object to an array
  return Object.values(resampled);
}
