import { ObjectId } from "mongodb";

export type Trade = {
  tradeId: string;
  side: string;
  tradeType: string; //
  portfolioId: string;
  accountId: string;
  symbol: string;
  name: string;
  volume: number;
  price: number;
  currency: string;
  fee: number;
  feeSymbol: number;
  rate: number;
  userId: string;
  tradeTime: string;
  exchangeTime: string;
  updateTime: string;
  oldTradeId: String;
  tradeSource: string;
  orderId: string;
  comment: string;
  state: string;
  invested?: number;
  closed?: boolean
  shares?: number
};

export type TradeWithID = Trade & { _id: string | ObjectId };

export type TradeOp = Trade & {_op: string, _id:string}
export enum TradeSide {
  Buy = "B",
  Sell = "S",
  PUT = "P", // put for dividend and cash
  WITHDRAW = "W", // withdraw for cash
}

export function isTradeSide(value: string): boolean {
  return Object.values(TradeSide).includes(value as TradeSide);
}

