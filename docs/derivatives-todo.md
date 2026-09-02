# Derivatives — open work

Living TODO list for the options/futures migration (see `CLAUDE.md`'s "Active work" section and
`portfolio-server/docs/derivatives/` for background/design). Add to this as new gaps surface;
check items off with a note on how/when, don't just delete them.

## 1. Greeks

- **Built 2026-09-02 for the calculator** (`services/derivatives/calcGreeks.ts`): delta, gamma,
  vega, theta, rho (+ `rhoTenBasis`/`rhoOneBasis`), speed, charm, color - all ten, returned by
  `tools.theoPrice` in a `greeks` block alongside `theoPrice`. Plain futures/forwards get none
  (cost of carry, not an option model).
- The port follows the original's structure: JCalc computes almost every greek as a
  finite-difference bump of `CalcTheorPrice` (`greeks.c`'s DeltaValue/GammaValue/ThetaValue/
  VegaValue/RhoValue/SpeedValue/CharmValue/ColorValue take the price function as a pointer), and
  only delta/gamma have fast paths - closed form for Black-Scholes/Black-76, read off the tree
  for the binomial models. ps2 does the same: same epsilons (`F_EPSILON` 1e-2, `EPSILON` 1e-3),
  same difference expressions, closed-form delta/gamma for european, and
  `binomial_delta_gamma()` in the addon (a merged port of `DeltaBinom`/`GammaBinom`, extending
  the tree by 2 steps and fitting a parabola through level 2) for american.
- Verified: `npm run test:greeks` (51 assertions) checks the european greeks against
  independently-coded analytic Black-Scholes, plus model-independent identities (put-call parity
  of delta, gamma/vega equal for call and put) and the American-vs-European relationships.
  Delta/gamma match analytically to 1e-9; vega/theta to bump precision.
- **Deviation to be aware of**: theta advances one *trading* day using a weekend-only rule.
  The original uses `dateAfterGivenWorkingDays(..., currency)`, a per-currency holiday calendar
  that ps2 does not have - so ps2 under-states decay across public holidays. Fixing this needs a
  trading calendar, which is a separate piece of work.
- **Unit fix worth remembering**: `rvega.c` scales vega by `VOL_FACTOR` (0.01) because JCalc's
  sigma is a decimal. ps2 carries volatility in percentage points, so applying VOL_FACTOR again
  made vega 100x too small - caught by the analytic comparison.
- **Still open: greeks on held positions.** This is wired into the calculator only.
  `portfolios.positions`/`processQuoteData` do not yet compute per-position greeks on each tick,
  which was the original plan recorded here (same pass as `theoPrice`, same resolved inputs, with
  portfolio-level aggregates fitting the existing `TOTAL_*` row pattern). Cost note that still
  applies: for binomial contracts charm/color need a second full tree evaluation each, so treat
  the second tier as opt-in or lower-cadence rather than per-tick.

## 2. Expiration-tier handling

- **Cascade is built, `contractExpirations` is empty.** `resolveContractSettings.ts` now resolves
  `multiplier` as `contract override -> expiration -> underlying -> DEFAULT_MULTIPLIER (100)`, but
  no `ContractExpiration` document has ever actually been read from in practice - every existing
  test contract has multiplier baked in directly on the `Contract` document, or (for MSFT options)
  now on `underlyingOptionSettings`. Need a real example that actually exercises the expiration
  tier - a future is the natural case (see item 3), since futures have no reliable Underlying-tier
  record to resolve from at all.
- **Open question, not yet discussed**: what happens in ps2 when a contract actually reaches its
  `expirationDate`? No auto-exercise/settlement/position-closeout logic exists anywhere yet -
  positions.ts will just keep trying to price an expired contract (`calcTheoPrice`'s
  `timeToExpiry <= 0` guard returns `undefined`, so it'll silently stop pricing, not close the
  position). Decide: manual closeout trade only, or does ps2 need real expiry-day handling
  (intrinsic-value settlement, auto-close)?
