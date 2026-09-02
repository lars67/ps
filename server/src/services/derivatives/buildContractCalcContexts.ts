import { MongoClient } from "mongodb";
import { ContractModel } from "../../models/contract";
import { ContractWithID, DayCountConvention, ExecutionStyle } from "../../types/contract";
import { resolveVolatility } from "./resolveVolatility";
import { calcHistoricalVolatility } from "./calcHistoricalVolatility";
import { resolveRiskFreeRate } from "./resolveRiskFreeRate";
import { resolveContractSettings } from "./resolveContractSettings";

export type ContractCalcContext = {
  contract: ContractWithID;
  // The live tick driver for this contract's theoPrice: the underlying's own cash-spot symbol for
  // spot-based options, or the base future/forward contract's own tradable symbol for future-based
  // options - Black76/Black76American price off the future's own price, not the cash underlying
  // (see docs/derivatives/02-pricing-engine.md's Black76 section in portfolio-server, and
  // calcTheoPrice.ts). Falls back to the cash underlying if baseContractId is set but the
  // referenced Contract document can't be found (shouldn't normally happen).
  priceDriverSymbol: string;
  // The underlying's real currency (Aktia.Symbols.Currency, e.g. "GBP" - not the possibly-pence
  // "Price - Currency" field), passed through explicitly so positions.ts's isPenceQuoted() check
  // on the live spot tick doesn't depend on the underlying happening to also be preloaded via a
  // separate held stock position (see companies.ts's preloadSymbolCurrencies - that side-channel
  // only gets populated for symbols that are themselves a position; an option whose underlying
  // isn't separately held would otherwise fall back to isPenceQuoted's untrusted default guess).
  priceDriverCurrency: string;
  futureBased: boolean;
  // Contract/lot size (see resolveContractSettings.ts) - positions.ts needs this to convert
  // per-share/per-unit theoPrice into the position's actual aggregate valuation, matching how
  // getPositions() applies it to booked trades (see priceAdj there).
  multiplier: number;
  // Already includes the Underlying -> Expiration -> Strike cascade's offsets (see
  // resolveContractSettings.ts) - callers use these directly, no further adjustment needed.
  volatility: number;
  riskFreeRate: number;
  executionStyle: ExecutionStyle;
  dayCountConvention: DayCountConvention;
};

