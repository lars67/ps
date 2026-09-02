# Active Context

This file tracks the project's current status, including recent changes, current goals, and open questions.
2025-06-23 12:28:39 - Log of updates made.

*

## Current Focus

*   🆕 **IN PROGRESS**: Derivatives support — incrementally porting functionality from the legacy
    C++ `portfolio-server` project (sibling repo at `/home/lars/projects/portfolio-server`) into
    ps2. Derivatives (options/futures data model + theoretical pricing) is the first slice.
    Design docs live in `portfolio-server/docs/` — start with `docs/00-system-map.md` for the old
    system's module map, then `docs/derivatives/01-data-model.md` (old SQL schema),
    `02-pricing-engine.md` (the `JCalc` pricing library and its ~12 models), and
    `03-migration-notes.md` (the actual ps2 design + implementation status + open questions — this
    is the one to read first when picking derivatives work back up).
*   ✅ **COMPLETED**: Real-time portfolio positions streaming test script implementation
*   ✅ **IMPLEMENTED**: Enhanced `portfolios.positions` command with `requestType: "1"` (subscribe) returning initial positions data
*   ✅ **IMPLEMENTED**: Fragmented message handling for both initial responses and streaming updates
*   ✅ **IMPLEMENTED**: Latest Price (`basePrice: "2"`, `marketPrice: "2"`) support for real-time data
*   ✅ **FIXED**: Subscribe mode (`requestType: "1"`) now returns comprehensive initial data like snapshot mode (`requestType: "0"`)
*   ✅ **COMPLETED**: Full flow test script (`server/src/test-full-flow.ts`) with HTML report generation.
*   Investigating and resolving WebSocket connection stability issues.
*   Addressing potential SSE (Server-Sent Events) connection instability issues.
*   Verifying portfolio calculation accuracy against external NAV reports.

## Recent Changes

*   **DERIVATIVES DATA MODEL (2026-07-06)**: Added a new `Contract` model — `server/src/types/contract.ts`
    (`Contract` type, `ContractType` enum: `future`/`forward`/`call`/`put`/`callEuropean`/`putEuropean`,
    `TheoModel` enum, helper functions) and `server/src/models/contract.ts` (Mongoose schema, new
    `contracts` collection, two partial unique indexes enforcing contract identity). Design decision:
    the existing `Aktia.Symbols` collection (separate Mongo database, same server, raw-driver access
    — see `services/app/companies.ts`) plays the role of "underlying" by `Symbol-Mic`; there is no new
    `underlyings` collection. Contracts will initially be created from the trade-entry form (OTC
    option trades), upserted by identity — not batch-imported.
*   **AUTOMATIC PRICING-MODEL SELECTION**: `server/src/services/derivatives/selectTheoModel.ts` picks
    a `TheoModel` (`blackScholes`/`bjerksund`/`black76`/`black76American`) automatically from contract
    shape (European vs American, spot- vs future-based via `baseContractId`). `resolveDividendYield.ts`
    reads a continuous dividend yield from the underlying's `Aktia.Symbols` document — **note this
    field name differs by `Type`**: `"Dividend yield % (indicated)"` for `Common Stock`, `"Annual
    Dividend Yield %"` for `ETF`, others unhandled/default 0 until observed. 4 real test contracts are
    seeded and live in the `ps2` database (`server/src/seed-test-contracts.ts`): MSFT call/put on the
    real `MSFT:XNAS` underlying, plus an ES future + option-on-future standing in on `SPY:ARCX` (the
    SPDR S&P 500 ETF) because `Aktia.Symbols` has **no real futures/index reference data at all** —
    open question, not yet resolved.
*   **JCalc reuse decision**: the pricing engine itself (native Node addon wrapping
    `portfolio-server/PS_calculator/JCalc`, a C library SoftCapital owns outright) has NOT been built
    yet — only the data model and model-selection logic exist so far. This is the next big piece.
