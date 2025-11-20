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
