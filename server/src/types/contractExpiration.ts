import { ObjectId } from "mongodb";
import { DayCountConvention, ExecutionStyle } from "./contract";

// Middle tier of the Underlying -> Expiration -> Strike cascade (see
// services/derivatives/resolveContractSettings.ts). One document per (underlying, expiration)
// pair, shared by every strike/contract at that expiration - this is what makes it an
// inheritance level rather than per-contract duplication: a volatility/rate offset set here
// (the term-structure point for this tenor) applies to every strike at this expiration unless a
// given contract overrides it again itself.
export type ContractExpiration = {
  underlyingSymbolMic: string; // -> Aktia.Symbols["Symbol-Mic"]
  expirationDate: string; // YYYY-MM-DD
  executionStyle?: ExecutionStyle; // overrides the underlying's default if set
  dayCountConvention?: DayCountConvention; // overrides the underlying's default if set
  // Additive, in percentage points, on top of the underlying's base volatility/rate - e.g. base
  // vol 20 + this expiration's offset +1 = 21 for every strike at this expiration (before any
  // further per-strike offset - see types/contract.ts's volatilityOffset/rateOffset).
  volatilityOffset?: number;
  rateOffset?: number;
  // Contract/lot size - overrides the underlying's default if set (see resolveContractSettings.ts
  // and types/underlyingOptionSettings.ts). The tier that actually matters for futures: unlike
  // options, a future has no reliable Underlying-tier record to resolve from at all (no real
  // Aktia.Symbols entry - see docs/derivatives/03-migration-notes.md in portfolio-server), so
  // per-expiration is where futures contract size is expected to be set in practice, not just an
  // override of a rarely-populated underlying default.
  multiplier?: number;
  updateTime?: string;
};

export type ContractExpirationWithID = ContractExpiration & { _id: string | ObjectId };
