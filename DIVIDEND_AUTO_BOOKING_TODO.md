# Automatic Dividend Booking Implementation TODO

**Status**: MVP Complete - Automatic Dividend Booking System Ready
**Created**: 2025-11-09
**Goal**: Implement automatic daily dividend fetching and booking for portfolios

---

## ✅ COMPLETED TASKS

- [x] Analyzed existing dividend functionality
- [x] Identified `getDividends()` function in `server/src/utils/fetchData.ts`
- [x] Confirmed manual booking system via `portfolios.putDividends`
- [x] Created this TODO document

---

## 📋 IMPLEMENTATION TASKS

### Phase 1: Database Schema Updates

- [x] **1.1** Add `bookDividends` field to Portfolio model
  - File: `server/src/models/portfolio.ts`
  - Type: `Boolean`
  - Default: `true`
  - Description: Enable/disable automatic dividend booking

- [x] **1.2** Add `lastDividendCheck` field to Portfolio model
  - Type: `Date`
  - Optional: `true`
  - Description: Track last dividend check timestamp

- [x] **1.3** Create database migration script (if needed)
  - Set `bookDividends: true` for all existing portfolios
  - Initialize `lastDividendCheck` to null
  - File: `server/src/migrations/add-dividend-fields.ts`
  - ✅ **EXECUTED**: Updated 222 existing portfolios

### Phase 2: Dividend Fetching Service

- [x] **2.1** Create dividend checker service
  - File: `server/src/services/dividends/checker.ts`
  - Function: `checkPortfolioDividends(portfolioId)`
  - Logic:
    - Get all active positions for portfolio
    - For each symbol, call `getDividends(symbol)`
    - Parse dividend data
    - Filter for new dividends since `lastDividendCheck`
    - Return list of dividends to book

- [x] **2.2** Create dividend booking service
  - File: `server/src/services/dividends/autoBooker.ts`
  - Function: `autobookDividends(portfolioId, dividends[])`
  - Logic:
    - For each dividend, call `putDividends()`
    - Handle errors gracefully
    - Log all bookings
    - Update `lastDividendCheck` timestamp

- [ ] **2.3** Add dividend validation
  - Check if dividend already booked (avoid duplicates)
  - Validate symbol still exists in portfolio
  - Verify dividend date is valid

### Phase 3: Cron Job Implementation

- [x] **3.1** Install cron library
  - Add `node-cron` to `package.json`
  - Run: `npm install node-cron @types/node-cron`

- [x] **3.2** Create cron job manager
  - File: `server/src/jobs/dividendCronJob.ts`
  - Schedule: Daily at 9:00 AM (configurable)
  - Logic:
    - Get all portfolios where `bookDividends === true`
    - For each portfolio, run dividend checker
    - Autobook found dividends
    - Send notifications (optional)

- [x] **3.3** Integrate cron into server startup
  - File: `server/src/index.ts` or `server/src/app.ts`
  - Start cron job when server starts
  - Add graceful shutdown handling

### Phase 4: API Endpoints

- [ ] **4.1** Update portfolio add/update endpoints
  - Support `bookDividends` field in request
  - Validate boolean value
  - File: `server/src/services/portfolio.ts`

- [ ] **4.2** Add manual dividend check endpoint (optional)
  - Command: `portfolios.checkDividends`
  - Allows user to trigger check manually
  - Returns list of dividends found

- [ ] **4.3** Add dividend history endpoint (optional)
  - Command: `portfolios.dividendHistory`
  - Returns all booked dividends for portfolio
  - Filter by date range

### Phase 5: Logging & Monitoring

- [ ] **5.1** Add dividend check logging
  - Log each portfolio check
  - Log dividends found
  - Log booking successes/failures
  - File: Use existing `server/src/utils/logger.ts`

- [ ] **5.2** Add dividend booking log files
  - **Location**: `server/logs/dividend-bookings/`
  - **Format**: Daily log files (e.g., `2025-11-09-dividend-bookings.log`)
  - **Content**: For each portfolio, list booked dividends with details
  - **Structure**:
    ```
    2025-11-09 09:00:01 - Starting dividend check for 5 portfolios
    2025-11-09 09:00:02 - Portfolio "MyPortfolio" (ID: abc123): 2 dividends booked
      - AAPL: $2.50 (2025-11-08)
      - MSFT: $1.25 (2025-11-08)
    2025-11-09 09:00:03 - Portfolio "GrowthFund" (ID: def456): No new dividends
    2025-11-09 09:00:05 - Completed dividend check. Total: 2 dividends booked across 1 portfolio
    ```

- [ ] **5.3** Add error handling
  - Graceful failure if API unavailable
  - Continue checking other portfolios if one fails
  - Send alerts for repeated failures

- [ ] **5.4** Add metrics tracking (optional)
  - Count dividends checked daily
  - Count dividends booked
  - Track API call success rate

### Phase 6: Configuration

