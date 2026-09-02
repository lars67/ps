import { ExecutionStyle, TheoModel } from "../../types/contract";
import { OptionTheoPriceInputs, calcBinomialDeltaGamma, calcOptionTheoPrice } from "./calcTheoPrice";

// Greeks, ported from portfolio-server/PS_calculator/JCalc.
//
// The key thing to know about the original: almost every greek there is a finite-difference bump
// of CalcTheorPrice, not a model-specific formula - greeks.c takes the price function as a
// pointer and shifts one input at a time (DeltaValue, GammaValue, ThetaValue, VegaValue,
// RhoValue, SpeedValue, CharmValue, ColorValue). Only delta and gamma have fast paths, and only
// for three models: closed form for Black-Scholes and Black-76 (rdelta.c/rgamma.c's
// EuroBSDiv(DELTA|GAMMA) and DeltaEuroBlackCall), and read off the tree for the binomial models
// (DeltaBinom/GammaBinom, in the addon as calcBinomialDeltaGamma).
//
// So this file reproduces the original's *method*, with the same epsilons and the same difference
// expressions, bumping ps2's own ported price function. Deviations are called out inline; the
// only structural one is theta's trading-day shift (see thetaValue).
const F_EPSILON = 1.0e-2; // relative bump on spot (const2.h)
const EPSILON = 1.0e-3; // relative bump on volatility (const2.h)
const MINSPOT = 0.001; // const2.h
const ONEDAY = 0.0025; // const2.h - "one day" in years, as the original defines it

export type Greeks = {
  delta?: number;
  gamma?: number;
  vega?: number;
  theta?: number;
  rho?: number;
  rhoTenBasis?: number;
  rhoOneBasis?: number;
  speed?: number;
  charm?: number;
  color?: number;
};

const price = (inputs: OptionTheoPriceInputs, overrides: Partial<OptionTheoPriceInputs>) =>
  calcOptionTheoPrice({ ...inputs, ...overrides });

// greeks.c DeltaValue: central difference on spot, relative bump.
const deltaValue = (i: OptionTheoPriceInputs): number | undefined => {
  const s = i.spotPrice;
  if (s <= 0) return 0;
  const up = price(i, { spotPrice: s * (1 + F_EPSILON) });
  const down = price(i, { spotPrice: s * (1 - F_EPSILON) });
  if (up === undefined || down === undefined) return undefined;
  return (up - down) / (2 * s * F_EPSILON);
};

// greeks.c GammaValue: second difference on spot.
const gammaValue = (i: OptionTheoPriceInputs): number | undefined => {
  const s = i.spotPrice;
  if (s <= 0) return 0;
  const up = price(i, { spotPrice: s * (1 + F_EPSILON) });
  const down = price(i, { spotPrice: s * (1 - F_EPSILON) });
  const mid = price(i, {});
  if (up === undefined || down === undefined || mid === undefined) return undefined;
  return (up + down - 2 * mid) / (s * s * F_EPSILON * F_EPSILON);
};

// greeks.c VegaValue: central difference on sigma.
//
// UNIT NOTE: rvega.c multiplies this by VOL_FACTOR (0.01) because the original's p->sigma is a
// decimal, so the raw derivative is per 1.00 of volatility and needs scaling to the per-1-
// percentage-point figure traders quote. ps2 carries volatility in percentage points already
// (22 means 22%), so bumping it here yields the per-point number directly and VOL_FACTOR must
// NOT be applied again - doing so made vega come out 100x too small.
const vegaValue = (i: OptionTheoPriceInputs): number | undefined => {
  const vol = i.volatility;
  if (vol <= 0) return 0;
  const up = price(i, { volatility: vol * (1 + EPSILON) });
  const down = price(i, { volatility: vol * (1 - EPSILON) });
  if (up === undefined || down === undefined) return undefined;
  return (up - down) / (2 * vol * EPSILON);
};

