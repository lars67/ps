# Progress

This file tracks the project's progress using a task list format.
2025-06-23 12:28:43 - Log of updates made.

*

## Completed Tasks

*   ✅ **DERIVATIVES DATA MODEL (2026-07-06)**: New `Contract` type/model (`server/src/types/contract.ts`,
    `server/src/models/contract.ts`) - new `contracts` collection, referencing the existing
    `Aktia.Symbols` collection as the underlying (no new `underlyings` collection). Partial unique
    indexes enforce contract identity; upsert-by-identity verified. Automatic `dividendRate`/`theoModel`
    resolution (`server/src/services/derivatives/`) from the underlying's `Aktia.Symbols` document. 4
    real test contracts seeded and verified live in MongoDB. See `decisionLog.md` and
    `portfolio-server/docs/derivatives/03-migration-notes.md` (sibling repo) for full detail.
*   ✅ **CRITICAL FIX**: Modified PS2 to prioritize local high-precision CSV data from CustomYahooDownload.py over EODHD API. Fixed filename format bug (DANSKE_XCSE.csv → DANSKE:XCSE.csv) ensuring PS2 reads Yahoo Finance data with full precision instead of rounded EODHD values.
*   ✅ **COMPLETED**: Real-time portfolio positions streaming test script with comprehensive documentation
*   ✅ **IMPLEMENTED**: Enhanced `portfolios.positions` command with `requestType: "1"` (subscribe) returning initial positions data and establishing streaming connections
*   ✅ **IMPLEMENTED**: Fragmented message handling for both initial responses and streaming updates
*   ✅ **IMPLEMENTED**: Latest Price support (`basePrice: "2"`, `marketPrice: "2"`) for real-time market data
*   ✅ **FIXED**: Subscribe mode (`requestType: "1"`) now returns comprehensive initial data like snapshot mode (`requestType: "0"`)
*   Implement and refine the `portfolios.debug` command for comprehensive portfolio error detection and reporting, including backend logic, calculation fixes, and command dispatch resolution.
*   Add `source` field to signup command to track user signup origins (e.g., web-form, mobile-app, partner-referral).
*   ✅ **COMPLETED**: Full flow test script with HTML report generation.

## Current Tasks

*   Derivatives migration from `portfolio-server` (see Current Focus in `activeContext.md`) - data
    model and model-selection logic done, pricing engine and trade-form wiring not started.

## Next Steps

*   **Derivatives**: wire contract creation into the actual trade-entry form/controller (OTC option
    trades should upsert a `Contract` document by identity, not just via the one-off seed script).
*   **Derivatives**: prototype the JCalc native addon against a single model (e.g. Black-Scholes) to
    de-risk native compilation before porting all ~12 models - see
    `portfolio-server/docs/derivatives/02-pricing-engine.md`.
*   **Derivatives**: resolve the futures/index underlying reference gap - `Aktia.Symbols` has no real
    futures/index data; `SPY:ARCX` is currently a stand-in for ES-style test contracts.
*   **Derivatives**: design a discrete dividend-schedule collection so `theoModel` selection can branch
    the way the old system's `GENERIC_AMERICAN` model did (Geske for 1-3 dividends, binomial for more)
    instead of defaulting every spot-based American option to `bjerksund`.
*   Investigate and resolve WebSocket connection stability issues.
*   Address potential SSE (Server-Sent Events) connection instability issues.
*   Verify portfolio calculation accuracy against external NAV reports.
*   Consider adding more granular access controls for sensitive portfolio data.
*   Update PS2 documentation to reflect the new `source` field in signup command.
*   Fixed `tools.statistics` for portfolios to calculate returns based on invested value changes only (excludes cash flows).
*   Added `startDate` field to statistics response for frontend CAGR display control.

2025-06-23 12:32:17 - Updated `commands_overview.md` with `portfolios.debug` documentation; Consolidated Memory Bank files (`productContext.md`, `systemPatterns.md`, `activeContext.md`).
2025-06-23 14:15:59 - Redesigned `portfolios.debug` output metrics in `commands_overview.md` to match user-provided NAV report.
2025-06-23 15:04:26 - `portfolios.debug` command design and documentation complete; backend implementation required.
2025-06-23 15:11:22 - Backend implementation of `portfolios.debug` command.
2025-06-23 15:14:39 - Debugging command dispatch issue for `portfolios.debug` in `server/src/controllers/websocket.ts`.
2025-06-23 15:18:58 - Instructed user to use `npm run dev` in `server` directory to ensure TypeScript changes are compiled and applied.
2025-06-23 15:33:49 - Resolved `_id` access error in `portfolios.debug.ts`.
2025-06-23 15:35:16 - Implemented core calculation logic for `portfolios.debug` command.
2025-06-23 15:49:06 - Applied fixes to `portfolios.debug` calculation logic (fees, dividends). Awaiting simpler test portfolio from user for verification.
2025-11-20 08:51:48 - `portfolios.debug` command implementation completed and verified as per user confirmation; memory bank updated to reflect completion.
2025-11-20 08:58:31 - Added `source` field to signup command for tracking user signup origins across different entry points; updated frontend form, backend types, and database schema.
2026-07-06 - Derivatives migration started: Contract data model, automatic theoModel/dividendRate resolution, 4 seeded test contracts. See decisionLog.md.
