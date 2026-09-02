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
  calcBinomialDeltaGamma(params: {
    isCall: boolean;
    isAmerican: boolean;
    futureBased: boolean;
    spot: number;
    strike: number;
    timeToExpiry: number;
    riskFreeRate: number;
    dividendYield: number;
    volatility: number;
  }): { delta: number; gamma: number };
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

export type OptionTheoPriceInputs = {
  theoModel: TheoModel | undefined;
  isCall: boolean;
  european: boolean;
  futureBased: boolean;
  spotPrice: number;
  strike: number;
  timeToExpiry: number; // year fraction, already computed via calcYearFraction
  riskFreeRate: number; // percentage points, e.g. 4.5 for 4.5%
  dividendRate: number; // percentage points, continuous yield
  volatility: number; // percentage points
};

// The primitive core both calcTheoPrice() (below, for real held positions) and
// getTheoPrice.ts (the ad-hoc GetTheoPrice command, which has no persisted Contract document to
// read from) dispatch through - takes already-resolved values only, no DB/cascade lookups here.
export function calcOptionTheoPrice(inputs: OptionTheoPriceInputs): number | undefined {
  const { theoModel, isCall, european, futureBased, spotPrice, strike, timeToExpiry, riskFreeRate, dividendRate, volatility } =
    inputs;

  if (!theoModel || !SUPPORTED_MODELS.has(theoModel)) return undefined;
  if (timeToExpiry <= 0) return undefined;

  const jcalc = loadAddon();
  if (!jcalc) return undefined;

  return jcalc.calcTheoPrice({
    isCall,
    european,
    futureBased,
    spot: spotPrice,
    strike,
    timeToExpiry,
    riskFreeRate: riskFreeRate / 100,
    dividendYield: dividendRate / 100,
    volatility: volatility / 100,
  });
}

// Delta/gamma read straight off the binomial tree (the addon's port of binom.c's DeltaBinom/
// GammaBinom). Only the binomial models use this - see calcGreeks.ts, which uses closed-form
// expressions for Black-Scholes/Black-76 and bumps the price for everything else, mirroring
// rdelta.c/rgamma.c's model switch.
export function calcBinomialDeltaGamma(inputs: {
  isCall: boolean;
  isAmerican: boolean;
  futureBased: boolean;
  spotPrice: number;
  strike: number;
  timeToExpiry: number;
  riskFreeRate: number; // percentage points
  dividendRate: number; // percentage points
  volatility: number; // percentage points
}): { delta: number; gamma: number } | undefined {
  if (inputs.timeToExpiry <= 0) return undefined;

  const jcalc = loadAddon();
  if (!jcalc) return undefined;

  return jcalc.calcBinomialDeltaGamma({
    isCall: inputs.isCall,
    isAmerican: inputs.isAmerican,
    futureBased: inputs.futureBased,
    spot: inputs.spotPrice,
    strike: inputs.strike,
    timeToExpiry: inputs.timeToExpiry,
    riskFreeRate: inputs.riskFreeRate / 100,
    dividendYield: inputs.dividendRate / 100,
    volatility: inputs.volatility / 100,
  });
}

// Cost-of-carry theoretical price for a plain future/forward (not an option-on-future - those go
// through calcOptionTheoPrice's Black-76/Black76American path instead). Mirrors
// portfolio-server/PS_calculator/JCalc/maked.c:229's `theorFuturePrice = (theorSpotPrice - PVDiv) *
// exp((financingRate - yield) * rateTime)`, but with continuous dividend yield in place of PVDiv
// (the present value of discrete dividends) - ps2 has no discrete dividend-schedule collection
// (see docs/derivatives-todo.md item 6), and every other model in this file already applies
// dividends the same continuous-yield way (see eurobs.c's addon-side exp(-q*T) spot scaling). With
// a continuous yield q this reduces to the standard F = S * e^((r-q)*T) cost-of-carry formula -
// numerically simple enough to not need the native addon for parity, unlike the option models.
export function calcFutureTheoPrice(inputs: {
  spotPrice: number;
  timeToExpiry: number;
  riskFreeRate: number; // percentage points
  dividendRate: number; // percentage points, continuous yield
}): number | undefined {
  const { spotPrice, timeToExpiry, riskFreeRate, dividendRate } = inputs;
  if (timeToExpiry <= 0) return undefined;
  return spotPrice * Math.exp(((riskFreeRate - dividendRate) / 100) * timeToExpiry);
}

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

  if (contract.strike == null) return undefined;

  const timeToExpiry = calcYearFraction(calcDate, contract.expirationDate, dayCountConvention);

  return calcOptionTheoPrice({
    theoModel: contract.theoModel,
    isCall: isCallContractType(contract.contractType),
    european: executionStyle === ExecutionStyle.European,
    futureBased,
    spotPrice,
    strike: contract.strike,
    timeToExpiry,
    riskFreeRate,
    dividendRate: contract.dividendRate ?? 0,
    volatility,
  });
}
