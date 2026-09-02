import { MongoClient } from "mongodb";
import { ContractModel } from "../../models/contract";
import { ContractType, ContractWithID, DayCountConvention, ExecutionStyle, isOptionContractType } from "../../types/contract";
import { TradeContractInput } from "../../types/trade";
import { resolveDividendYield } from "./resolveDividendYield";
import { selectTheoModel } from "./selectTheoModel";
import { resolveContractSettings } from "./resolveContractSettings";

// Upserts a Contract document by logical identity (underlying+type+strike+expiry), the same
// operation server/src/seed-test-contracts.ts exercises by hand - shared here because
// services/trade.ts's add() needs to do the exact same thing at trade-save time (options/futures
// arrive as OTC trades; the contract is created/upserted there, not pre-populated from a feed -
// see docs/derivatives/03-migration-notes.md in portfolio-server).
export async function upsertContractForTrade(input: TradeContractInput): Promise<ContractWithID> {
  const contractType = input.contractType as ContractType;
  const isOption = isOptionContractType(contractType);

  const aktiaClient = new MongoClient(process.env.MONGODB_URI as string);
  let dividendRate = 0;
  try {
    await aktiaClient.connect();
    const underlyingDoc = await aktiaClient
      .db("Aktia")
      .collection("Symbols")
      .findOne({ "Symbol-Mic": input.underlyingSymbolMic });
    dividendRate = resolveDividendYield(underlyingDoc);
  } finally {
    await aktiaClient.close();
  }

  // Resolve the Underlying -> Expiration -> Strike cascade (see resolveContractSettings.ts) so
  // selectTheoModel picks the right model for this contract's *actual* execution style, not a
  // hardcoded assumption. Called unconditionally (not just for options): futures/forwards have no
  // execution style (selectTheoModel ignores it for them - see that file), but they do have a
  // contract/lot size, resolved the same way (e.g. an underlying-level default) - see multiplier.
  const settings = await resolveContractSettings({
    underlyingSymbolMic: input.underlyingSymbolMic,
    expirationDate: input.expirationDate,
    executionStyle: input.executionStyle as ExecutionStyle | undefined,
    dayCountConvention: input.dayCountConvention as DayCountConvention | undefined,
    volatilityOffset: input.volatilityOffset,
    rateOffset: input.rateOffset,
    multiplier: input.multiplier,
  });

  const identity = isOption
    ? {
        underlyingSymbolMic: input.underlyingSymbolMic,
        contractType,
        strike: input.strike,
        expirationDate: input.expirationDate,
      }
    : {
        underlyingSymbolMic: input.underlyingSymbolMic,
        contractType,
        expirationDate: input.expirationDate,
      };

  // Only fields the caller actually supplied go into $set - a later trade on the same contract
  // identity that omits market/feedCode/provider/baseContractId/multiplier/the strike-level
  // overrides (e.g. a close-out payload that only repeats the option's own fields) must not
  // silently clobber values an earlier trade already established. multiplier is deliberately left
  // unset unless the trade explicitly overrides it - resolveContractSettings resolves the
  // effective value live (contract override -> underlying default -> DEFAULT_MULTIPLIER), rather
  // than baking a guess into the contract document at creation time.
  const $set: Record<string, unknown> = {
    symbol: input.symbol,
    dividendRate,
    theoModel: selectTheoModel(contractType, settings.executionStyle, !!input.baseContractId),
    updateTime: new Date().toISOString(),
  };
  const $setOnInsert: Record<string, unknown> = {};
  if (input.multiplier !== undefined) $set.multiplier = input.multiplier;
  if (input.market !== undefined) $set.market = input.market;
  if (input.feedCode !== undefined) $set.feedCode = input.feedCode;
  if (input.provider !== undefined) $set.provider = input.provider;
  if (input.baseContractId !== undefined) $set.baseContractId = input.baseContractId;
  if (input.executionStyle !== undefined) $set.executionStyle = input.executionStyle;
  if (input.dayCountConvention !== undefined) $set.dayCountConvention = input.dayCountConvention;
  if (input.volatilityOffset !== undefined) $set.volatilityOffset = input.volatilityOffset;
  if (input.rateOffset !== undefined) $set.rateOffset = input.rateOffset;

  const contract = await ContractModel.findOneAndUpdate(
    identity,
    Object.keys($setOnInsert).length > 0 ? { $set, $setOnInsert } : { $set },
    { upsert: true, new: true, runValidators: true },
  );

  return contract!.toObject() as ContractWithID;
}
