import "dotenv/config";
import mongoose from "mongoose";
import { getTheoPrice, GetTheoPriceParams } from "../src/services/derivatives/getTheoPrice";

// Test suite for the greeks (server/src/services/derivatives/calcGreeks.ts, a port of JCalc's
// greeks.c / rdelta.c / rgamma.c / rvega.c / rtheta.c / rrho.c).
//
// The European path is checked against independently-coded textbook Black-Scholes greeks. The
// American path has no closed form to compare against, so it is checked by the relationships
// that must hold between an American option and its European twin, and by the analytic
// identities that hold for any model (put-call parity of delta, gamma equal for call and put).
//
// Like getTheoPrice.test.ts, every case uses daysToExpiration and an explicit calcDate so the
// suite does not rot, and overrides every pricing input so no live market data is involved.

let passed = 0;
let failed = 0;
const failures: string[] = [];

function record(ok: boolean, label: string, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label + (detail ? ` - ${detail}` : ""));
    console.log(`  ❌ ${label}${detail ? ` - ${detail}` : ""}`);
  }
}

function assertClose(label: string, actual: number | undefined, expected: number, tol: number) {
  if (actual == null || !isFinite(actual)) {
    record(false, label, `got ${actual}, expected ~${expected}`);
    return;
  }
  const ok = Math.abs(actual - expected) <= tol;
  record(ok, label, ok ? undefined : `got ${actual}, expected ${expected} (±${tol})`);
}

function assertTrue(label: string, ok: boolean, detail?: string) {
  record(ok, label, detail);
}

// --- Independently-coded Black-Scholes greeks (continuous dividend yield) ---
const normPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
const erf = (x: number) => {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return (
    s *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x))
  );
};
const N = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

function refGreeks(isCall: boolean, S: number, K: number, T: number, r: number, q: number, sig: number) {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sig * sig) * T) / (sig * sqrtT);
  const d2 = d1 - sig * sqrtT;
  const thetaPerYear = isCall
    ? -(S * normPdf(d1) * sig * Math.exp(-q * T)) / (2 * sqrtT) +
      q * S * Math.exp(-q * T) * N(d1) -
      r * K * Math.exp(-r * T) * N(d2)
    : -(S * normPdf(d1) * sig * Math.exp(-q * T)) / (2 * sqrtT) -
      q * S * Math.exp(-q * T) * N(-d1) +
      r * K * Math.exp(-r * T) * N(-d2);
  return {
    delta: Math.exp(-q * T) * (isCall ? N(d1) : N(d1) - 1),
    gamma: (Math.exp(-q * T) * normPdf(d1)) / (S * sig * sqrtT),
    vega: S * Math.exp(-q * T) * normPdf(d1) * sqrtT * 0.01, // per 1 volatility point
    thetaPerDay: thetaPerYear / 365,
    rho: (isCall ? K * T * Math.exp(-r * T) * N(d2) : -K * T * Math.exp(-r * T) * N(-d2)) * 0.01,
  };
}

// 2026-09-02 is a Wednesday, so theta's trading-day shift is a single calendar day - pinned so
// the expected theta does not change with the day the suite happens to run.
const CALC_DATE = "2026-09-02";
const DAYS = 182;
const T = DAYS / 365;
const [S, SIG, R, Q] = [100, 0.22, 0.045, 0.012];

const base = {
  underlyingSymbolMic: "MSFT:XNAS",
  daysToExpiration: DAYS,
  calcDate: CALC_DATE,
  spotPrice: S,
  volatility: SIG * 100,
  interestRate: R * 100,
  dividendRate: Q * 100,
  dayCountConvention: "act365",
} as const;

