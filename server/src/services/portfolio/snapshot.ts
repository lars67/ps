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

import moment, { Moment } from "moment";
import { formatYMD } from "../../constants";
import {isValidDateFormat, toNum} from "../../utils";

type Params = {
  _id: string;
  onDate: string;
  history: string;
};
export async function snapshot(
  { _id, onDate, history }: Params,
  sendResponse: (data: any) => void,
  msgId: string,
): Promise<{}> {
  if (!_id) {
    return { error: "Portolio _id is required" };
  }
  if (onDate) {
    if (!isValidDateFormat(onDate)) {
      return { error: "Wrong onDate" };
    }
    onDate = `${onDate.split("T")[0]}T23:59:59`;
  } else {
    onDate = moment().format(`${formatYMD}T23:59:59`);
  }

  const allTrades = await TradeModel.find({
    portfolioId: _id,
    state: { $in: [1, 21] },
    ...(onDate && { tradeTime: { $lt: onDate } }),
  })
    .sort({ tradeTime: 1 })
    .lean();

  const portfolio = (await PortfolioModel.findById(_id)) as Portfolio;
  const { startDate, endDate, uniqueSymbols, uniqueCurrencies } =
    await checkPortfolioPricesCurrencies(allTrades, portfolio.currency);
  console.log("P", startDate, uniqueSymbols, uniqueCurrencies);
  let date = moment(startDate);
  let currentDay = startDate.split("T")[0];

  const oldPortfolio: Record<string, Partial<Trade> | {}> = {};
  let cash = 0;
  let invested = 0;
  let tradedSymbols: string[] = [];
  let days = [];
  const rows = [{}];
  let nav = 0;
  for (const trade of allTrades) {

    if (!trade.tradeTime.includes(currentDay)) {
      let {inv, notTradeChanges} = addNotTradesItems(
        currentDay,
        portfolio.currency,
        tradedSymbols,
        oldPortfolio,
      );
      notTradeChanges.forEach(t=> rows.push(t))
      days.push({
        date: currentDay,
        invested: invested + inv,
        investedWithoutTrades: inv,
        cash,
        nav: nav + inv,
      });
      invested = 0;
      tradedSymbols = [];
      currentDay = trade.tradeTime.split("T")[0];

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
        let newVolume =
          (oldPortfolio[symbol] as Trade).volume - dir * trade.volume;
        const priceN = toNum(trade.price)
        const cashChange =
          dir * priceN * trade.rate * trade.volume - trade.fee* trade.rate;
        (oldPortfolio[symbol] as Trade).volume = newVolume;
        (oldPortfolio[symbol] as Trade).price = trade.price;
        (oldPortfolio[symbol] as Trade).rate = trade.rate;
        cash += cashChange;
        const investedSymbol=newVolume * priceN * trade.rate
        invested += investedSymbol; //investedTrade+investedBefore
        nav = invested + cash;
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
          cashChangeSymbol:cashChange
        });
        break;
      case "31":
      case "20":
        cash +=
          priceToBaseCurrency(
            trade.price,
            trade.tradeTime,
            trade.currency,
            portfolio.currency,
          ) || 0;
        nav += cash;
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
  let {inv, notTradeChanges} = addNotTradesItems(
    currentDay,
    portfolio.currency,
    tradedSymbols,
    oldPortfolio,
  );
  notTradeChanges.forEach(t=> rows.push(t))
  days.push({
    date: currentDay,
    invested: invested + inv,
    investedWithoutTrades:inv,
    cash,
    nav: nav + inv,
  });
  Object.keys(oldPortfolio).map((p) => {
    const pi = oldPortfolio[p] as Trade;
    if (pi.volume === 0) {
      delete oldPortfolio[p];
    }
  });
  const lastDay = onDate.split("T")[0];
  if (lastDay > currentDay && !history) {
    let {inv, notTradeChanges} = addNotTradesItems(
      onDate.split("T")[0],
      portfolio.currency,
      [],
      oldPortfolio,
    );
    notTradeChanges.forEach(t=> rows.push(t))
    days.push({
      date: lastDay,
      invested: inv,
      cash,
      nav: inv+cash,
    });

  }

  if (!history) {
    days.splice(-0, days.length - 1);
  }
  return { days , rows };
}

function addNotTradesItems(
  currentDay: string,
  portfolioCurrency: string,
  tradedSymbols: String[],
  oldPortfolio: Record<string, Partial<Trade>>,
) {
  let inv = 0;
  const changes: object[]=[];
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
        const investedSymbol = rate * pi.volume * price;
        changes.push({currentDay, symbol, currency:pi.currency, price, rate, volume:pi.volume,investedSymbol })

        return sum + rate * pi.volume * price;
      }, 0);
  }
  return {inv, notTradeChanges:changes};
}
