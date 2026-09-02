import {isTradeSide, Trade, TradeInput, TradeOp, TradeSide, TradeWithID} from "../types/trade";
import { upsertContractForTrade } from "./derivatives/upsertContractForTrade";
import { TradeModel } from "../models/trade";
import { FilterQuery } from "mongoose";

import { CommandDescription } from "../types/custom";
import eventEmitter, { sendEvent } from "./app/eventEmiter";
import { PortfolioModel } from "../models/portfolio";
import { isTradeType } from "../utils/dictionary";
import {fxCurrency, getRealId, isCurrency, isErrorType, isISODate, validateRequired} from "../utils";
import { CurrencyModel } from "../models/currency";
import {ErrorType} from "../types/other";
import {errorMsgs} from "../constants";
import {DeleteResult} from "mongodb";
import {checkPriceCurrency, getDateSymbolPrice} from "../services/app/priceCashe";
import {Portfolio} from "../types/portfolio";
import {UserData} from "@/services/websocket";
import {getPortfolioInstanceByIDorName} from "../services/portfolio/helper";

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
  trade: TradeInput,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<Trade | ErrorType | null> {
  //console.log("T", trade);
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await  getPortfolioInstanceByIDorName (trade.portfolioId, userData);
  if (error) {
    return error as ErrorType;
  }

  // Option/future trades submit a `contract` spec instead of (or alongside) a bare symbol - the
  // contract is created/upserted by identity here, at trade-save time, rather than pre-populated
  // from a feed (see docs/derivatives/03-migration-notes.md in portfolio-server). Resolved first,
  // before anything below dereferences trade.symbol, since a pure derivatives submission may not
  // carry a top-level symbol at all - trade.symbol is set to the contract's own tradable symbol so
  // positions.ts's existing symbol-based grouping keeps working unmodified; contractId is purely
  // an additional join key onto contract metadata.
  if (trade.contract) {
    try {
      const contract = await upsertContractForTrade(trade.contract);
      trade.contractId = contract._id.toString();
      trade.symbol = contract.symbol;
    } catch (err) {
      return { error: `Failed to resolve contract: ${err}` } as ErrorType;
    }
  }

  const isFX = isCurrency(trade.symbol);
  if (isFX && !trade.currency){
    trade.currency= trade.symbol.substring(3,6);
  }
  // Normalize GBX (pence) -> GBP (pounds) at the write boundary so the DB only ever stores
  // GBP. London prices arrive in pence; convert price/fee to pounds and relabel. The market
  // feed (Yahoo) still sends pence and is scaled separately via isPenceQuoted.
  if (trade.currency === 'GBX') {
    if (typeof trade.price === 'number') trade.price = trade.price / 100;
    if (typeof trade.fee === 'number') trade.fee = trade.fee / 100;
    trade.currency = 'GBP';
  }
  console.log('TRADE------------', trade.symbol, trade.currency);
  trade.portfolioId= realId;
    let err_required = validateRequired<Trade>(validationsAddRequired, trade)
  if (err_required) {
    return errorMsgs.required(err_required);
  }
  if (!isTradeSide(trade.side)) {
    return { error: `Wrong trade Side` };
  }



  if (!(await CurrencyModel.find({ symbol: trade.currency }))) {
    return { error: `Unknown currency` };
  }
  if (!isTradeType(trade.tradeType)) {
    return { error: `Wrong tradeType` };
  }
  if (!trade.userId) {
    trade.userId = userData.userId;
  }
  // INVARIANT (todo #87): a trade may only belong to the portfolio's owner. This makes it
  // physically impossible for a portfolio to contain another user's trades, so a user can
  // never be presented holdings that are not theirs — regardless of who initiates the write
  // (including admin/service connections). Legitimate backend pushes must therefore stamp the
  // owner's userId; a stray write defaulting to the caller's id is rejected here.
  if (String(trade.userId) !== String(portfolio.userId)) {
    return { error: `Trade userId ${trade.userId} does not own portfolio ${realId} (owner ${portfolio.userId})` } as ErrorType;
  }
  if (!trade.tradeTime) {
    trade.tradeTime = new Date().toISOString();
  } else if (!isISODate(trade.tradeTime)) {
    return { error: `Wrong tradeTime format` };
  }
  const {currency: portfolioCurrency} = await  PortfolioModel.findById(trade.portfolioId, {currency:1}) as Portfolio;



  if (!trade.rate) {

    // GBX (pence) has no FX rate of its own — it uses the GBP rate. Map before building the
    // FX symbol so the rate resolves; the pence->GBP scale is handled at the price level.
    const rateSymbol = isFX ? trade.symbol : `${fxCurrency(trade.currency)}${fxCurrency(portfolioCurrency)}:FX`
    let rate = getDateSymbolPrice(trade.tradeTime, rateSymbol);
    console.log('aaaaaaaaaaaa2', trade.tradeTime, rateSymbol, rate,trade.currency,
        portfolioCurrency)
    if (!rate) {
      await checkPriceCurrency(
          trade.currency,
          portfolioCurrency,
          trade.tradeTime);
      rate = getDateSymbolPrice(trade.tradeTime, rateSymbol);
      console.log('aaaaaaaaaaaa3', trade.tradeTime, rateSymbol, portfolioCurrency, rate)

    }
    if (rate) {
      trade.rate = isFX ? 1/rate : rate;
    }else {
      throw `RATE unknown ${rateSymbol}`
    }
  }


  if (trade.fee !== undefined && isNaN(trade.fee as unknown as number)) trade.fee = 0;
  if (trade.feeSymbol !== undefined && isNaN(trade.feeSymbol as unknown as number)) trade.feeSymbol = 0;

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

export const buildFilterTrades = (tradesFilter: Partial<TradeFilter>) => {
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

  /*subscribe: {
    label: "Subscribe Portfolio Trades",
    value: JSON.stringify({
      command: "trades.subscribe",
      portfolioId: "?",
      from: "",
    //  till: "",
    }),
  },
  unsubscribe: {
    label: "UnSubscribe Portfolio Trades",
    value: JSON.stringify({ command: "trades.unsubscribe", subscribeId: "?" }),
  },*/

  removeAll: {
    label: "removeAll  Trades for portfolio",
    value: JSON.stringify({
      command: "trades.removeAll",
      portfolioId: "?",

    }),
    access:'member'
  },

  add: {
    label: "Add trade (equity)",
    access: "member",
    value: [
      "# Plain equity trade. side B = buy, S = sell.",
      "# Leave rate empty to have the FX rate to the portfolio currency resolved",
      "# automatically - only fill it in when you really mean to pin a specific rate.",
      "# Leave tradeTime empty to book it as of now.",
      JSON.stringify({
        command: "trades.add",
        portfolioId: "?",
        tradeType: "1",
        side: "B",
        symbol: "MSFT:XNAS",
        volume: "?",
        price: "?",
        currency: "USD",
        rate: "",
        fee: "",
        tradeTime: "",
      }),
    ].join("\n"),
  },

  // Sample-only alias: there is no `addOption` handler - what gets sent is this entry's own
  // `value` ("command": "trades.add"). Same convention (and same harmless allowlist side effect)
  // as the tools.theoPrice samples - see the comment block in services/custom/tools.ts.
  addOption: {
    label: "Add trade (option / future contract)",
    access: "member",
    value: [
      "# Booking an option or a future: leave out `symbol` and send a `contract` spec instead.",
      "# The contract is upserted by identity - the same underlying + contractType + strike +",
      "# expirationDate always resolves to the same contract document, so re-entering a trade",
      "# never creates a duplicate. trade.symbol and trade.contractId are filled in from it.",
      "# price and volume are the OPTION's own (per contract), not the underlying's.",
      "# multiplier is the contract size - 100 is the standard for US single-stock options.",
      "# Tip: run tools.theoPrice first to see what the contract is theoretically worth.",
      JSON.stringify({
        command: "trades.add",
        portfolioId: "?",
        tradeType: "1",
        side: "B",
        volume: "?",
        price: "?",
        currency: "USD",
        fee: "",
        tradeTime: "",
        contract: {
          underlyingSymbolMic: "MSFT:XNAS",
          contractType: "call",
          strike: 400,
          expirationDate: "?",
          symbol: "?",
          multiplier: 100,
          market: "OPRA",
        },
      }),
    ].join("\n"),
  },
};
