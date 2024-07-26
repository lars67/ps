import moment from "moment";
import { fetchHistory, loadCompany } from "../../utils/fetchData";

import { StringRecord } from "../../types/other";

import { Trade } from "../../types/trade";
import {
  extractUniqueFields,
  findMaxByField,
  findMinByField,
  removeDuplicatesByProperty,
} from "../../utils";
import { formatYMD } from "../../constants";

export type PricePoint = {
  date: string;
  [key: string]: number | string;
};

const dateHistory: Record<string, Record<string, number>> = {};
const histories: StringRecord = {};
const SEARCH_DAY = 10;

async function delay(n: number) {
  return new Promise((res: Function) => {
    setTimeout(() => {
      res();
    }, n);
  });
}

export async function checkPrices(
  portfolioSymbols: string[],
  startDate0: Date | string,
  maxConcurrentRequests = 10,
  delayBetweenBatches = 500,
) {
  let isSended = 0;
  const startDate =
    typeof startDate0 === "string"
      ? startDate0
      : moment(startDate0 as Date).format(formatYMD);
  const withoutPrices = [] as string[];
  try {
    for (const symbol of portfolioSymbols) {
      if (!histories[symbol] || histories[symbol] > startDate) {
        // console.log("fetchHistory", symbol);
        const history = await fetchHistory({ symbol, from: startDate });
   //     console.log(symbol, history);
        if (history.length === 0) {
          withoutPrices.push(symbol);
        }
        //console.log("/fetchHistory", symbol);
        histories[symbol] = startDate;
        for (const h of history) {
          const { date, close } = h;
          if (!dateHistory[date]) {
            dateHistory[date] = { [symbol]: close };
          } else {
            dateHistory[date][symbol] = close;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in checkPrices:", error);
    throw error;
  }
  return withoutPrices;
}

export const getSymbolPrices = (symbol: string) => {
  const prices = Object.keys(dateHistory)
    .sort()
    .map((d) => dateHistory[d][symbol]);
  return prices;
};

export function fillDateHistoryFromTrades(
  trades: Pick<Trade, "symbol" | "price" | "tradeTime">[],
  symbols: string[],
  endDate: string,
) {
  // console.log('interpolate price from trades for ', symbols, trades.map(t=>t.symbol));
  for (const symbol of symbols) {
    const isFX = symbol.endsWith(":FX");
    let symbolInTrade = symbol;
    let currencyKey, currencyKey2;
    if (isFX) {
      const tcount1 = trades.filter((t) => t.symbol === symbol).length;
      const symbol2 = symbol.replace(/(\w{3})(\w{3})(:)(\w+)/, '$2$1$3$4');

      const tcount2 = trades.filter((t) => t.symbol === symbol2).length;
      if (tcount1 === 0 && tcount2 > 0) {
        symbolInTrade = symbol2;
      }
      currencyKey = symbol.split(":").shift();
      currencyKey2 = symbol2.split(":").shift();
      console.log(
        "symbol, tcount1, symbol2, tcount2",
        symbol,
        tcount1,
        symbol2,
        tcount2,
        "|",
        symbolInTrade,
        currencyKey,
          currencyKey2
      );
    }
    let tradesSymbol = trades
      .filter((t) => t.symbol === symbolInTrade)
      .map((t) => ({
        ...t,
        tradeDate: t.tradeTime.split("T").shift() as string,
      }))
      .sort((a, b) => moment(a.tradeTime).diff(moment(b.tradeTime)));
    //console.log('tradesSymbol', tradesSymbol);
    tradesSymbol = removeDuplicatesByProperty(tradesSymbol, "tradeDate");
    //console.log("tradesSymbol without dubl", tradesSymbol);
    let prevTrade = null;
    let prevTradeDate = null;
    let prevTradeDatePrice = 0;
    for (const trade of tradesSymbol) {
      const tradeDate = moment(trade.tradeDate);
      const date = trade.tradeDate;
      const price = symbolInTrade === symbol ? trade.price : 1 / trade.price;
      if (!prevTrade) {
        if (!dateHistory[date]) {
          dateHistory[date] = {
            [symbol]: price,
            ...(currencyKey && { [currencyKey]: price }),
            ...(currencyKey2 && { [currencyKey2]: 1/price }),
          };
        } else {
          dateHistory[date][symbol] = price;
          currencyKey && (dateHistory[date][currencyKey] = price);
         (currencyKey2 && !dateHistory[date][currencyKey2]) && (dateHistory[date][currencyKey2] = 1/price);

        }

        //console.log(symbol, date, '::', trade.price);
      } else {
        // Interpolate values between the previous trade and the current trade
        const prevDate = moment(prevTradeDate);
        const daysDiff = tradeDate.diff(prevDate, "days");

        for (let i = 1; i < daysDiff; i++) {
          const interpolatedDate = prevDate
            .clone()
            .add(i, "days")
            .format("YYYY-MM-DD");
          const interpolatedPrice =
            prevTradeDatePrice + (price - prevTradeDatePrice) * (i / daysDiff);
           dateHistory[interpolatedDate] = {
            ...dateHistory[interpolatedDate],
            [symbol]: interpolatedPrice,
            ...(currencyKey && { [currencyKey]: interpolatedPrice }),
            ...((currencyKey2 && !dateHistory[interpolatedDate][currencyKey2]) && {[currencyKey2] :1/interpolatedPrice})

        };
          //console.log(interpolatedDate, ':-:', interpolatedClose);
        }

        // Add the current trade to dateHistory
        dateHistory[trade.tradeDate] = {
          ...dateHistory[trade.tradeDate],
          [symbol]: price,
          ...(currencyKey && { [currencyKey]: price }),
          ...((currencyKey2 && !dateHistory[trade.tradeDate][currencyKey2]) && {[currencyKey2] :1/price})
        };
        //console.log(trade.tradeDate, '::', trade.price);
      }

      prevTrade = trade;
      prevTradeDate = date;
      prevTradeDatePrice = price;
    }

    // Interpolate values from the last trade to the endDate
    if (prevTrade) {
      const lastDate = moment(prevTrade.tradeTime);
      const daysDiff = moment(endDate).diff(lastDate, "days");

      for (let i = 1; i <= daysDiff; i++) {
        const interpolatedDate = lastDate
          .clone()
          .add(i, "days")
          .format("YYYY-MM-DD");
        if(!dateHistory[interpolatedDate]) {
          dateHistory[interpolatedDate]= {}
        }
       // console.log('interpolatedDate', interpolatedDate, dateHistory[interpolatedDate]);
        dateHistory[interpolatedDate] = {
          ...dateHistory[interpolatedDate],
          [symbol]: prevTradeDatePrice,
          ...(currencyKey && { [currencyKey]: prevTradeDatePrice }),
          ...((currencyKey2 && !dateHistory[interpolatedDate][currencyKey2]) && {[currencyKey2] :1/prevTradeDatePrice})

        };
        //console.log(interpolatedDate, ':', prevTrade.price);
      }
    }
    //console.log(symbol, getSymbolPrices(symbol));
  }

  return getSymbolPrices(symbols[0]);
}
export function getDatePrices(date: string, find: boolean = false) {
  if (dateHistory[date]) {
    return dateHistory[date];
  }
  if (find) {
    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
      prevDate = prevDate.add(-1, "days");
      if (dateHistory[prevDate.format(formatYMD)]) {
        return dateHistory[prevDate.format(formatYMD)];
      }
    }
  }
  return null;
}
export function getDateSymbolPrice(dateInput: string, symbol: string) {
  const date = dateInput.split("T").shift() as string;
  if (dateHistory[date] && dateHistory[date][symbol]) {
    return dateHistory[date][symbol];
  }

  let prevDate = moment(date, formatYMD);
  for (let i = 1; i < SEARCH_DAY; i++) {
    prevDate = prevDate.add(-1, "days");
    const d = prevDate.format(formatYMD);
    if (dateHistory[d] && dateHistory[d][symbol]) {
      return dateHistory[d][symbol];
    }
  }

  return null;
}

export function getDatesSymbols(
  symbols: string[],
  from: string,
  till?: string,
): PricePoint[] {
  let date = from.split("T").shift() as string;
  const dateLast = till?.split("T").shift() || moment().format(formatYMD);
  const prices = [];
  while (date < dateLast) {
    const datePrice: Record<string, number> = {};
    symbols.forEach((symbol) => {
      if (dateHistory[date] && dateHistory[date][symbol]) {
        datePrice[symbol] = dateHistory[date][symbol];
      }
    });
    prices.push({ date, ...datePrice });
    date = moment(date, formatYMD).add(1, "days").format(formatYMD);
  }
  return prices;
}

export async function checkPriceCurrency(
  currency: string,
  balanceCurrency: string,
  startDateInput: string,
) {
  const startDateInputM = moment(
    startDateInput.split("T").shift() as string,
    formatYMD,
  );

  const addFXHistory = async (fx: string, startDate: string) => {
    let history = await fetchHistory({
      symbol: `${fx}:FX`,
      from: startDate,
    });
    if (history.length > 0) {
      histories[fx] = history[0].date;
      // console.log('remember', symbol, history.length);
      history.map((h) => {
        const { date, close } = h;
        if (dateHistory[date]) {
          dateHistory[date][fx] = close;
        } else {
          dateHistory[date] = { [fx]: close };
        }
      });
      return true;
    }
    return false;
  };

  const startDate = startDateInputM.add(-7, "days").format(formatYMD);
  let badSymbol='';
  if (balanceCurrency !== currency) {
    let symbol: string = "";
    let fx = `${currency}${balanceCurrency}`;
    let fx2 = `${balanceCurrency}${currency}`;
    if (histories[fx]) {
      if (histories[fx] <= startDate) {
        return;
      }
    } else if (histories[fx2]) {
      if (histories[fx2] <= startDate) {
        return;
      }
    }
    const addedFX = await addFXHistory(fx, startDate);
    const addedFX2 = await addFXHistory(fx2, startDate);
    if (currency==='CNH' || (!addedFX && !addedFX2)) {
      console.log(`FX price absent for ${fx} ${fx2} !!!!!!!!!!`);
      badSymbol= `${fx}:FX`
    }
    return badSymbol;
  }
}

export async function checkPortfolioPricesCurrencies(
  trades: Trade[],
  balanceCurrency: string,
  baseInstrument?: string,
) {
  const withoutPrices = [] as string[];
  const uniqueSymbols = extractUniqueFields(trades, "symbol");
  if (baseInstrument && !uniqueSymbols.includes(baseInstrument)) {
    uniqueSymbols.push(baseInstrument);
  }
  const uniqueCurrencies = extractUniqueFields(trades, "currency");
  //  console.log('TRADES', trades)
  const startDate = findMinByField<Trade>(trades, "tradeTime").tradeTime.split(
    "T",
  )[0];
  const endDate = findMaxByField<Trade>(trades, "tradeTime").tradeTime.split(
    "T",
  )[0];
  console.log("checkPortfolioPricesCurrencies startDate", startDate, endDate);
  withoutPrices.push(...(await checkPrices(uniqueSymbols, startDate)));
  console.log("checkPriceCurrency");
  for (const currency of uniqueCurrencies) {
    const r = await checkPriceCurrency(currency, balanceCurrency, startDate);
    if (r) {
      withoutPrices.push(r);
    }
  }
  console.log("/checkPortfolioPricesCurrencies");
  return { startDate, endDate, uniqueSymbols, uniqueCurrencies, withoutPrices };
}

export const priceToBaseCurrency = (
  price: number,
  date: string,
  currency: string,
  balanceCurrency: string,
) => {
  if (currency === balanceCurrency) {
    return price;
  }
  if (dateHistory[date]) {
    const rate = dateHistory[date][`${currency}${balanceCurrency}`]
      ? dateHistory[date][`${currency}${balanceCurrency}`]
      : 1 / dateHistory[date][`${balanceCurrency}${currency}`];
    if (rate) {
      return rate * price;
    } else {
      console.log(
        "!!!!!!!!!!!!!!!!!!!!rate",
        rate,
        date,
        currency,
        balanceCurrency,
        price,
      );
    }
  }
  return null;
};

export const getRate = (
  currency: string,
  balanceCurrency: string,
  date: string,
) => {
  if (currency === balanceCurrency) {
    return 1;
  }
  //date = date.split('T')[0];
  //console.log(date,dateHistory[date])
  const rate1 = getDateSymbolPrice(date, `${currency}${balanceCurrency}`);
  const rate2 = getDateSymbolPrice(date, `${balanceCurrency}${currency}`);
  const r = rate1 ? rate1 : rate2 ? 1 / rate2 : 0;
  //console.log(`RATES '${currency}${balanceCurrency}' '${date}'`, rate1, rate2, '=>', r)
  return Number(r.toFixed(4));
};

/*
export function findSymbolDatePrices(date, symbol) {
    if (dateHistory[date] && dateHistory[date][symbol]) {
        return dateHistory[date][symbol];
    }
    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
        prevDate = prevDate.add(-1, 'days');
        const dh = dateHistory[prevDate.format(formatYMD)];
        if (dh && dh[symbol]) {
            return dh[symbol];
        }
    }
    return null;
}
*/
