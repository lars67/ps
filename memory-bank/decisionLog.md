# Decision Log

This file records architectural and implementation decisions using a list format.
2025-06-23 12:28:48 - Log of updates made.

*

## Decision

*

## Rationale 

*

## Implementation Details

*
2025-06-23 12:28:57 - Added `portfolios.debug` command to `commands_overview.md`.
## Decision

*   Added new `portfolios.debug` command.

## Rationale 

*   The `portfolios.debug` command was added to assist users in identifying errors within their portfolios. This new command provides row-based output with various metrics, which is crucial for detailed debugging of portfolio calculations. The user specifically requested this functionality to find errors in portfolios.

## Implementation Details

*   The `debug` function fetches all relevant trades for the portfolio, processes them with proper profit/loss calculations, currency conversions, fee handling, and generates comprehensive reports matching NAV report format. Includes day-by-day or trade-by-trade granularity, option to export to CSV.

## Decision

*   Marked the `portfolios.debug` command implementation as completed.

## Rationale

*   The `portfolios.debug` command has been fully implemented, tested, and verified as per user confirmation. All calculation fixes, command dispatch issues, and integration problems have been resolved.

## Implementation Details

*   Updated memory bank files (progress.md, activeContext.md) to reflect completion.
*   Moved portfolio.debug-related tasks to completed status.
*   Shifted current focus to remaining outstanding issues like WebSocket stability and portfolio verification.

## Decision

*   Added `source` field to signup command for tracking user signup origins.

## Rationale

*   The signup command needed to track where users sign up from various places to enable analytics, marketing attribution, and user journey mapping. Different entry points (web form, mobile app, partner referrals, campaigns) could be distinguished.

## Implementation Details

*   Added `source?: string` to `User` interface in `server/src/types/user.ts`.
*   Updated UserSchema in `server/src/models/user.ts` to include source field.
*   Modified `authSignUpThunk` in `react/src/store/slices/user.ts` to send source field via WebSocket.
*   Updated React signup form to include source parameter with default "web-form".
*   Added source field to test HTML page with default "test-page".

## Decision

*   Implemented real-time portfolio positions streaming with enhanced `portfolios.positions` command.

## Rationale

*   Real-time portfolio streaming was needed to provide live market data updates for portfolio positions. The existing snapshot-only approach (`requestType: "0"`) didn't support continuous updates. Users needed to see live price changes and P&L updates without manual refresh.

## Implementation Details

*   Enhanced `portfolios.positions` command to support `requestType: "1"` (subscribe) which returns initial positions data and establishes streaming connection.
*   Added fragmented message handling for both initial responses and streaming updates to handle large payloads.
*   Implemented Latest Price support (`basePrice: "2"`, `marketPrice: "2"`) for real-time market data calculations.
*   Created comprehensive test script (`tests/get_portfolio_positions.js`) with detailed documentation for external programmers.
*   Added robust error handling and graceful unsubscription after monitoring period.
*   Updated server code to return positions data for subscribe requests and handle streaming message reassembly.

## Decision

*   Fixed subscribe mode (`requestType: "1"`) to return comprehensive initial data like snapshot mode (`requestType: "0"`).

## Rationale

*   Subscribe mode was returning incomplete position data compared to snapshot mode, lacking market values, results, fees, and other calculated fields. This inconsistency was problematic for users expecting the same level of detail in the initial response regardless of request type. The subscribe mode should provide the same comprehensive data initially, then optimize streaming updates for performance.

## Implementation Details

*   Modified `server/src/services/portfolio/positions.ts` to ensure subscribe mode processes quote data for initial positions enrichment.
*   Added logic to `processQuoteData` function to enrich positions with market data even when no actual quote data is available (using default values for market prices).
*   Ensured subscribe mode initial response includes all calculated fields: marketValue, marketValueSymbol, result, resultSymbol, fees, avgPremium, weights, etc.
*   Streaming updates continue to use minimal totals for bandwidth optimization, but initial subscription provides full comprehensive data.
2025-06-23 14:15:27 - Redesigned `portfolios.debug` output metrics to match user-provided NAV report.
2025-11-20 08:52:07 - Logged completion of `portfolios.debug` command implementation and updated memory bank accordingly.
2025-11-20 08:58:48 - Logged decision to add source field to signup command and completed implementation across frontend, backend, database, and test files.
## Decision

*   Redesigned the output metrics format for the `portfolios.debug` command.

## Rationale 

*   The output structure of `portfolios.debug` was updated to directly match the column headers and format of a user-provided NAV report. This addresses explicit user feedback to make the debug report output easily comparable and directly usable for identifying errors, particularly with "crazy prices or FX" by providing all necessary metrics in a familiar layout. This will significantly improve the utility of the command for debugging purposes.

## Implementation Details

*   The `Output Metrics` section for `portfolios.debug` in `commands_overview.md` was updated to include all specific columns from the user's NAV report: `Date`, `Type`, `Symbol`, `Volume`, `Original price`, `MarketPrice`, `Original FX`, `MarketFX`, `Fee`, `Invested`, `InvestedBase`, `MarketValue`, `BaseMarketValue`, `Realized`, `Result`, `resultBase`, `Unrealized Result`, `Cash`, `CashBase`, `Acc. Result`, `AccMarketVvalue`, `AccMarketValueBase`, `AccCash`, `AccCashBase`, `NAV`, and `NavBase`.
2025-06-23 15:11:08 - Implemented backend logic for `portfolios.debug` command.
## Decision

