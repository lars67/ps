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