// Precomputes everything calcTheoPrice needs except the live spot tick, for every held position
// that's linked to a Contract (positions.ts's contractId, from types/trade.ts). Run once per
// subscribe/resubscribe rather than per tick: volatility/riskFreeRate are refreshed at that
// cadence - the same snapshot-at-a-point-in-time approach dividendRate already uses (see
// resolveDividendYield.ts) - only the price itself needs to be genuinely tick-live.
// Keyed by the position's own symbol (contract.symbol), matching portfolioPositions' key, so
// positions.ts's tick handler can look a position up directly.
export async function buildContractCalcContexts(
  positions: { symbol: string; contractId?: string }[],
): Promise<Record<string, ContractCalcContext>> {
  const contractIds = positions
    .map((p) => p.contractId)
    .filter((id): id is string => !!id);
  const result: Record<string, ContractCalcContext> = {};
  if (contractIds.length === 0 || !process.env.MONGODB_URI) return result;

  const contracts = await ContractModel.find({ _id: { $in: contractIds } }).lean();
  if (contracts.length === 0) return result;

  // Future/forward-based options need their base contract's own tradable symbol as the price
  // driver, not the cash underlying - fetch those alongside (batched, same as the underlying
  // lookup below).
  const baseContractIds = Array.from(
    new Set(
      contracts
        .map((c) => c.baseContractId)
        .filter((id): id is NonNullable<typeof id> => !!id)
        .map((id) => String(id)),
    ),
  );
  const baseContracts =
    baseContractIds.length > 0 ? await ContractModel.find({ _id: { $in: baseContractIds } }).lean() : [];
  const baseContractById = new Map(baseContracts.map((c) => [String(c._id), c]));

  const aktiaClient = new MongoClient(process.env.MONGODB_URI);
  try {
    await aktiaClient.connect();
    const aktiaSymbols = aktiaClient.db("Aktia").collection("Symbols");

    // Batch the underlying lookup by Symbol-Mic in one query (same pattern as
    // companies.ts's preloadSymbolCurrencies) rather than one findOne() per contract.
    const underlyingMics = Array.from(new Set(contracts.map((c) => c.underlyingSymbolMic)));
    const underlyingDocs = await aktiaSymbols
      .find({ "Symbol-Mic": { $in: underlyingMics } })
      .toArray();
    const underlyingDocByMic = new Map(underlyingDocs.map((d) => [d["Symbol-Mic"] as string, d]));

    // Risk-free rate is keyed by currency, not contract - dedupe so a portfolio holding several
    // contracts in the same currency only looks it up once.
    const currencies = Array.from(
      new Set(underlyingDocs.map((d) => (d.Currency as string | undefined) || "").filter(Boolean)),
    );
    const riskFreeRateByCurrency = new Map(
      await Promise.all(currencies.map(async (cur) => [cur, await resolveRiskFreeRate(cur)] as const)),
    );

    // Underlying -> Expiration -> Strike cascade (see resolveContractSettings.ts) - one lookup
    // per contract (each carries its own strike-level overrides), not batched like the Aktia
    // lookups above, but still only paid once per subscribe/resubscribe cycle, not per tick.
    const settingsByContractSymbol = new Map(
      await Promise.all(
        contracts.map(
          async (c) =>
            [
              c.symbol,
              await resolveContractSettings({
                underlyingSymbolMic: c.underlyingSymbolMic,
                expirationDate: c.expirationDate,
                executionStyle: c.executionStyle,
                dayCountConvention: c.dayCountConvention,
                volatilityOffset: c.volatilityOffset,
                rateOffset: c.rateOffset,
                multiplier: c.multiplier,
              }),
            ] as const,
        ),
      ),
    );

    // The underlying's own volatility, always the driver even for future-based options (Black76
    // still uses the underlying's own volatility, just applied to the future's price - see
    // docs/derivatives/02-pricing-engine.md in portfolio-server). Computed once per unique
    // underlying (underlyingMics, from above), not per contract.
    //
    // Keyed by the full TICKER:MIC symbol (e.g. "VOD:XLON"), not the bare ticker - fetchHistory
    // resolves TICKER:MIC unambiguously (that's literally the local CSV filename), but a bare
    // ticker is only safe when Aktia.Symbols has exactly one listing for it. VOD alone has four
    // ("VOD:XLON", "VOD:XJSE", "VOD:XNAS", "VOD:XBUE") - passing bare "VOD" silently failed to
    // resolve, calcHistoricalVolatility returned undefined, and the fallback to Aktia's vendor
    // volatility field (already known unreliable, see resolveVolatility.ts) produced an
    // implausibly low theoPrice. Worked for MSFT only because it happens to have a single listing.
    const historicalVolatilityBySymbol = new Map(
      await Promise.all(
        underlyingMics.map(async (mic) => [mic, await calcHistoricalVolatility(mic)] as const),
      ),
    );

    for (const contract of contracts) {
      const underlyingDoc = underlyingDocByMic.get(contract.underlyingSymbolMic);
      const currency = (underlyingDoc?.Currency as string | undefined) || "";
      const baseContract = contract.baseContractId
        ? baseContractById.get(String(contract.baseContractId))
        : undefined;
      const futureBased = !!baseContract;

      // The live tick driver: the underlying's own TICKER:MIC symbol (e.g. "MSFT:XNAS"), matching
      // the format every equity position/quote/emulation in positions.ts already uses. Using the
      // bare ticker here used to mean a real equity position in the same portfolio (or the
      // console's manual price-emulation panel, which can only target actual grid symbols) could
      // never drive this option's theoPrice, since "MSFT" and "MSFT:XNAS" never matched.
      const priceDriverSymbol = futureBased ? baseContract!.symbol : contract.underlyingSymbolMic;

      const settings = settingsByContractSymbol.get(contract.symbol)!;
      // Prefer real historical realized volatility over Aktia.Symbols' vendor field (see
      // calcHistoricalVolatility.ts) - fall back to the vendor field only when there isn't enough
      // price history to compute one (e.g. a very recently listed security).
      const baseVolatility = historicalVolatilityBySymbol.get(contract.underlyingSymbolMic) ?? resolveVolatility(underlyingDoc);
      const baseRiskFreeRate = riskFreeRateByCurrency.get(currency) ?? 0;

      result[contract.symbol] = {
        contract: contract as unknown as ContractWithID,
        priceDriverSymbol,
        priceDriverCurrency: currency,
        futureBased,
        multiplier: settings.multiplier,
        volatility: baseVolatility + settings.volatilityOffset,
        riskFreeRate: baseRiskFreeRate + settings.rateOffset,
        executionStyle: settings.executionStyle,
        dayCountConvention: settings.dayCountConvention,
      };
    }
  } finally {
    await aktiaClient.close();
  }

  return result;
}
