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

*   Documented the command in `commands_overview.md` including `portfolioId`, `fee`, and `granularity` parameters, along with a comprehensive list of output metrics (Date, Symbol, Volume, Price, Fx, Fee, Invested, Market Price, Unrealized Result, Realized Result, Result, Market Value, Cash).
2025-06-23 14:15:27 - Redesigned `portfolios.debug` output metrics to match user-provided NAV report.
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
*   The `debug` function currently returns mock data to demonstrate the output structure, with a placeholder for the full calculation logic (fetching trades, historical prices, etc.).