- Contract-size semantics reminder (from the ES vs Micro-ES discussion): contract size is
  conceptually a per-*product* constant (ES is always $50/pt, MES is always $5/pt, across every
  expiration of that product) - the expiration tier is a **practical workaround** for the missing
  Underlying-tier data source for futures (item 3), not because real contract specs vary by
  expiration month. Once real per-product futures reference data exists, the primary default
  should move to a genuine Underlying-tier record, with Expiration staying available only for the
  genuine outlier (a specific contract-month's spec actually changing).

## 3. Real futures/index reference data + symbology

- `Aktia.Symbols` has zero futures/index coverage - confirmed no ES/SPX/CME entries exist.
  `SPY:ARCX` is currently a stand-in proxy for `ES` in test contracts, not a real futures
  underlying.
- Real live futures price data **is** reachable via `iexproxy` today, but only via raw Yahoo
  tickers (`ES=F`) that bypass ps2's `TICKER:MIC` convention entirely - `iexproxy`'s `mics.js` has
  no futures-specific conversion logic, `ES=F` just falls through every branch unchanged because it
  happens to already be a valid Yahoo ticker.
- **Decision: don't store raw Yahoo tickers (`ES=F`) anywhere in ps2's own fields** (`Contract`,
  `underlyingSymbolMic`). That breaks MIC-based disambiguation (same problem as VOD's bare-ticker
  ambiguity across XLON/XJSE/XNAS/XBUE) and couples a supposedly provider-agnostic identity field
  to one specific provider's namespace.
- **Decision: follow exchange-native contract codes** (`ESU6` - root + month code F-Z + single-digit
  year) as the primary internal convention, not Reuters RIC or Bloomberg format.
- **Explicitly deferred, needs real design before any code**: a multi-provider mapping (Yahoo,
  EODHD, and whatever else) belongs in `iexproxy`'s `mics.js`, mirroring the existing
  `mic2.csv`-driven per-exchange-provider pattern already used for equities, extended to
  per-futures-product. Not a ps2-side task. "Nearest/continuous future" support is explicitly not a
  requirement for now - specific dated contracts only.
- Futures cost-of-carry pricing formula exists and is ready to port (see item 4) but is separate
  from this - pricing and quote-sourcing are two different gaps that happen to both be missing for
  the same reason (no real futures data source).

## 4. Futures cost-of-carry pricing (plain futures/forwards, not options-on-future)

- **Formula built (2026-09-02): `calcFutureTheoPrice()` in `calcTheoPrice.ts`** - a direct
  TypeScript port (per the "doesn't strictly need the native addon" note below - decided: TS, not
  the addon), continuous-dividend-yield version of the old system's formula:
  ```c
  // portfolio-server/PS_calculator/JCalc/maked.c:229
  theorFuturePrice = (theorSpotPrice - PVDiv) * exp((financingRate - yield) * rateTime)
  ```
  i.e. `F = S * e^((r-q)*T)` (continuous yield `q` in place of `PVDiv`, ps2's existing convention -
  see the function's own comment for why). Dispatch logic in `rtheor.c`'s
  `CalcTheorPrice_Future`/`_Forward` was the reference for the old system's version.
- **Reachable today only via the new ad-hoc `tools.theoPrice` command** (`getTheoPrice.ts`) - it
  correctly returns a future's cost-of-carry price when asked. **Still NOT wired into the real
  held-position pricing pass**: `selectTheoModel.ts` still never assigns a `theoModel` to a plain
  future/forward, and `positions.ts`/`buildContractCalcContexts.ts`'s `calcTheoPrice()` (the
  `ContractCalcContext`-based path used for actual positions) doesn't call
  `calcFutureTheoPrice()` at all yet. So a bare future **position** still reverts to the same
  blank-`theoPrice` row the "empty shell" enrichment fix addressed for options - only the
  standalone calculator benefits from this so far. Wiring it into real positions is a small,
  well-scoped follow-up: `buildContractCalcContexts.ts` already resolves every input
  `calcFutureTheoPrice()` needs (spot, riskFreeRate, dividendRate, timeToExpiry) for every
  contract, options and futures alike.
- Verified end-to-end (test: `server/test/getTheoPrice.test.ts`) against an independently-coded
  reference implementation of the same formula, for both `future` and `forward` contract types.
- Blocked on item 3 for real underlying data for anything beyond the `SPY:ARCX` stand-in, same as
  before - the formula/wiring itself is not blocked by that.

## 5. Unported option-pricing models

`SUPPORTED_MODELS` in `calcTheoPrice.ts` covers Black-Scholes, Black-76, Black-76 American,
American/European binomial. Bjerksund-Stensland, Barone-Adesi, Geske, MacMillan remain valid
manual `TheoModel` overrides on a `Contract` document but return `undefined` (not computable) if
assigned - `selectTheoModel.ts` deliberately assigns `americanBinomial` to every American contract
instead, specifically because Bjerksund isn't ported yet. Binomial is slower and can differ
numerically from Bjerksund - worth reassessing once there's a real book to check parity against.

## 6. Data-quality loose ends

- **VOD's `multiplier: 1000`** (UK contract size) is an unverified guess, not a confirmed real
  spec - unlike MSFT's 100 (real OCC standard). Find the real number before trusting any VOD P&L.
- **Test/seed scripts hardcode `rate: 1`** (`add-msft-stock-trade.ts`, `test-derivatives-e2e.ts`,
  `test-option-emulation.ts`) - harmless for USD-in-USD-portfolio trades, but would silently
  reproduce the exact FX-unit-mismatch bug found on VOD if reused for any non-portfolio-currency
  symbol. Should leave `rate` unset so `services/trade.ts`'s real auto-resolve path
  (`getDateSymbolPrice`/`checkPriceCurrency`) runs, matching real trade entry.
- **No discrete dividend-schedule collection** - `theoModel` selection can't branch on dividend
  count the way the old system's `GENERIC_AMERICAN` model did (Geske for 1-3 discrete dividends,
  binomial otherwise); everything spot-based + American defaults to binomial uniformly.
- **`Yieldcurves` is static placeholder data** (11 currencies, seeded once) - not live-updated.
  Real per-currency bid/ask/last should eventually come from `iexproxy`, per earlier discussion.

## 7. Known pending regression (unrelated to derivatives, found along the way)

- `positions.ts` has two `isPenceQuoted(symbol, cur)` call sites reverted to the 1-arg
  `isPenceQuoted(symbol)` form in the working tree, undoing part of the shipped GBX/GBP fix
  (commit `35388e3`) - drops the already-known currency, falls back to a separately-preloaded
  currency map instead. Flagged twice, left untouched both times per explicit choice. Revisit
  before it's forgotten - low risk most of the time, but exactly the kind of thing that'd bite a
  UK todayResult calculation.

## 8. Not yet verified

- Is there an actual trade-entry **UI form** for option/future trades, or does contract creation
  only happen via the `trades.add` `contract` payload today (which works, verified end-to-end, but
  has only ever been exercised by test/seed scripts, never a real form submission)?