*   Implemented the backend functionality for the `portfolios.debug` command.

## Rationale 

*   The `portfolios.debug` command's backend logic was implemented to provide the requested debugging features, allowing users to obtain detailed portfolio reports. This fulfills the user's requirement for a tool to identify discrepancies and errors in portfolio calculations, providing output structured precisely like their NAV report.

## Implementation Details

*   Created `server/src/services/portfolio/debug.ts` to house the `debug` function's logic.
*   Exported the `debug` function from `server/src/services/portfolio.ts`.
*   Added the `portfolios.debug` command's description to the `description` export in `server/src/services/portfolio.ts` to ensure it is recognized and discoverable by the system.
*   Implemented comprehensive calculation logic including trade processing, profit/loss calculations with currency conversions, fee handling, unrealized P&L tracking, and NAV computation. Supports day-by-day or trade-by-trade granularity with optional CSV export.

2026-07-06 - Started derivatives support, ported incrementally from the legacy `portfolio-server` C++ system.
## Decision

*   Introduce derivatives (options/futures) support in ps2 via a single new `contracts` Mongoose
    collection, referencing the existing `Aktia.Symbols` collection as the underlying rather than
    creating a new `underlyings` collection. Contract-pricing model (`theoModel`) and dividend yield
    (`dividendRate`) are auto-derived at contract-creation time rather than manually configured per
    instrument (as the old system did). The pricing engine itself will be a native Node addon wrapping
    the old system's `JCalc` C library (SoftCapital's own code, full rights confirmed) rather than a
    from-scratch TypeScript reimplementation — not yet built.

## Rationale

*   ps2 had no derivatives concept at all before this (`models/trade.ts` just holds a bare `symbol`
    string). The legacy `portfolio-server` project has a mature, production-tested derivatives data
    model and pricing engine (`PS_calculator`/`JCalc`, ~12 option-pricing models: Black-Scholes,
    Black-76, Whaley/MacMillan, Bjerksund-Stensland, Barone-Adesi, Geske, binomial/trinomial, binary)
    that is being ported incrementally rather than rewritten from scratch.
*   `Aktia.Symbols` already exists as a live equity/ETF reference master (separate Mongo database,
    same server, `Symbol-Mic` natural key) and is the closest existing analog to the old system's
    `underlyings` table — reusing it avoids duplicating underlying metadata into a new collection and
    avoids the question of who maintains a second copy of it.
*   Options will initially be entered as OTC trades, with the contract created directly from the
    trade-entry form rather than pre-populated from a feed — this is why contract identity uniqueness
    (enforced via indexes) and upsert-by-identity matter: re-entering a trade for the same logical
    contract must resolve to the same document.
*   Reusing the existing `JCalc` C code (rather than reimplementing the models in TypeScript) avoids
    silently diverging from decades of production-validated pricing behavior — these are numerically
    delicate approximations (quadratic/iterative methods) that are easy to get subtly wrong in a
    clean-room rewrite.

## Implementation Details

*   `server/src/types/contract.ts` — `Contract` type, `ContractType` enum (no `spot` - plain equity
    positions keep referencing a symbol directly, matching `trade.ts`), `TheoModel` enum (9-model
    JCalc catalogue), and free-function helpers ported from the old C++ `Contract` class's methods.
*   `server/src/models/contract.ts` — Mongoose schema/model (`contracts` collection), following the
    `models/portfolio.ts` deferred-index-creation pattern. Two partial unique indexes enforce contract
    identity: one for option types (`underlyingSymbolMic + contractType + strike + expirationDate`),
    one for futures/forwards (same minus `strike`).
*   `server/src/services/derivatives/resolveDividendYield.ts` — reads continuous dividend yield from
    an `Aktia.Symbols` document; **the field name differs by `Type`** (`"Dividend yield % (indicated)"`
    for `Common Stock`, `"Annual Dividend Yield %"` for `ETF` - confirmed by inspecting real MSFT/SPY
    documents; other types default to 0 until observed).
*   `server/src/services/derivatives/selectTheoModel.ts` — pure function of contract shape (European
    vs American x spot- vs future-based) -> `blackScholes`/`bjerksund`/`black76`/`black76American`.
    Does not yet reproduce the old system's discrete-dividend-count branching (Geske/binomial) - no
    discrete dividend-schedule collection exists in ps2 yet to support that; those remain valid manual
    `TheoModel` overrides.
*   `server/src/seed-test-contracts.ts` — one-off script, 4 real test contracts verified live in
    MongoDB: MSFT call ($400)/put ($380) on real `MSFT:XNAS`; ES future + option-on-future standing in
    on `SPY:ARCX` (no real futures/index data exists in `Aktia.Symbols` - open question, not resolved).
*   Full design rationale and open questions tracked in `portfolio-server/docs/derivatives/` (sibling
    repo) - `01-data-model.md`, `02-pricing-engine.md`, `03-migration-notes.md` (start here for
    current status). Not yet done: wiring contract creation into the actual trade-entry
    controller/form, and building the JCalc native addon itself.
