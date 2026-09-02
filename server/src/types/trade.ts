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
  closed?: boolean;
  shares?: number;
  description?: string;
  aml?: boolean;
  // Set only for option/future trades - references the Contract this trade was booked against
  // (see types/contract.ts). Plain equity/cash/dividend trades leave this undefined, matching
  // how ps2 dropped the old system's "spot" contract type - a Contract document only exists for
  // actual derivatives. Populated by services/trade.ts's add() via upsertContractForTrade().
  contractId?: string;
};

export type TradeWithID = Trade & { _id: string | ObjectId };

// Input shape a client submits on trades.add when the trade is an option/future - not persisted
// on the Trade document itself, only used to upsert-by-identity into the contracts collection
// (see services/derivatives/upsertContractForTrade.ts) and derive contractId/symbol above.
export type TradeContractInput = {
  underlyingSymbolMic: string;
  contractType: string; // ContractType enum value, kept as string here to avoid a types/contract.ts import cycle
  strike?: number;
  expirationDate: string;
  baseContractId?: string;
  symbol: string;
  multiplier?: number;
  market?: string;
  feedCode?: string;
  provider?: string;
  // Strike-level overrides of the Underlying -> Expiration -> Strike cascade (see
  // services/derivatives/resolveContractSettings.ts) - ExecutionStyle/DayCountConvention enum
  // values, kept as strings for the same reason contractType is.
  executionStyle?: string;
  dayCountConvention?: string;
  volatilityOffset?: number;
  rateOffset?: number;
};

export type TradeInput = Trade & { contract?: TradeContractInput };

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

export enum TradeTypes {
  Trade = "1",
  Dividends = "20",
  Investment ="21",
  Correction ="22",
  Cash = "31"
}

export enum MoneyTypes {
  Trade = "trade",
  Dividends = "dividends",
  Investment ="investment",
  Correction ="correction",
  Cash = "cash"
}

export function convertMoneyTypeToTradeType(moneyType: MoneyTypes, defValue: TradeTypes): TradeTypes {
  switch (moneyType) {
    case MoneyTypes.Cash:
      return TradeTypes.Cash;
    case MoneyTypes.Trade:
      return TradeTypes.Trade;
    case MoneyTypes.Dividends:
      return TradeTypes.Dividends;
    case MoneyTypes.Investment:
      return TradeTypes.Investment;
    case MoneyTypes.Correction:
      return TradeTypes.Correction;
    default:
      return defValue;
  }
}