const euro = (contractType: "call" | "put", strike: number): GetTheoPriceParams => ({
  ...base,
  contractType,
  strike,
  executionStyle: "european",
});

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log(`Connected to ${process.env.MONGODB_URI}\n`);

  console.log("--- European (Black-Scholes) vs. independently-coded analytic greeks ---");
  for (const [label, type, strike] of [
    ["ATM call", "call", 100],
    ["ATM put", "put", 100],
    ["OTM call", "call", 120],
    ["ITM put", "put", 120],
  ] as const) {
    const res = await getTheoPrice(euro(type, strike));
    const g = res.greeks;
    const ref = refGreeks(type === "call", S, strike, T, R, Q, SIG);
    assertTrue(`${label}: greeks returned`, !!g, res.error);
    if (!g) continue;
    // delta/gamma are closed-form here (rdelta.c/rgamma.c's MODEL_BLACKSCHOLES branch), so they
    // should agree to floating-point noise, not merely to bump precision.
    assertClose(`${label}: delta`, g.delta, ref.delta, 1e-9);
    assertClose(`${label}: gamma`, g.gamma, ref.gamma, 1e-9);
    // vega/theta are finite-difference bumps, as in the original.
    assertClose(`${label}: vega`, g.vega, ref.vega, 1e-5);
    assertClose(`${label}: theta`, g.theta, ref.thetaPerDay, 1e-4);
    // rho is a forward difference over a full percentage point, so it carries an O(bump) bias by
    // construction - the 1bp version is the one that should sit right on the analytic value.
    assertClose(`${label}: rho (1pp, biased by design)`, g.rho, ref.rho, 5e-3);
    assertClose(`${label}: rhoOneBasis x100 ~ analytic rho`, (g.rhoOneBasis ?? 0) * 100, ref.rho, 5e-4);
    assertTrue(`${label}: speed/charm/color present`, [g.speed, g.charm, g.color].every((v) => typeof v === "number" && isFinite(v)));
  }

  console.log("\n--- Model-independent identities ---");
  const callG = (await getTheoPrice(euro("call", 100))).greeks!;
  const putG = (await getTheoPrice(euro("put", 100))).greeks!;
  // delta_call - delta_put = e^{-qT}
  assertClose(
    "put-call parity of delta: delta(call) - delta(put) = exp(-qT)",
    (callG.delta ?? 0) - (putG.delta ?? 0),
    Math.exp(-Q * T),
    1e-9,
  );
  assertClose("gamma identical for call and put", callG.gamma, putG.gamma ?? 0, 1e-12);
  assertClose("vega identical for call and put", callG.vega, putG.vega ?? 0, 1e-9);
  assertTrue("call rho positive, put rho negative", (callG.rho ?? 0) > 0 && (putG.rho ?? 0) < 0);
  assertTrue("both thetas negative (long option decays)", (callG.theta ?? 0) < 0 && (putG.theta ?? 0) < 0);

  console.log("\n--- American (binomial, delta/gamma read off the tree) ---");
  const amPut = await getTheoPrice({ ...base, contractType: "put", strike: 100, executionStyle: "american" });
  const euPut = await getTheoPrice(euro("put", 100));
  assertTrue("American put is worth at least the European", (amPut.theoPrice ?? 0) >= (euPut.theoPrice ?? 0));
  assertTrue("American put delta is more negative than European", (amPut.greeks?.delta ?? 0) < (euPut.greeks?.delta ?? 0));
  assertTrue("American put gamma is positive", (amPut.greeks?.gamma ?? -1) > 0);
  assertTrue(
    "tree delta is in a sane range for a near-ATM put",
    (amPut.greeks?.delta ?? 0) < -0.3 && (amPut.greeks?.delta ?? 0) > -0.7,
    `got ${amPut.greeks?.delta}`,
  );
  assertTrue("American put theta negative", (amPut.greeks?.theta ?? 0) < 0);
  assertTrue(
    "American greeks are all finite",
    Object.values(amPut.greeks ?? {}).every((v) => v === undefined || isFinite(v as number)),
  );

  console.log("\n--- Clamps (rdelta.c/rgamma.c) ---");
  const deepItmCall = await getTheoPrice({ ...base, contractType: "call", strike: 1, executionStyle: "european" });
  const deepOtmCall = await getTheoPrice({ ...base, contractType: "call", strike: 10000, executionStyle: "european" });
  assertTrue("deep ITM call delta <= 1", (deepItmCall.greeks?.delta ?? 9) <= 1);
  assertTrue("deep OTM call delta >= 0", (deepOtmCall.greeks?.delta ?? -9) >= 0);
  assertTrue("gamma never negative", (deepItmCall.greeks?.gamma ?? -1) >= 0 && (deepOtmCall.greeks?.gamma ?? -1) >= 0);

  console.log("\n--- Contracts that have no option greeks ---");
  const future = await getTheoPrice({ ...base, underlyingSymbolMic: "SPY:ARCX", contractType: "future" });
  assertTrue("plain future has a price but no greeks", future.theoPrice !== undefined && future.greeks === undefined);

  const expired = await getTheoPrice({ ...base, contractType: "call", strike: 100, daysToExpiration: -10 });
  assertTrue("expired option has neither price nor greeks", expired.theoPrice === undefined && expired.greeks === undefined);

  console.log("\n--- Option on a future (Black-76 closed form) ---");
  const b76 = await getTheoPrice({
    ...base,
    underlyingSymbolMic: "SPY:ARCX",
    contractType: "call",
    strike: 100,
    executionStyle: "european",
    theoModel: "black76",
  });
  // Black-76 delta is discounted N(d1); with F = K it is just below exp(-rT)/2.
  assertTrue("Black-76 greeks returned", !!b76.greeks, b76.error);
  assertTrue(
    "Black-76 ATM call delta is a shade above exp(-rT)/2",
    (b76.greeks?.delta ?? 0) > 0.45 && (b76.greeks?.delta ?? 0) < 0.6,
    `got ${b76.greeks?.delta}`,
  );
  assertTrue("Black-76 gamma positive", (b76.greeks?.gamma ?? -1) > 0);

  console.log(`\n${"=".repeat(60)}\nResults: ${passed} passed, ${failed} failed\n${"=".repeat(60)}`);
  if (failed > 0) {
    console.log("\nFailed:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
