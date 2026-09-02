import "dotenv/config";
import mongoose from "mongoose";
import { getTheoPrice, GetTheoPriceParams } from "../src/services/derivatives/getTheoPrice";
import { ContractModel } from "../src/models/contract";

// Test suite for tools.theoPrice (server/src/services/derivatives/getTheoPrice.ts).
//
// Every scenario uses `daysToExpiration` (a fixed offset from "today") rather than a hardcoded
// absolute expirationDate, so this suite keeps passing indefinitely instead of quietly rotting
// once a hardcoded date falls into the past - the exact problem daysToExpiration was added to
// solve (see getTheoPrice.ts's GetTheoPriceParams comment).
//
// Deterministic scenarios (manual overrides, no live price/volatility data) are checked against
// independently-coded reference implementations of Black-Scholes, Black-76, a CRR binomial tree,
// and the cost-of-carry formula - a real correctness check, not just "didn't throw". The one
// scenario that touches live market data (auto-resolved spot/vol/rate/dividend) is checked for
// sane bounds only, since its numeric answer moves with the market.

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

function assertClose(label: string, actual: number | undefined, expected: number, relTol = 0.005) {
  if (actual == null || !isFinite(actual)) {
    record(false, label, `got ${actual}, expected ~${expected.toFixed(4)}`);
    return;
  }
  const tol = Math.max(Math.abs(expected) * relTol, 0.01);
  const ok = Math.abs(actual - expected) <= tol;
  record(ok, label, ok ? undefined : `got ${actual.toFixed(4)}, expected ${expected.toFixed(4)} (±${tol.toFixed(4)})`);
}

function assertTrue(label: string, ok: boolean, detail?: string) {
  record(ok, label, detail);
}

function assertError(label: string, result: { error?: string }, expectedSubstring?: string) {
  const ok = !!result.error && (!expectedSubstring || result.error.includes(expectedSubstring));
  record(ok, label, ok ? undefined : `got ${JSON.stringify(result)}`);
}

// --- Reference implementations, coded independently of server/src's calcTheoPrice.ts/JCalc addon ---

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

function refBlackScholes(isCall: boolean, S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return isCall
    ? S * Math.exp(-q * T) * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
    : K * Math.exp(-r * T) * normCdf(-d2) - S * Math.exp(-q * T) * normCdf(-d1);
}

function refBlack76(isCall: boolean, F: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const disc = Math.exp(-r * T);
  return isCall ? disc * (F * normCdf(d1) - K * normCdf(d2)) : disc * (K * normCdf(-d2) - F * normCdf(-d1));
}

function refCostOfCarry(S: number, T: number, r: number, q: number): number {
  return S * Math.exp((r - q) * T);
}