*   **COMPLETED PORTFOLIO STREAMING**: Implemented comprehensive real-time portfolio positions streaming test script with detailed documentation for external programmers. Enhanced `portfolios.positions` command with `requestType: "1"` (subscribe) to return initial positions data and establish streaming connections. Added robust fragmented message handling for both initial responses and streaming updates. Implemented Latest Price support (`basePrice: "2"`, `marketPrice: "2"`) for real-time market data calculations.
*   **OPTIMIZED STREAMING PERFORMANCE**: Modified portfolio positions streaming to send only grand total in updates (not all subtotal breakdowns) and no attribution data to reduce bandwidth usage. Initial subscription still sends full totals and attribution for complete data.
*   **FIXED CRITICAL CRASH**: Resolved TypeError in `processQuoteData` where accessing `portfolioPositions[symbol].currency` for symbols no longer in portfolio caused server crashes. Added guard clause to skip processing quote data for symbols not in current portfolio positions (race condition fix for SSE quote processing).
*   Fixed critical bug in `fetchHistory` where FX rates keyed by symbol name (e.g., `USDDKK:FX`) were being ignored.
*   Updated `getRate` to throw an error instead of falling back to `1.0` when exchange rates are missing.
*   Completed implementation of `portfolios.debug` command for comprehensive portfolio error detection and reporting.
*   Resolved backend logic issues including calculation logic, fees, dividends, and command dispatch.
*   Verified command execution with fixes for `_id` access and integration in WebSocket command system.
*   Added `source` field to signup command to track user signup origins across different entry points.
*   Updated frontend forms (React and test HTML), backend types, database schema, and WebSocket handling.

## Open Questions/Issues

*   **Derivatives**: no real futures/index underlying reference data exists anywhere in ps2
    (`Aktia.Symbols` is equities/ETFs/funds/bonds only) — `SPY:ARCX` is a stand-in for testing only.
    Does this need a new reference source, or is ETF-as-proxy acceptable long-term?
*   **Derivatives**: `theoModel` auto-selection doesn't yet branch on discrete dividend count the way
    the old system did (Geske for 1-3 dividends, binomial otherwise) — there's no discrete
    dividend-schedule collection in ps2 yet to support that. Currently everything spot-based +
    American gets `bjerksund` uniformly.
*   **Derivatives**: JCalc native addon not started — biggest remaining piece of the pricing engine
    port. See `portfolio-server/docs/derivatives/02-pricing-engine.md` for the full model catalogue
    and `03-migration-notes.md` for the native-addon-vs-reimplementation tradeoff (native addon is
    the recommended approach, to preserve numerical parity with 20+ years of production pricing).
*   How to handle long-running portfolio calculations that might cause WebSocket timeouts?
*   Need to verify the accuracy of portfolio calculations against external NAV reports.
*   Investigate and resolve potential SSE connection instability issues mentioned in debugging notes.
*   Consider adding more granular access controls for sensitive portfolio data.
2025-06-23 12:32:12 - Consolidated Memory Bank with `projectbrief.md` and `techContext.md` information; added `portfolios.debug` command.
2025-06-23 14:15:52 - Redesigned `portfolios.debug` command's output to match NAV report.
2025-06-23 15:04:16 - `portfolios.debug` command documented and designed, but backend implementation is pending.
2025-06-23 15:11:15 - Backend implementation of `portfolios.debug` command completed.
2025-06-23 15:14:30 - Added debug logs to `server/src/controllers/websocket.ts` to diagnose "Handler group not found" error during command dispatch.
2025-06-23 15:18:44 - Identified server build/run process issue (`npm start` does not recompile). Instructed user to use `npm run dev` for server to pick up latest TypeScript changes and debug logs.
2025-06-23 15:33:43 - Fixed `_id` access error in `portfolios.debug` using `realId`.
2025-06-23 15:35:08 - Implemented comprehensive calculation logic in `portfolios.debug.ts` for real data generation.
2025-06-23 15:48:41 - Applied fixes to `portfolios.debug.ts` regarding `trade.fee` and dividend calculations, leveraging `portfolios.history.ts` logic. Awaiting simplified portfolio for targeted debugging.
2026-07-06 - Started derivatives migration from portfolio-server. Added Contract type/model, automatic dividendRate/theoModel resolution, and 4 seeded test contracts. See decisionLog.md and portfolio-server/docs/derivatives/03-migration-notes.md for full detail.
