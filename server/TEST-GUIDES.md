# PS2 Server Test Guides

## Portfolio Positions Tests

### test-positions-quick.js
Fast test to verify portfolio positions include marketPrice field.

**Usage:**
```bash
node test-positions-quick.js
```

**What it does:**
- Authenticates with admin / Test4545,
- Requests positions for portfolio 69dbf8672a9c23ba6ab4fb4b
- Verifies all stock positions have marketPrice field
- Shows simple pass/fail result

**Expected output on success:**
```
✓ Got 10 stocks
✓ 10/10 have marketPrice field

🎉 SUCCESS: All stocks have marketPrice!
```

---

### test-portfolio-positions.js
Comprehensive test with detailed analysis of portfolio positions.

**Usage:**
```bash
# Default (portfolio 69dbf8672a9c23ba6ab4fb4b, admin/Test4545,)
node test-portfolio-positions.js

# Custom portfolio
node test-portfolio-positions.js <portfolioId> <username> <password>

# Example with custom credentials
node test-portfolio-positions.js 69dbf8672a9c23ba6ab4fb4b lars@softcapital.com "Test4545,"
```

**What it does:**
- Authenticates with provided credentials
- Requests portfolio positions with marketPrice mode "4"
- Separates actual stocks from aggregate/summary rows
- Analyzes which fields are present
- Shows detailed results

**Expected output:**
```
╔══════════════════════════════════════════════════════════╗
║       Portfolio Positions - marketPrice Test              ║
╚══════════════════════════════════════════════════════════╝

[1/3] Authenticating...
✓ Authenticated

[2/3] Fetching portfolio positions...
    Portfolio: 69dbf8672a9c23ba6ab4fb4b
    marketPrice: "4" (latestPrice or close + change)
    basePrice: "4"

[3/3] Analyzing results...

📊 Portfolio Structure:
   Total positions: 79
   Stocks: 10
   Aggregates: 69

Stock Positions:
   ✓ 10 with complete data (27 fields each)

───────────────────────────────────────────────────────────
🎉 SUCCESS: All stock positions have marketPrice field!
───────────────────────────────────────────────────────────
```

---

## Understanding Results

### Stock Positions (Real Holdings)
- Should have: `marketPrice`, `price`/`bprice`, `volume`, `marketValue`, `result`, `weight`, etc.
- Example symbols: ASML:XAMS, ODFL:XNAS, MSFT:XNAS, WDC:XNAS

### Aggregate Positions (TOTAL_* rows)
- These are portfolio summaries by currency, country, sector, etc.
- Legitimately don't have `marketPrice` or `volume` (they're totals, not holdings)
- Examples: TOTAL_USD, TOTAL_France, TOTAL_Semiconductors

---

## marketPrice Modes

The `marketPrice` parameter can be:
- `"0"` - iexBidPrice
- `"1"` - iexAskPrice
- `"2"` - latestPrice OR close
- `"3"` - open price
- `"4"` - **latestPrice OR (close + change)** ← Used in these tests
- `"5"` - high
- `"6"` - low
- `"7"` - midpoint of bid/ask or close
- `"8"` - latestPrice or midpoint or close

---

## Troubleshooting

### "Authentication failed"
- Check username and password
- Verify server is running: `npm start`
- Check that the account exists in the database

### "Portfolio request timeout"
- Server may be slow
- Try increasing timeout in the test
- Check server logs for errors

### "Connection refused"
- Verify server is running on port 3331 (login) and 3332 (app)
- Check HTTPS certificate settings

### Some stocks missing marketPrice
- Quote service may not have data for those symbols
- Check `http://localhost:5065/quotes` for symbol availability
- International exchanges may have slower data delivery

---

## Running Tests in CI/CD

```bash
# Quick health check
npm test

# Detailed validation
node test-portfolio-positions.js <portfolio-id> <user> <pass>
```

Exit codes:
- `0` - Success
- `1` - Failure