// greeks.c ThetaValue: the price given up by moving one *trading* day forward, i.e.
// -(P(today) - P(next trading day)).
//
// DEVIATION, deliberate: the original advances the date with
// dateAfterGivenWorkingDays(..., 1, p->currency), a per-currency holiday calendar. ps2 has no
// holiday calendar of any kind, so this steps over weekends only - Friday's theta covers the
// weekend (3 calendar days), every other day is 1. That matches the original except across
// public holidays, where ps2 will under-state the decay by the holiday's length. Revisit if a
// trading calendar ever lands in ps2.
//
// The original also multiplies by CalcPresentValueAdjust(p), which is 1.0 for every contract
// kind ps2 supports (rawcalc.c: only CONTRACT_FORWARD differs, and only before expiry) - so it
// is not reproduced here.
const tradingDaysToYears = (calcDate: string): number => {
  const d = new Date(calcDate);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const calendarDays = day === 5 ? 3 : day === 6 ? 2 : 1; // Fri -> Mon, Sat -> Mon
  return calendarDays / 365;
};

const thetaValue = (i: OptionTheoPriceInputs, calcDate: string): number | undefined => {
  if (i.timeToExpiry <= 0) return 0;
  const now = price(i, {});
  const shift = tradingDaysToYears(calcDate);
  const later = price(i, { timeToExpiry: Math.max(i.timeToExpiry - shift, 0) });
  if (now === undefined || later === undefined) return undefined;
  return -(now - later);
};

// greeks.c RhoValue and its 10bp/1bp siblings: a forward (not central) difference, bumping the
// rate by an absolute amount. The original bumps riskFreeRate and baseRiskFreeRate together and,
// for Black-76, also lifts basePrice by exp(baseRateTime * bump) so the forward moves with the
// curve - reproduced below via the same exp(bump * T) scaling of the future price.
const rhoBumped = (i: OptionTheoPriceInputs, bump: number): number | undefined => {
  const base = price(i, {});
  const overrides: Partial<OptionTheoPriceInputs> = { riskFreeRate: i.riskFreeRate + bump * 100 };
  if (i.futureBased) overrides.spotPrice = i.spotPrice * Math.exp(bump * i.timeToExpiry);
  const bumped = price(i, overrides);
  if (base === undefined || bumped === undefined) return undefined;
  return bumped - base;
};

// greeks.c SpeedValue: for the binomial models a central difference of *gamma*; otherwise a
// four-point bump of the price. Third derivative w.r.t. spot.
const speedValue = (i: OptionTheoPriceInputs, isBinomial: boolean): number | undefined => {
  const s = i.spotPrice;
  if (s <= 0) return 0;
  if (i.timeToExpiry <= 0) return 0;

  if (isBinomial) {
    const up = gammaValue({ ...i, spotPrice: s * (1 + F_EPSILON) });
    const down = gammaValue({ ...i, spotPrice: s * (1 - F_EPSILON) });
    if (up === undefined || down === undefined) return undefined;
    return (up - down) / (2 * s * F_EPSILON);
  }

  const upup = price(i, { spotPrice: s * (1 + 2 * F_EPSILON) });
  const downdown = price(i, { spotPrice: s * (1 - 2 * F_EPSILON) });
  const up = price(i, { spotPrice: s * (1 + F_EPSILON) });
  const down = price(i, { spotPrice: s * (1 - F_EPSILON) });
  if (upup === undefined || downdown === undefined || up === undefined || down === undefined) {
    return undefined;
  }
  return (upup - downdown - 2 * up + 2 * down) / (2 * s * s * s * F_EPSILON * F_EPSILON * F_EPSILON);
};

export type GreeksInputs = OptionTheoPriceInputs & {
  calcDate: string; // YYYY-MM-DD, for theta/charm/color's trading-day shift
  executionStyle: ExecutionStyle;
};

// Closed-form delta/gamma for the two models the original does not bump (rdelta.c/rgamma.c's
// MODEL_BLACKSCHOLES and MODEL_BLACK76 branches). Standard Black-Scholes-with-continuous-yield
// and Black-76 expressions; d1 is formed exactly as the price functions do.
const normPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
const normCdf = (x: number) => {
  // Abramowitz & Stegun 7.1.26, the same approximation family distrib.c uses.
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
};

