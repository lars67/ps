import path from "path";
import { ContractCalcContext } from "./buildContractCalcContexts";
import { ExecutionStyle, TheoModel, isCallContractType } from "../../types/contract";
import { calcYearFraction } from "./dayCount";

export type TheoPriceInputs = ContractCalcContext & {
  spotPrice: number;
  calcDate: string; // YYYY-MM-DD
};

interface JCalcAddon {
  calcTheoPrice(params: {
    isCall: boolean;
    european: boolean;
    futureBased: boolean;
    spot: number;
    strike: number;
    timeToExpiry: number;
    riskFreeRate: number;
    dividendYield: number;
    volatility: number;
  }): number;
}

// Native addon wrapping the ported subset of JCalc (server/native/jcalc - eurobs.c/black76.c/
// binomial.c, ported from portfolio-server/PS_calculator/JCalc; see that dir's binding.gyp/addon.cc
// for the N-API boundary). Loaded lazily and cached; a missing/unbuilt addon degrades to "not yet
// computable" rather than crashing the server (see docs/derivatives/03-migration-notes.md in
// portfolio-server for the "JCalc reuse strategy" this follows).
let addon: JCalcAddon | null = null;
let addonLoadFailed = false;
function loadAddon(): JCalcAddon | null {
  if (addon || addonLoadFailed) return addon;
  try {
    addon = require(path.join(__dirname, "../../../native/jcalc/build/Release/jcalc.node"));
  } catch (err) {
    addonLoadFailed = true;
    console.error("[calcTheoPrice] failed to load native JCalc addon (run `npm run build:jcalc`):", err);
  }
  return addon;
}

// Models actually implemented by the ported addon. bjerksund/baroneAdesi/geske/macMillan remain
// valid manual TheoModel overrides (see types/contract.ts) but aren't ported yet - a contract
// carrying one of those returns undefined ("not yet computable") rather than silently substituting
// a different model than the one assigned.
const SUPPORTED_MODELS = new Set<TheoModel>([
  TheoModel.BlackScholes,
  TheoModel.Black76,
  TheoModel.Black76American,
  TheoModel.AmericanBinomial,
  TheoModel.EuroBinomial,
]);

// Dispatch mirrors portfolio-server/PS_calculator/JCalc/rtheor.c's CalcTheorPrice_Call/_Put:
// European contracts price via the closed-form Black-Scholes (spot-based) or Black-76
// (future-based) formula; American contracts (either asset class) price via the binomial tree,
// since Bjerksund/Whaley (the old system's American approximations) aren't ported - see
// selectTheoModel.ts, which now assigns americanBinomial to every American contract for exactly
// this reason. Execution style and time-to-expiry (via dayCountConvention) come from the resolved
// Underlying -> Expiration -> Strike cascade (see resolveContractSettings.ts /
// buildContractCalcContexts.ts), not from contract.contractType directly - exercise style is its
// own cascading field, separate from call/put direction (see types/contract.ts).
export function calcTheoPrice(inputs: TheoPriceInputs): number | undefined {
  const { contract, spotPrice, calcDate, volatility, riskFreeRate, futureBased, executionStyle, dayCountConvention } =
    inputs;

  if (!contract.theoModel || !SUPPORTED_MODELS.has(contract.theoModel)) return undefined;
  if (contract.strike == null) return undefined;

  const jcalc = loadAddon();
  if (!jcalc) return undefined;

  const timeToExpiry = calcYearFraction(calcDate, contract.expirationDate, dayCountConvention);
  if (timeToExpiry <= 0) return undefined;

  return jcalc.calcTheoPrice({
    isCall: isCallContractType(contract.contractType),
    european: executionStyle === ExecutionStyle.European,
    futureBased,
    spot: spotPrice,
    strike: contract.strike,
    timeToExpiry,
    riskFreeRate: riskFreeRate / 100,
    dividendYield: (contract.dividendRate ?? 0) / 100,
    volatility: volatility / 100,
  });
}
