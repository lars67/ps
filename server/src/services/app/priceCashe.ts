import moment from "moment";

import { fetchHistory, loadCompany } from "../../utils/fetchData";

import { StringRecord } from "../../types/other";

import { Trade } from "../../types/trade";
import {
  extractUniqueFields,
  findMaxByField,
  findMinByField,
  fxCurrency,
  isPenceQuoted,
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

export function clearCaches() {
  Object.keys(dateHistory).forEach(key => delete dateHistory[key]);
  Object.keys(histories).forEach(key => delete histories[key]);
  console.log('Price caches cleared');
}

async function delay(n: number) {
  return new Promise((res: Function) => {
    setTimeout(() => {
      res();
    }, n);
  });
}

async function checkPriceForSymbol(
  symbol: string,
  startDate: string,
  nowStr: string,
  forceRefresh: boolean,
  withoutPrices: string[],
) {
  const endKey = symbol + '_end';
  const needFullFetch = forceRefresh || !histories[symbol] || histories[symbol] > startDate;
  // Also do an incremental top-up if the cached data doesn't reach today
  const needTopUp = !needFullFetch && histories[endKey] && histories[endKey] < nowStr;

  if (needFullFetch) {
    console.log("fetchHistory", symbol, startDate, forceRefresh ? "(force refresh)" : "");
    const history = await fetchHistory({ symbol, from: startDate });
    if (history.length === 0) {
      // Don't latch histories[symbol] here - an empty result (transient fetch failure,
      // or a symbol not yet in any local cache) must not be remembered as "already
      // fetched", or this symbol would never be retried again for the life of the
      // process (histories[endKey] never gets set below, so needTopUp never fires).
      withoutPrices.push(symbol);
      return;
    }
    histories[symbol] = startDate;
    for (const h of history) {
      const { date, close } = h;
      if (!dateHistory[date]) {
        dateHistory[date] = { [symbol]: close };
      } else {
        dateHistory[date][symbol] = close;
      }
    }
    if (history.length > 0) {
      histories[endKey] = history[history.length - 1].date;
    }
  } else if (needTopUp) {
    // Fetch only the missing recent window (from day after last cached date)
    const topUpFrom = moment(histories[endKey]).add(1, 'day').format(formatYMD);
    console.log("fetchHistory top-up", symbol, topUpFrom);
    const history = await fetchHistory({ symbol, from: topUpFrom });
    for (const h of history) {
      const { date, close } = h;
      if (!dateHistory[date]) {
        dateHistory[date] = { [symbol]: close };
      } else {
        dateHistory[date][symbol] = close;
      }
    }
    if (history.length > 0) {
      histories[endKey] = history[history.length - 1].date;
    }
  }
}

export async function checkPrices(
  portfolioSymbols: string[],
  startDate0: Date | string,
  maxConcurrentRequests = 10,
  delayBetweenBatches = 500,
  forceRefresh = false,
) {
  const startDate =
    typeof startDate0 === "string"
      ? startDate0
      : moment(startDate0 as Date).format(formatYMD);
  const withoutPrices = [] as string[];
  const nowStr = moment().format(formatYMD);
  try {
    // Batched-concurrent, not fully sequential: with 20-30+ holdings, one-at-a-time
    // fetching routinely blew through callers' time budgets before reaching every
    // symbol (positions.ts's fallback times out at 2.5s - confirmed in production
    // 2026-08-31: Vibeke Holst's portfolio left the LAST few symbols in the list
    // permanently unpriced, every single request, purely because of list order).
    // maxConcurrentRequests/delayBetweenBatches were already part of this function's
    // signature but never used - this is what they were for.
    for (let i = 0; i < portfolioSymbols.length; i += maxConcurrentRequests) {
      const batch = portfolioSymbols.slice(i, i + maxConcurrentRequests);
      await Promise.all(
        batch.map((symbol) => checkPriceForSymbol(symbol, startDate, nowStr, forceRefresh, withoutPrices)),
      );
      if (i + maxConcurrentRequests < portfolioSymbols.length) {
        await delay(delayBetweenBatches);
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
// Last-resort lookup for a symbol that has no price within getDateSymbolPrice's normal
// SEARCH_DAY window - a genuinely delisted/acquired stock (e.g. IPG:XNYS, acquired by
// Omnicom Nov 2025) or one no provider covers well (e.g. a thin Nordic small-cap) can have
// real cached history that's simply older than that window. Callers MUST treat a hit here
// as stale and label it accordingly (never blend it in as if it were a live/recent price) -
// that's the whole point of exposing the date alongside the price.
export function getLastKnownPrice(symbolInput: string): { price: number; date: string } | null {
  const symbol = symbolInput.endsWith(':FX') ? symbolInput.split(':').shift() as string : symbolInput;
  const dates = Object.keys(dateHistory)
    .filter((d) => dateHistory[d][symbol] != null)
    .sort();
  if (dates.length === 0) return null;
  const lastDate = dates[dates.length - 1];
  return { price: dateHistory[lastDate][symbol], date: lastDate };
}

export function getDateSymbolPrice(dateInput: string, symbolInput: string) {
  const date = dateInput.split("T").shift() as string;
  const symbol =symbolInput.endsWith(':FX') ? symbolInput.split(':').shift() as string: symbolInput;
  //console.log('getDateSymbolPrice', date, symbol, dateHistory[date]);

  let price = null;
  if (dateHistory[date] && dateHistory[date][symbol]) {
    price = dateHistory[date][symbol];
  } else {
    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
      prevDate = prevDate.add(-1, "days");

      const d = prevDate.format(formatYMD);
     // console.log('i', i, symbol, prevDate,d, (dateHistory[d] && dateHistory[d][symbol]));
      if (dateHistory[d] && dateHistory[d][symbol]) {
        price = dateHistory[d][symbol];
        break;
      }
    }
  }

  return price;
}

// Get price scaled for position calculations (converts pence -> GBP for
// GBP-quoted London-listed stocks only). `currency` may be passed when known;
// otherwise isPenceQuoted falls back to the preloaded Aktia.Symbols currency map.
export function getDateSymbolPriceScaled(
  dateInput: string,
  symbolInput: string,
  currency?: string,
) {
  const price = getDateSymbolPrice(dateInput, symbolInput);

  // Only GBP-labelled London lines arrive in pence; convert those to GBP.
  if (price && isPenceQuoted(symbolInput, currency)) {
    return price / 100;
  }

  return price;
}

export function getDatesSymbols(
  symbols: string[],
  from: string,
  till?: string,
): PricePoint[] {
  let date = from.split("T").shift() as string;
  const dateLast = till?.split("T").shift() || moment().format(formatYMD);
  const prices = [];
  while (moment(date).isSameOrBefore(moment(dateLast))) { // Changed condition to include the last date
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
  currencyInput: string,
  balanceCurrencyInput: string,
  startDateInput: string,
  forceRefresh = false,
) {
  // GBX (pence) has no FX rate of its own; it shares GBP. Map before building FX pairs
  // so we never try to fetch a nonexistent GBX pair. Pence->GBP scaling is at the price level.
  const currency = fxCurrency(currencyInput);
  const balanceCurrency = fxCurrency(balanceCurrencyInput);
  const startDateInputM = moment(
    startDateInput.split("T").shift() as string,
    formatYMD,
  );

  // Returns the actual last date stored, or false if nothing was fetched
  const addFXHistory = async (fx: string, startDate: string): Promise<string | false> => {
    let history = await fetchHistory({
      symbol: `${fx}:FX`,
      from: startDate,
    });
    //console.log('addFXHistory history.length', history.length,fx, histories);
   // console.log(history[0]);
    if (history.length > 0) {
      histories[fx] = history[0].date;
      // console.log('remember', symbol, history.length);
      history.map((h,i ) => {
        const { date, close } = h;
        if (dateHistory[date]) {
          dateHistory[date][fx] = close;
          // Also store reverse rate for consistency
          if (close > 0) {
              const revFX = fx.slice(3) + fx.slice(0,3);
              dateHistory[date][revFX] = 1/close;
          }
        } else {
          dateHistory[date] = { [fx]: close };
          if (close > 0) {
              const revFX = fx.slice(3) + fx.slice(0,3);
              dateHistory[date][revFX] = 1/close;
          }
        }
     //   i <=10 && console.log(date,dateHistory[date]);
      });
      // Return the actual last date in the fetched data (may be < today if CSV is stale)
      return history[history.length - 1].date;
    }
    return false;
  };

  const startDate = startDateInputM.add(-7, "days").format(formatYMD);
  let badSymbol='';
  if (balanceCurrency !== currency) {
    let symbol: string = "";
    let fx = `${currency}${balanceCurrency}`;
    let fx2 = `${balanceCurrency}${currency}`;
    // We need to ensure we have data covering the requested start date AND recent data
    const nowStr = moment().format(formatYMD);
    if (!forceRefresh) {
      if (histories[fx] && histories[fx] <= startDate && histories[fx + '_end'] >= nowStr) {
        return;
      }
      if (histories[fx2] && histories[fx2] <= startDate && histories[fx2 + '_end'] >= nowStr) {
        return;
      }
    }
    // For re-fetches: if we already have data up to some date, only request from that date
    // forward so that readLocalCSVData returns empty and the external API fills the gap.
    const fxFetchFrom = (!forceRefresh && histories[fx + '_end'])
      ? moment(histories[fx + '_end']).add(1, 'day').format(formatYMD)
      : startDate;
    const fx2FetchFrom = (!forceRefresh && histories[fx2 + '_end'])
      ? moment(histories[fx2 + '_end']).add(1, 'day').format(formatYMD)
      : startDate;
    const addedFX = await addFXHistory(fx, fxFetchFrom);
    if (addedFX) histories[fx + '_end'] = addedFX; // actual last date, not today
    const addedFX2 = await addFXHistory(fx2, fx2FetchFrom);
    if (addedFX2) histories[fx2 + '_end'] = addedFX2; // actual last date, not today
    if (currency==='CNH' || (!addedFX && !addedFX2)) {
      //console.log(`FX price absent for ${fx} ${fx2} !!!!!!!!!!`);
      badSymbol= `${fx}:FX`
    }
    return badSymbol;
  }
}

export async function checkPortfolioPricesCurrencies(
  trades: Trade[],
  balanceCurrency: string,
  baseInstrument?: string,
  forceRefresh = false,
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
  //console.log("checkPortfolioPricesCurrencies startDate", startDate, endDate);
  withoutPrices.push(...(await checkPrices(uniqueSymbols, startDate, undefined, undefined, forceRefresh)));
 // console.log("checkPriceCurrency");
  for (const currency of uniqueCurrencies) {
    const r = await checkPriceCurrency(currency, balanceCurrency, startDate, forceRefresh);
    if (r) {
      withoutPrices.push(r);
    }
  }
 // console.log("/checkPortfolioPricesCurrencies");
  return { startDate, endDate, uniqueSymbols, uniqueCurrencies, withoutPrices };
}

export const priceToBaseCurrency = (
  price: number,
  date: string,
  currencyInput: string,
  balanceCurrencyInput: string,
) => {
  // GBX shares the GBP FX rate (no GBX pair exists); pence->GBP scaling is at the price level.
  const currency = fxCurrency(currencyInput);
  const balanceCurrency = fxCurrency(balanceCurrencyInput);
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
  currencyInput: string,
  balanceCurrencyInput: string,
  date: string,
) => {
  // GBX shares the GBP FX rate (no GBX pair exists); pence->GBP scaling is at the price level.
  const currency = fxCurrency(currencyInput);
  const balanceCurrency = fxCurrency(balanceCurrencyInput);
  if (currency === balanceCurrency) {
    return 1;
  }
  //date = date.split('T')[0];
  //console.log(date,dateHistory[date])
  const rate1 = getDateSymbolPrice(date, `${currency}${balanceCurrency}`);
  const rate2 = getDateSymbolPrice(date, `${balanceCurrency}${currency}`);

  // If both rates are null, try to find the last available rate
  if (!rate1 && !rate2) {
    console.warn(`No rate found for ${currency}${balanceCurrency} or ${balanceCurrency}${currency} on ${date}, trying to find last available rate`);

    // Try to find the last available rate for currency+balanceCurrency
    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
      prevDate = prevDate.add(-1, "days");
      const d = prevDate.format(formatYMD);

      const prevRate1 = getDateSymbolPrice(d, `${currency}${balanceCurrency}`);
      const prevRate2 = getDateSymbolPrice(d, `${balanceCurrency}${currency}`);

      if (prevRate1 || prevRate2) {
        const prevR = prevRate1 ? prevRate1 : prevRate2 ? 1 / prevRate2 : 0;
        console.warn(`Using rate from ${d}: ${prevR}`);
        return Number(prevR.toFixed(4));
      }
    }

    // If still no rate found, return null to indicate failure
    console.error(`CRITICAL: No rate found for ${currency}${balanceCurrency} or ${balanceCurrency}${currency} within ${SEARCH_DAY} days!`);
    return null;
  }

  const r = rate1 ? rate1 : (rate2 ? 1 / rate2 : null);
  if (!r) {
      console.error(`CRITICAL: Rate calculation failed for ${currency}/${balanceCurrency} on ${date}`);
      return null;
  }
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