const closedFormDeltaGamma = (i: GreeksInputs): { delta: number; gamma: number } | undefined => {
  const { spotPrice: S, strike: K, timeToExpiry: T, isCall, futureBased } = i;
  const sigma = i.volatility / 100;
  const r = i.riskFreeRate / 100;
  const q = i.dividendRate / 100;
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return undefined;

  const sqrtT = Math.sqrt(T);

  if (futureBased) {
    // Black-76 on the future's own price, discounted - matches calcTheoPrice's european+
    // futureBased branch (EuroBlackCall/Put then exp(-r*T)).
    const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
    const disc = Math.exp(-r * T);
    return {
      delta: disc * (isCall ? normCdf(d1) : normCdf(d1) - 1),
      gamma: (disc * normPdf(d1)) / (S * sigma * sqrtT),
    };
  }

  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const carry = Math.exp(-q * T);
  return {
    delta: carry * (isCall ? normCdf(d1) : normCdf(d1) - 1),
    gamma: (carry * normPdf(d1)) / (S * sigma * sqrtT),
  };
};

// Dispatch mirrors rdelta.c/rgamma.c's model switch.
const deltaGamma = (i: GreeksInputs): { delta?: number; gamma?: number } => {
  const isBinomial =
    i.theoModel === TheoModel.AmericanBinomial || i.theoModel === TheoModel.EuroBinomial;

  // Expiry-day special cases, from rdelta.c/rgamma.c's `volatilityTime <= ONEDAY` branch.
  if (i.timeToExpiry <= ONEDAY) {
    const atTheMoney = Math.abs(i.spotPrice - i.strike) < 0.01;
    const itm = i.isCall ? i.spotPrice > i.strike : i.spotPrice < i.strike;
    const delta = atTheMoney ? (i.isCall ? 0.5 : -0.5) : itm ? (i.isCall ? 1 : -1) : 0;
    return { delta, gamma: atTheMoney ? undefined : 0 };
  }

  if (isBinomial) {
    const fromTree = calcBinomialDeltaGamma({
      isCall: i.isCall,
      isAmerican: i.executionStyle !== ExecutionStyle.European,
      futureBased: i.futureBased,
      spotPrice: i.spotPrice,
      strike: i.strike,
      timeToExpiry: i.timeToExpiry,
      riskFreeRate: i.riskFreeRate,
      dividendRate: i.dividendRate,
      volatility: i.volatility,
    });
    if (fromTree) return fromTree;
  } else {
    const closed = closedFormDeltaGamma(i);
    if (closed) return closed;
  }

  // Every other model (and any fallback) bumps the price, as the original does for
  // Black76American/Bjerksund/MacMillan/Geske.
  return { delta: deltaValue(i), gamma: gammaValue(i) };
};

// rdelta.c/rgamma.c clamp their results: a vanilla call's delta lives in [0,1] (put [-1,0]) and
// gamma is non-negative by convexity. Applied after any of the paths above.
const clamp = (v: number | undefined, lo: number, hi: number) =>
  v === undefined ? undefined : Math.min(hi, Math.max(lo, v));

export function calcGreeks(i: GreeksInputs): Greeks {
  if (i.spotPrice <= MINSPOT) return {};
  if (i.timeToExpiry <= 0) return {};

  const isBinomial =
    i.theoModel === TheoModel.AmericanBinomial || i.theoModel === TheoModel.EuroBinomial;

  const { delta, gamma } = deltaGamma(i);
  const vega = vegaValue(i);

  // Charm and color are the one-trading-day changes in delta and gamma (greeks.c CharmValue /
  // ColorValue), so they cost a second full delta/gamma evaluation each.
  const shift = tradingDaysToYears(i.calcDate);
  const tomorrow: GreeksInputs = { ...i, timeToExpiry: Math.max(i.timeToExpiry - shift, 0) };
  const tomorrowDeltaGamma = tomorrow.timeToExpiry > 0 ? deltaGamma(tomorrow) : {};

  const charm =
    delta !== undefined && tomorrowDeltaGamma.delta !== undefined
      ? -(delta - tomorrowDeltaGamma.delta)
      : undefined;
  const color =
    gamma !== undefined && tomorrowDeltaGamma.gamma !== undefined
      ? -(gamma - tomorrowDeltaGamma.gamma)
      : undefined;

  return {
    delta: clamp(delta, i.isCall ? 0 : -1, i.isCall ? 1 : 0),
    gamma: clamp(gamma, 0, Number.POSITIVE_INFINITY),
    vega,
    theta: thetaValue(i, i.calcDate),
    rho: rhoBumped(i, 0.01),
    rhoTenBasis: rhoBumped(i, 0.001),
    rhoOneBasis: rhoBumped(i, 0.0001),
    speed: speedValue(i, isBinomial),
    charm,
    color,
  };
}
