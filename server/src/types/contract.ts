import { ObjectId } from "mongodb";

// A derivative contract (future/forward/option). Plain equity/cash positions do NOT get a
// Contract document - they keep referencing a symbol directly (see types/trade.ts), same as
// today. The underlying itself is not duplicated here either: underlyingSymbolMic points at the
// existing Aktia.Symbols collection by its "Symbol-Mic" key.
// See docs/derivatives/03-migration-notes.md in portfolio-server for the design rationale.
//
// ContractType is direction/kind only (call/put/future/forward) - exercise style is a separate,
// cascading field (see ExecutionStyle below) rather than baked into the type, per the user's
// Underlying -> Expiration -> Strike inheritance model (2026-07-06): execution style and day-count
// convention default at the underlying level (types/underlyingOptionSettings.ts), can be overridden
// per expiration (types/contractExpiration.ts), and can be overridden again per contract/strike
// (the optional fields below). Previously this was Call/Put/CallEuropean/PutEuropean - split apart
// because there was nothing for a cascade to override when exercise style was baked into the enum.
export enum ContractType {
  Future = "future",
  Forward = "forward",
  Call = "call",
  Put = "put",
}

export enum ExecutionStyle {
  European = "european",
  American = "american",
}

// Day-count convention for year-fraction (time-to-expiry) calculations - see
// services/derivatives/dayCount.ts. Cascades the same way ExecutionStyle does.
export enum DayCountConvention {
  ActAct = "actAct",
  Act365 = "act365",
  Thirty365 = "30/365",
}

export function isOptionContractType(t: ContractType): boolean {
  return t === ContractType.Call || t === ContractType.Put;
}

export function isCallContractType(t: ContractType): boolean {
  return t === ContractType.Call;
}

export function isPutContractType(t: ContractType): boolean {
  return t === ContractType.Put;
}

// Theoretical pricing model, from the JCalc catalogue (see docs/derivatives/02-pricing-engine.md
// in portfolio-server). Only blackScholes/black76/americanBinomial are ever assigned by the
// automatic selector (services/derivatives/selectTheoModel.ts) today, and are the only ones the
// native JCalc addon (server/native/jcalc) actually implements - the rest are reserved as valid
// manual overrides for later, once ported (see calcTheoPrice.ts's SUPPORTED_MODELS).
export enum TheoModel {
  BlackScholes = "blackScholes",
  Black76 = "black76",
  Black76American = "black76American",
  Bjerksund = "bjerksund",
  BaroneAdesi = "baroneAdesi",
  Geske = "geske",
  MacMillan = "macMillan",
  AmericanBinomial = "americanBinomial",
  EuroBinomial = "euroBinomial",
}

export type Contract = {
  underlyingSymbolMic: string; // -> Aktia.Symbols["Symbol-Mic"]
  contractType: ContractType;
  strike?: number; // required for option types, absent for future/forward
  expirationDate: string; // YYYY-MM-DD
  baseContractId?: string | ObjectId; // -> another Contract, when priced off a future/forward rather than the underlying's cash spot
  dividendRate?: number; // continuous yield, auto-populated from Aktia.Symbols at creation time - see services/derivatives/resolveDividendYield.ts
  theoModel?: TheoModel; // option types only - not meaningful for plain future/forward contracts
  symbol: string; // the contract's own tradable symbol (e.g. an OCC-style option symbol)
  multiplier?: number; // contract/lot size, default 1
  market?: string;
  feedCode?: string;
  provider?: string;
  updateTime?: string;

  // Strike-level overrides - the bottom of the Underlying -> Expiration -> Strike cascade (see
  // services/derivatives/resolveContractSettings.ts). All optional: undefined means "inherit from
  // expiration, or from the underlying if the expiration doesn't set it either".
  executionStyle?: ExecutionStyle;
  dayCountConvention?: DayCountConvention;
  // Additive, in percentage points (matching dividendRate's convention) - stacks with any
  // expiration-level offset, both on top of the underlying's base volatility/rate. E.g. base vol
  // 20 + expiration offset +1 + strike offset +0.5 = effective vol 21.5.
  volatilityOffset?: number;
  rateOffset?: number;
};

export type ContractWithID = Contract & { _id: string | ObjectId };
