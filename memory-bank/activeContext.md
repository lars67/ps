# Active Context

This file tracks the project's current status, including recent changes, current goals, and open questions.
2025-06-23 12:28:39 - Log of updates made.

*

## Current Focus

*   Investigating and resolving WebSocket connection stability issues.
*   Addressing potential SSE (Server-Sent Events) connection instability issues.
*   Verifying portfolio calculation accuracy against external NAV reports.
*   Corrected FX rate fetching bug where symbol-keyed prices were missed in `fetchHistory`.
*   Hardened currency conversion by removing unsafe 1.0 parity fallbacks in `getRate`.
*   Considering more granular access controls for sensitive portfolio data.
*   Updating PS2 documentation to reflect new signup `source` field.

## Recent Changes

*   Fixed critical bug in `fetchHistory` where FX rates keyed by symbol name (e.g., `USDDKK:FX`) were being ignored.
*   Updated `getRate` to throw an error instead of falling back to `1.0` when exchange rates are missing.
*   Completed implementation of `portfolios.debug` command for comprehensive portfolio error detection and reporting.
*   Resolved backend logic issues including calculation logic, fees, dividends, and command dispatch.
*   Verified command execution with fixes for `_id` access and integration in WebSocket command system.
*   Added `source` field to signup command to track user signup origins across different entry points.
*   Updated frontend forms (React and test HTML), backend types, database schema, and WebSocket handling.

## Open Questions/Issues

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
