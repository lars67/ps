import {isTradeSide, Trade, TradeOp, TradeSide, TradeWithID} from "../types/trade";
import { TradeModel } from "../models/trade";
import { FilterQuery } from "mongoose";

import { CommandDescription } from "../types/custom";
import eventEmitter, { sendEvent } from "./app/eventEmiter";
import { PortfolioModel } from "../models/portfolio";
import { isTradeType } from "../utils/dictionary";
import {isISODate, validateRequired} from "../utils";
import { CurrencyModel } from "../models/currency";
import {ErrorType} from "../types/other";
import {errorMsgs} from "../constants";
import {DeleteResult} from "mongodb";
import {checkPriceCurrency, getDateSymbolPrice} from "../services/app/priceCashe";
import {Portfolio} from "../types/portfolio";

interface Subscribers {
  [msgId: string]: (data: any) => void;
}

const subscribers: Subscribers = {};



export async function list(
  filter: FilterQuery<Trade> = {},
): Promise<Trade[] | null> {
  try {
    console.log("filter", filter);
    const trades = await TradeModel.find(filter?.filter).lean();
    return trades;
  } catch (err) {}
  return [];
}



export const validationsAddRequired= ["portfolioId", "side", "tradeType", "currency"]
export async function add(
  trade: Trade,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userId: string,
): Promise<Trade | ErrorType | null> {
  //console.log("T", trade);
  let err_required = validateRequired<Trade>(validationsAddRequired, trade)
  if (err_required) {
    return errorMsgs.required(err_required);
  }
  if (!isTradeSide(trade.side)) {
    return { error: `Wrong trade Side` };
  }
  if (!(await PortfolioModel.findById(trade.portfolioId))) {
    return { error: `Unknown portfolioId` };
  }
  if (!(await CurrencyModel.find({ symbol: trade.currency }))) {
    return { error: `Unknown currency` };
  }
  if (!isTradeType(trade.tradeType)) {
    return { error: `Wrong tradeType` };
  }
  if (!trade.userId) {
    trade.userId = userId;
  }
  if (!trade.tradeTime) {
    trade.tradeTime = new Date().toISOString();
  } else if (!isISODate(trade.tradeTime)) {
    return { error: `Wrong tradeTime format` };
  }
  const {currency: portfolioCurrency} = await  PortfolioModel.findById(trade.portfolioId, {currency:1}) as Portfolio;

  if (!trade.rate) {

    let rate = getDateSymbolPrice(trade.tradeTime, trade.symbol);
    if (!rate) {
      await checkPriceCurrency(
          trade.currency,
          portfolioCurrency,
          trade.tradeTime);
      rate = getDateSymbolPrice(trade.tradeTime, trade.symbol);
    }
    if (rate) {
      trade.rate = rate;
    }else {
      throw `RATE unknown ${trade.symbol}`
    }
  }


  trade.state = "1";
  const newTrade = new TradeModel(trade);
  const added = await newTrade.save();
  const addData = added.toObject();
  sendEvent("trade.change", {...addData, _op:0});
  return addData;
}

export async function update(
  trade: Partial<TradeWithID>,
): Promise<Trade | ErrorType | null> {
  const { _id, ...other } = trade;
  if (!_id) {
   return errorMsgs.required1('_id')
  }
  sendEvent("trade.change", {_op:1,...trade});
  return await TradeModel.findByIdAndUpdate(_id, other, {new: true});
}

export async function remove({
  _id,
}: {
  _id: string;
}): Promise<Trade | ErrorType | null> {
  if (!_id) {
    return errorMsgs.required1('_id')
  }
  sendEvent("trade.change", {_id, _op:2});
  return await TradeModel.findByIdAndDelete(_id);
}

export type TradeFilter = {
  _id: string;
  portfolioId: string;
  from: Date;
};

const buildFilterTrades = (tradesFilter: Partial<TradeFilter>) => {
  const filter: FilterQuery<Trade> = Object.keys(tradesFilter).reduce(
      (f, field) => {
        switch (field) {
          case "from":
            return {...f, tradeTime: {$gte: tradesFilter[field]}};
          default:
            return tradesFilter[field as keyof TradeFilter]
                ? {...f, [field]: tradesFilter[field as keyof TradeFilter]}
                : f;
        }
      },
      {} as FilterQuery<Trade>,
  );
  return filter;
}

/*
export async function snapshot(
    tradesFilter: Partial<TradeFilter>,
    sendResponse: (data: any) => void,
    msgId: string,
): Promise<Trade[]> {
  const filter: FilterQuery<Trade> = await buildFilterTrades(tradesFilter);
  return await TradeModel.find(filter);
}
*/
export async function subscribe(
    tradesFilter: Partial<TradeFilter>,
    sendResponse: (data: any) => void,
    msgId: string,
): Promise<Trade[]> {
  const filter: FilterQuery<Trade> = await buildFilterTrades(tradesFilter);
  subscribers[msgId] = (ev: TradeOp) => sendResponse(ev);
  eventEmitter.on("trade.change", subscribers[msgId]);
   return await TradeModel.find(filter);
}

