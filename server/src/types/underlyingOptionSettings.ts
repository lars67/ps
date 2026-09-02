import { ObjectId } from "mongodb";
import { DayCountConvention, ExecutionStyle } from "./contract";

// Top of the Underlying -> Expiration -> Strike cascade (see
// services/derivatives/resolveContractSettings.ts). One document per underlying, providing the
// default execution style and day-count convention for every option on it, unless overridden at
// the expiration or contract/strike level. Deliberately a separate ps2-owned collection rather
// than folded into Aktia.Symbols: execution style/day-count convention are option-market-structure
// concepts, not equity reference data, and Aktia.Symbols is external vendor data ps2 doesn't own
// or want to extend (see docs/derivatives/03-migration-notes.md in portfolio-server).
export type UnderlyingOptionSettings = {
  underlyingSymbolMic: string; // -> Aktia.Symbols["Symbol-Mic"], unique key
  executionStyle?: ExecutionStyle;
  dayCountConvention?: DayCountConvention;
  // Contract/lot size (e.g. 100 for standard US single-stock options) - a per-underlying market
  // convention, not something to guess or hardcode per contract. Aktia.Symbols doesn't carry this
  // (it's equity reference data sourced externally, not an options-market-structure concept - see
  // this file's own top-of-file rationale), so it lives here instead, resolved via
  // resolveContractSettings.ts and overridable per contract (types/contract.ts's multiplier).
  multiplier?: number;
  updateTime?: string;
};

export type UnderlyingOptionSettingsWithID = UnderlyingOptionSettings & { _id: string | ObjectId };
