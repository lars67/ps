import { UnderlyingOptionSettingsModel } from "../../models/underlyingOptionSettings";
import { ContractExpirationModel } from "../../models/contractExpiration";
import { DayCountConvention, ExecutionStyle } from "../../types/contract";

export type ResolvedContractSettings = {
  executionStyle: ExecutionStyle;
  dayCountConvention: DayCountConvention;
  // Total additive offset from the expiration + strike levels (percentage points) - the caller
  // adds this to the underlying's own base volatility/rate (e.g. from resolveVolatility.ts /
  // resolveRiskFreeRate.ts), it is NOT a full value itself.
  volatilityOffset: number;
  rateOffset: number;
  // Contract/lot size - unlike the offsets above, NOT additive across the cascade (a strike-level
  // override replaces the underlying's value outright, doesn't add to it - contract size isn't a
  // term-structure point). Resolves contract -> expiration -> underlying -> DEFAULT_MULTIPLIER;
  // for options this is normally set at the underlying tier (one lot size for the whole name), for
  // futures at the expiration tier (see types/contractExpiration.ts - no reliable underlying
  // record exists for futures at all). See types/underlyingOptionSettings.ts for why this lives in
  // a separate ps2-owned collection rather than Aktia.Symbols.
  multiplier: number;
};

const DEFAULT_EXECUTION_STYLE = ExecutionStyle.American;
const DEFAULT_DAY_COUNT_CONVENTION = DayCountConvention.Act365;
// Falls back to the near-universal single-stock-option convention (OCC standard: 1 contract = 100
// shares) when neither the contract nor its underlying specify one - a documented assumption, not
// a verified fact for every market (e.g. UK equity options commonly use other lot sizes - seed the
// real value into UnderlyingOptionSettings per underlying once known, don't rely on this default).
const DEFAULT_MULTIPLIER = 100;

// Resolves the Underlying -> Expiration -> Strike cascade (per the user's data model,
// 2026-07-06 - see docs/derivatives/03-migration-notes.md in portfolio-server): a contract's
// execution style, day-count convention, and volatility/rate offsets each default from the
// underlying (types/underlyingOptionSettings.ts), can be overridden per expiration
// (types/contractExpiration.ts), and can be overridden again per contract/strike (the caller
// passes those as `contractOverrides`, straight off the Contract document or a not-yet-saved
// TradeContractInput). Neither the underlying settings nor the expiration document need to exist
// for this to work - everything degrades to sensible defaults (American / ACT/365, zero offset).
export async function resolveContractSettings(input: {
  underlyingSymbolMic: string;
  expirationDate: string;
  executionStyle?: ExecutionStyle;
  dayCountConvention?: DayCountConvention;
  volatilityOffset?: number;
  rateOffset?: number;
  multiplier?: number;
}): Promise<ResolvedContractSettings> {
  const [underlyingSettings, expiration] = await Promise.all([
    UnderlyingOptionSettingsModel.findOne({ underlyingSymbolMic: input.underlyingSymbolMic }).lean(),
    ContractExpirationModel.findOne({
      underlyingSymbolMic: input.underlyingSymbolMic,
      expirationDate: input.expirationDate,
    }).lean(),
  ]);

  const executionStyle =
    input.executionStyle ??
    expiration?.executionStyle ??
    underlyingSettings?.executionStyle ??
    DEFAULT_EXECUTION_STYLE;

  const dayCountConvention =
    input.dayCountConvention ??
    expiration?.dayCountConvention ??
    underlyingSettings?.dayCountConvention ??
    DEFAULT_DAY_COUNT_CONVENTION;

  const volatilityOffset = (expiration?.volatilityOffset ?? 0) + (input.volatilityOffset ?? 0);
  const rateOffset = (expiration?.rateOffset ?? 0) + (input.rateOffset ?? 0);

  // Expiration tier resolves before the underlying default - the tier that actually matters for
  // futures, which have no reliable Underlying-tier record to resolve from at all (see
  // types/contractExpiration.ts). For options, underlyingSettings is normally where this is set in
  // practice, so this ordering doesn't change anything as long as no expiration document exists.
  const multiplier =
    input.multiplier ?? expiration?.multiplier ?? underlyingSettings?.multiplier ?? DEFAULT_MULTIPLIER;

  return { executionStyle, dayCountConvention, volatilityOffset, rateOffset, multiplier };
}