export async function unsubscribe(
    subscribeId: {subscribeId:string},
    sendResponse: (data: any) => void,
    msgId: string,
): Promise<boolean> {
  eventEmitter.removeListener("trade.change", subscribers[subscribeId.subscribeId as keyof Subscribers]);
  return true
}
/*
export async function trades(
  tradesFilter: Partial<TradeFilter>,
  sendResponse: (data: any) => void,
  msgId: string,
): Promise<Trade[]> {
  const { requestType } = tradesFilter;
  if (requestType === 2) {
    eventEmitter.removeListener("trade.add", subscribers[msgId]);
  }
  const filter: FilterQuery<Trade> = Object.keys(tradesFilter).reduce(
    (f, field) => {
      switch (field) {
        case "from":
          return { ...f, tradeTime: { $gte: tradesFilter[field] } };
        default:
          return tradesFilter[field as keyof TradeFilter]
            ? { ...f, [field]: tradesFilter[field as keyof TradeFilter] }
            : f;
      }
    },
    {} as FilterQuery<Trade>,
  );
  if (requestType === 1) {
    subscribers[msgId] = (ev: Trade) => sendResponse(ev);
    eventEmitter.on("trade.add", subscribers[msgId]);
  }
  return await TradeModel.find(filter);
}
*/
type PutCash = {
  portfolioId: string;
  amount: string;
  currency: string;
  userId?: string;
  tradeTime?: string;
  tradeType: string
};

export async function putSpecialTrade(
    par: PutCash,
    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
): Promise<Trade | ErrorType | undefined> {
  let err_required = ["currency", "amount", "portfolioId"].reduce(
      (err, fld) => {
        if (!par[fld as keyof PutCash]) {
          err += `${fld}, `;
        }
        return err;
      },
      "",
  );
  if (!(await PortfolioModel.findById(par.portfolioId))) {
    return { error: `Unknown portfolioId` };
  }
  if (!(await CurrencyModel.find({ symbol: par.currency }))) {
    return { error: `Unknown currency` };
  }
  if (!par.userId) {
    par.userId = userId;
  }
  if (!par.tradeTime) {
    par.tradeTime = new Date().toISOString();
  } else if (!isISODate(par.tradeTime)) {
    return { error: `Wrong tradeTime format` };
  }
  const newTrade = new TradeModel({
    portfolioId: par.portfolioId,
    price: Number(par.amount),
    currency: par.currency,
    userId: par.userId,
    tradeTime: par.tradeTime,
    tradeType: par.tradeType,
    state: 1,
    side: TradeSide.PUT,
    volume: 0,
    fee: 0,
    contract: "CASH",
  });

  const added = await newTrade.save();
  sendEvent("trade.add", added);
  return added;
}
export async function putCash(
  par: PutCash,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userId: string,
): Promise<Trade | ErrorType | undefined> {

  return await putSpecialTrade(
      {...par, tradeType:'31'},
      sendResponse,
      msgId,
      userModif,
      userId);

}

export async function putDividends(
    par: PutCash,
    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
): Promise<Trade | ErrorType | undefined> {

  return await putSpecialTrade(
      {...par, tradeType:'20'},
      sendResponse,
      msgId,
      userModif,
      userId);

}

export async function removeAll({
                               portfolioId,
                             }: {
  portfolioId: string;
}): Promise<DeleteResult | ErrorType | null> {
  if (!portfolioId) {
    return errorMsgs.required1("portfolioId");
  }
  return await TradeModel.deleteMany({portfolioId});
}

export const description: CommandDescription = {
  snapshot: {
    label: "Get Trades",
    value: JSON.stringify({
      command: "trades.snapshot",
      portfolioId: "?",
      from: "",
      till: "",
    }),
  },
  subscribe: {
    label: "Subscribe Portfolio Trades",
    value: JSON.stringify({
      command: "trades.subscribe",
      portfolioId: "?",
      from: "",
      till: "",
    }),
  },
  unsubscribe: {
    label: "UnSubscribe Portfolio Trades",
    value: JSON.stringify({ command: "trades.unsubscribe", subscribeId: "?" }),
  },
  addCash: {
    label: "Put Cash",
    value: JSON.stringify({
      command: "trades.putCash",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      userId: "",
    }),
  },
  addDividends: {
    label: "Put Dividends",
    value: JSON.stringify({
      command: "trades.putDividends",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      userId: "",
    }),
  },
  removeAll: {
    label: "removeAll  Trades for portfolio",
    value: JSON.stringify({
      command: "trades.removeAll",
      portfolioId: "?",

    }),
  },
};