- [ ] **6.1** Add configuration options
  - File: `server/.env` or config file
  - Variables:
    - `DIVIDEND_CRON_SCHEDULE` (default: "0 9 * * *")
    - `DIVIDEND_CRON_ENABLED` (default: true)
    - `DIVIDEND_CHECK_LOOKBACK_DAYS` (default: 7)
    - `DIVIDEND_AUTO_BOOK_ENABLED` (default: true)

- [ ] **6.2** Add admin controls (optional)
  - Command to start/stop cron job
  - Command to trigger immediate check
  - View cron job status

### Phase 7: Testing

- [ ] **7.1** Unit tests
  - Test `checkPortfolioDividends()`
  - Test `autobookDividends()`
  - Test duplicate detection
  - File: `server/src/tests/dividends.test.ts`

- [ ] **7.2** Integration tests
  - Test full workflow: check → book → verify
  - Test with multiple portfolios
  - Test error scenarios
  - File: `server/src/tests/integration/dividends.integration.test.ts`

- [ ] **7.3** Manual testing
  - Create test portfolio with `bookDividends: true`
  - Add test positions
  - Trigger manual check
  - Verify dividends booked correctly
  - Check logs

### Phase 8: Documentation

- [ ] **8.1** Update API documentation
  - Document `bookDividends` field
  - Document new commands (if added)
  - File: `commands_overview.md`

- [ ] **8.2** Add README for dividend feature
  - File: `server/src/services/dividends/README.md`
  - Explain how automatic booking works
  - Configuration options
  - Troubleshooting guide

- [ ] **8.3** Update memory bank
  - File: `memory-bank/productContext.md`
  - Add automatic dividend booking feature
  - Update system patterns

### Phase 9: UI Updates (Optional)

- [ ] **9.1** Add portfolio setting in UI
  - Toggle for `bookDividends` field
  - Location: Portfolio settings/edit form

- [ ] **9.2** Add dividend booking status indicator
  - Show last check timestamp
  - Show recent auto-booked dividends
  - Show any errors

- [ ] **9.3** Add dividend history view
  - Separate tab or section
  - List all dividends (manual + auto)
  - Filter and search capabilities

---

## 🎯 PRIORITY ORDER

1. **HIGH PRIORITY** (MVP):
   - Phase 1: Database Schema (1.1)
   - Phase 2: Core Services (2.1, 2.2)
   - Phase 3: Cron Job (3.1, 3.2, 3.3)
   - Phase 7: Basic Testing (7.3)

2. **MEDIUM PRIORITY**:
   - Phase 1: Tracking (1.2)
   - Phase 2: Validation (2.3)
   - Phase 4: API endpoints (4.1)
   - Phase 5: Logging (5.1, 5.2)
   - Phase 6: Configuration (6.1)

3. **LOW PRIORITY** (Nice to have):
   - Phase 4: Additional endpoints (4.2, 4.3)
   - Phase 5: Metrics (5.3)
   - Phase 6: Admin controls (6.2)
   - Phase 7: Automated tests (7.1, 7.2)
   - Phase 8: Documentation
   - Phase 9: UI Updates

---

## 🔍 TECHNICAL DECISIONS

### Dividend Data Source
- **Current**: External API via `getDividends(symbol)`
- **Endpoint**: `${DATA_PROXY}/dividends?symbol=XYZ&range=max`
- **Format**: To be confirmed (need to test API response)

### Duplicate Prevention Strategy
- Check if dividend already exists in trades collection
- Match by: `portfolioId`, `symbol`, `tradeType: "20"`, `tradeTime` (date)
- Consider tolerance window (±1 day for date matching)

### Error Handling Strategy
- Continue processing other portfolios if one fails
- Log all errors with context
- Retry failed checks in next cron run
- Alert admin after N consecutive failures

### Performance Considerations
- Process portfolios in batches if count is high
- Add timeout for API calls
- Cache dividend data for short period
- Consider async/parallel processing

---

## 📝 NOTES

- Existing `getDividends()` function needs testing to verify response format
- Consider timezone handling for dividend dates
- May need to handle different dividend types (regular, special, etc.)
- Consider adding user notifications for auto-booked dividends
- Ensure transaction integrity (if auto-booking fails, rollback cleanly)

---

## 🐛 POTENTIAL ISSUES TO WATCH

1. **Duplicate Bookings**: Multiple cron runs could book same dividend
2. **API Rate Limits**: External API may have rate limits
3. **Date Synchronization**: Dividend dates vs portfolio timezone
4. **Volume Calculation**: Use volume at ex-dividend date vs payment date
5. **Currency Conversion**: Ensure correct FX rate for dividend date

---

## 📞 QUESTIONS TO RESOLVE

- [ ] What format does `getDividends()` API return?
- [ ] Should we send notifications to users when dividends auto-booked?
- [ ] What happens if portfolio is deleted during cron run?
- [ ] Should we allow manual override of auto-booked dividends?
- [ ] Do we need audit trail for auto-bookings?

---

**Last Updated**: 2025-11-09  
**Next Review**: After Phase 1 completion