// Independent CRR binomial (American exercise, continuous cost-of-carry b = r - q) - cross-checks
// server/native/jcalc/src/binomial.c's own CRR port without sharing any code with it.
function refAmericanBinomial(isCall: boolean, S: number, K: number, T: number, r: number, q: number, sigma: number, steps = 1000): number {
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const disc = Math.exp(-r * dt);
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  const values: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const ST = S * Math.pow(u, steps - i) * Math.pow(d, i);
    values.push(isCall ? Math.max(ST - K, 0) : Math.max(K - ST, 0));
  }
  for (let step = steps - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const ST = S * Math.pow(u, step - i) * Math.pow(d, i);
      const hold = disc * (p * values[i] + (1 - p) * values[i + 1]);
      const exercise = isCall ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
      values[i] = Math.max(hold, exercise);
    }
  }
  return values[0];
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log(`Connected to ${process.env.MONGODB_URI}\n`);

  console.log("--- Validation errors ---");
  assertError("missing underlyingSymbolMic", await getTheoPrice({} as GetTheoPriceParams));
  assertError(
    "missing both expirationDate and daysToExpiration",
    await getTheoPrice({ underlyingSymbolMic: "MSFT:XNAS", contractType: "call", strike: 100 } as GetTheoPriceParams),
    "daysToExpiration is required",
  );
  assertError(
    "both expirationDate and daysToExpiration given",
    await getTheoPrice({
      underlyingSymbolMic: "MSFT:XNAS",
      contractType: "call",
      strike: 100,
      expirationDate: "2099-01-01",
      daysToExpiration: 30,
    }),
    "not both",
  );
  assertError(
    "invalid contractType",
    await getTheoPrice({ underlyingSymbolMic: "MSFT:XNAS", contractType: "swaption", daysToExpiration: 30 } as GetTheoPriceParams),
    "contractType must be one of",
  );
  assertError(
    "missing strike for call",
    await getTheoPrice({ underlyingSymbolMic: "MSFT:XNAS", contractType: "call", daysToExpiration: 30 }),
    "strike is required",
  );
  assertError(
    "invalid executionStyle",
    await getTheoPrice({
      underlyingSymbolMic: "MSFT:XNAS",
      contractType: "call",
      strike: 100,
      daysToExpiration: 30,
      executionStyle: "bermudan",
    }),
    "executionStyle must be one of",
  );
  assertError(
    "invalid dayCountConvention",
    await getTheoPrice({
      underlyingSymbolMic: "MSFT:XNAS",
      contractType: "call",
      strike: 100,
      daysToExpiration: 30,
      dayCountConvention: "act360",
    }),
    "dayCountConvention must be one of",
  );
  assertError(
    "invalid theoModel",
    await getTheoPrice({
      underlyingSymbolMic: "MSFT:XNAS",
      contractType: "call",
      strike: 100,
      daysToExpiration: 30,
      theoModel: "monteCarlo",
    }),
    "theoModel must be one of",
  );
  assertError(
    "unknown baseContractId",
    await getTheoPrice({
      underlyingSymbolMic: "MSFT:XNAS",
      contractType: "call",
      strike: 100,
      daysToExpiration: 30,
      baseContractId: "000000000000000000000000",
    }),
    "not found",
  );

  console.log("\n--- Already-expired contracts (daysToExpiration in the past) ---");
  const expiredOption = await getTheoPrice({
    underlyingSymbolMic: "MSFT:XNAS",
    contractType: "call",
    strike: 400,
    daysToExpiration: -30,
    spotPrice: 400,
    volatility: 25,
    interestRate: 4,
    dividendRate: 1,
  });
  assertError("expired option returns error, not a stale price", expiredOption, "already expired");
  assertTrue("expired option theoPrice is undefined", expiredOption.theoPrice === undefined);

  const expiredFuture = await getTheoPrice({
    underlyingSymbolMic: "SPY:ARCX",
    contractType: "future",
    daysToExpiration: -30,
    spotPrice: 500,
    interestRate: 4,
    dividendRate: 1,
  });
  assertError("expired future returns error, not a stale price", expiredFuture, "already expired");

  console.log("\n--- daysToExpiration resolves to the right time-to-expiry (act365) ---");
  const daysCheck = await getTheoPrice({
    underlyingSymbolMic: "MSFT:XNAS",
    contractType: "call",
    strike: 400,
    daysToExpiration: 73,
    spotPrice: 400,
    volatility: 25,
    interestRate: 4,
    dividendRate: 1,
    dayCountConvention: "act365",
  });
  assertClose("timeToExpiry ≈ 73/365", daysCheck.resolved?.timeToExpiry, 73 / 365, 0.001);

  console.log("\n--- Deterministic European Black-Scholes (manual overrides, act365) ---");
  const bsParamsBase = {
    underlyingSymbolMic: "MSFT:XNAS",
    daysToExpiration: 182,
    spotPrice: 100,
    volatility: 22,
    interestRate: 4.5,
    dividendRate: 1.2,
    dayCountConvention: "act365",
    executionStyle: "european",
  } as const;
  const T_bs = 182 / 365;
  const [S, sigma, r, q] = [100, 0.22, 0.045, 0.012];

  const bsCall = await getTheoPrice({ ...bsParamsBase, contractType: "call", strike: 105 });
  assertTrue("BS call resolved blackScholes model", bsCall.resolved?.theoModel === "blackScholes");
  assertClose("BS call price matches reference formula", bsCall.theoPrice, refBlackScholes(true, S, 105, T_bs, r, q, sigma));

  const bsPut = await getTheoPrice({ ...bsParamsBase, contractType: "put", strike: 95 });
  assertTrue("BS put resolved blackScholes model", bsPut.resolved?.theoModel === "blackScholes");
  assertClose("BS put price matches reference formula", bsPut.theoPrice, refBlackScholes(false, S, 95, T_bs, r, q, sigma));

  console.log("\n--- Deterministic American binomial (manual overrides) vs. independent CRR tree ---");
  const amParamsBase = {
    underlyingSymbolMic: "MSFT:XNAS",
    daysToExpiration: 182,
    spotPrice: 100,
    volatility: 30,
    interestRate: 5,
    dividendRate: 3, // deliberately > rate, so American call early-exercise premium is non-trivial
    dayCountConvention: "act365",
    executionStyle: "american",
  } as const;
  const [S2, sigma2, r2, q2] = [100, 0.3, 0.05, 0.03];

  const amCall = await getTheoPrice({ ...amParamsBase, contractType: "call", strike: 100 });
  assertTrue("American call resolved americanBinomial model", amCall.resolved?.theoModel === "americanBinomial");
  assertClose(
    "American call price matches reference CRR tree",
    amCall.theoPrice,
    refAmericanBinomial(true, S2, 100, T_bs, r2, q2, sigma2),
    0.02,
  );

  const amPut = await getTheoPrice({ ...amParamsBase, contractType: "put", strike: 100 });
  assertClose(
    "American put price matches reference CRR tree",
    amPut.theoPrice,
    refAmericanBinomial(false, S2, 100, T_bs, r2, q2, sigma2),
    0.02,
  );

  console.log("\n--- Deterministic plain future/forward cost-of-carry (manual overrides) ---");
  const carryParams = { spotPrice: 4500, interestRate: 4.25, dividendRate: 1.3, daysToExpiration: 45, dayCountConvention: "act365" } as const;
  const T_carry = 45 / 365;
  const expectedCarry = refCostOfCarry(4500, T_carry, 0.0425, 0.013);

  const future = await getTheoPrice({ ...carryParams, underlyingSymbolMic: "SPY:ARCX", contractType: "future" });
  assertTrue("future has no theoModel (cost-of-carry, not a JCalc model)", future.resolved?.theoModel === undefined);
  assertClose("future price matches cost-of-carry formula", future.theoPrice, expectedCarry);

  const forward = await getTheoPrice({ ...carryParams, underlyingSymbolMic: "SPY:ARCX", contractType: "forward" });
  assertClose("forward price matches cost-of-carry formula", forward.theoPrice, expectedCarry);

  console.log("\n--- Option-on-future via baseContractId (Black-76 / Black-76-American), manual overrides ---");
  const testFutureSymbolMic = "TESTFUT:XCME";
  const futureContract = await ContractModel.findOneAndUpdate(
    { underlyingSymbolMic: testFutureSymbolMic, contractType: "future", expirationDate: "2099-12-31" },
    { $set: { symbol: "TESTFUTSYM" } },
    { upsert: true, new: true },
  );
  try {
    const black76Params = {
      underlyingSymbolMic: testFutureSymbolMic,
      baseContractId: futureContract._id.toString(),
      daysToExpiration: 91,
      spotPrice: 5000, // the FUTURE's price, since baseContractId is set
      volatility: 18,
      interestRate: 4,
      dividendRate: 0, // irrelevant for Black-76 - the future price already embeds carry
      dayCountConvention: "act365",
      executionStyle: "european",
    } as const;
    const T_76 = 91 / 365;
    const [F, sigma76, r76] = [5000, 0.18, 0.04];

    const b76Call = await getTheoPrice({ ...black76Params, contractType: "call", strike: 5100 });
    assertTrue("Black-76 call resolved as futureBased", b76Call.resolved?.futureBased === true);
    assertTrue("Black-76 call resolved black76 model", b76Call.resolved?.theoModel === "black76");
    assertClose("Black-76 call price matches reference formula", b76Call.theoPrice, refBlack76(true, F, 5100, T_76, r76, sigma76));

    const b76Put = await getTheoPrice({ ...black76Params, contractType: "put", strike: 4900 });
    assertClose("Black-76 put price matches reference formula", b76Put.theoPrice, refBlack76(false, F, 4900, T_76, r76, sigma76));
  } finally {
    await ContractModel.deleteOne({ _id: futureContract._id });
  }

  console.log("\n--- Live auto-resolved MSFT call (sanity bounds only - depends on live market data) ---");
  const live = await getTheoPrice({
    underlyingSymbolMic: "MSFT:XNAS",
    contractType: "call",
    strike: 400,
    daysToExpiration: 90,
  });
  assertTrue("live call: no error", !live.error, live.error);
  assertTrue("live call: theoPrice is a positive finite number", typeof live.theoPrice === "number" && isFinite(live.theoPrice) && live.theoPrice > 0);
  assertTrue("live call: spot price resolved and positive", (live.resolved?.spotPrice ?? 0) > 0);
  assertTrue("live call: volatility resolved and positive", (live.resolved?.volatility ?? 0) > 0);
  assertTrue(
    "live call: theoPrice at least intrinsic value",
    live.theoPrice != null && live.resolved != null && live.theoPrice >= Math.max(0, live.resolved.spotPrice - 400) - 0.05,
  );
  assertTrue(
    "live call: timeToExpiry ≈ 90/365",
    Math.abs((live.resolved?.timeToExpiry ?? 0) - 90 / 365) < 0.002,
  );

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
