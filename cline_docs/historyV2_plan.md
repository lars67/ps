# Plan: Create `portfolios.historyV2` Command

**Date:** 2025-03-31

**Objective:** Address inconsistencies and inaccuracies in the original `portfolios.history` command, particularly regarding weekend data handling, which caused visual drops in the NAV graph. Create a new, robust command (`portfolios.historyV2`) leaving the original untouched.

**1. Goal:**
Implement a new server command, `portfolios.historyV2`, that reliably calculates daily portfolio snapshots (NAV, invested value, cash, etc.). This command must ensure data continuity for graph visualization by correctly handling weekends and potential missing price data by carrying forward the last known valid market values.

**2. Redesigned Calculation Logic (`portfolios.historyV2`):**
The core of the new logic will be a strict day-by-day iteration through the requested date range (`startDate` to `endDate`).

```mermaid
graph TD
    A[Start portfolios.historyV2 Request] --> B{Get Portfolio & Trades};
    B --> C{Determine Date Range (Start/End)};
    C --> D{Initialize State (Holdings, Cash, Shares, NAV, etc.) based on state *before* StartDate};
    D --> E{Loop Day-by-Day from StartDate to EndDate};
    E -- For Each Day --> F{Process Trades for *Current Day*};
    F --> G{Update Holdings/Cash/Shares based on trades};
    G --> H{Calculate Market Value ('inv') of current holdings using Today's Prices/Rates (or fallback to last valid)};
    H --> I{Calculate NAV = inv + cash};
    I --> J{Store Daily Snapshot (Date, inv, cash, nav, shares...)};
    J --> L{Update 'Previous Day State' for next iteration};
    L --> E;
    E -- Loop End --> K{Return Array of Daily Snapshots};
```

**Detailed Steps for Each Day in Loop:**
    *   **Get Previous State:** Load the portfolio state (holdings volume, cash balance, total shares, last NAV) as it was at the *end* of the *previous* day. For the very first day (StartDate), this state needs to be initialized (potentially 0 or based on trades before StartDate if applicable).
    *   **Process Today's Trades:** Find all trades (BUY, SELL, PUT, DIVIDEND, etc.) that occurred *on the current day*. Iterate through them:
        *   Update the volume of the specific holding (`oldPortfolio` structure).
        *   Update the running `cash` balance based on trade price, volume, rate, and fees.
        *   Update the total `shares` based on PUT operations.
        *   Keep track of trade details if requested (`detail=1`).
    *   **Calculate End-of-Day Market Value (`inv`):** Iterate through all symbols currently held in `oldPortfolio`:
        *   Get the closing price for the `currentDay` using `getDateSymbolPrice` (which falls back to the last valid non-zero price).
        *   Get the exchange rate for the `currentDay` using `getRate` (which falls back to the last valid rate or 1).
        *   If price or rate is unavailable even with fallback, log a warning but potentially use the last known value or handle as 0, ensuring the process doesn't crash.
        *   Calculate the value of the holding (`price * rate * volume`) and add it to `inv`.
    *   **Calculate End-of-Day NAV:** `nav = inv + cash`.
    *   **Store Daily Snapshot:** Create the `DayType` object for `currentDay` using the calculated `inv` (for both `invested` and `investedWithoutTrades` for simplicity, or adjust if needed), the final `cash` balance for the day, the calculated `nav`, the current `shares`, etc. Add this object to the results array (`days`).
    *   **Prepare for Next Day:** The state variables (`cash`, `nav`, `shares`, `oldPortfolio`) now represent the end-of-day state and will be used as the starting point for the *next* day's iteration.

**3. Proposed Implementation Structure (File Changes):**
    *   **New File:** `server/src/services/portfolio/historyV2.ts` - Will contain the new `historyV2` function implementing the logic above.
    *   **Modify `server/src/services/portfolio.ts`:**
        *   Import `historyV2` from `./portfolio/historyV2`.
        *   Export `historyV2`.
        *   Add a command description object for `portfolios.historyV2` to the `description` export, similar to the existing `history` entry but pointing to the new command name.
    *   **Modify `server/src/controllers/websocket.ts` (or relevant command router):**
        *   Add a `case 'portfolios.historyV2':` to the command handling switch statement.
        *   Call the imported `portfolioService.historyV2` function, passing the necessary arguments (`payload`, `sendResponse`, `msgId`, `userModif`, `userData`).

**4. Key Improvements:**
    *   **Unified Logic:** Handles all days (trade days, non-trade days, weekends, holidays) within a single loop structure.
    *   **State Carry-Forward:** Explicitly uses the previous day's final state as the starting point for the current day.
    *   **Robust Data Fetching:** Leverages the improved `getDateSymbolPrice` and `getRate` which look back for valid data.
    *   **Clearer Calculation:** NAV is simply `inv + cash` for the day. `invested` directly reflects `inv`.
    *   **Error Resilience:** The main loop can incorporate `try...catch` around the daily calculation. If an error occurs (e.g., unexpected data issue), the `catch` block can carry forward the previous day's snapshot instead of skipping the day, preventing gaps.
    *   **Isolation:** Does not modify the existing, potentially flawed `portfolios.history` command.