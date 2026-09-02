# PS2 MCP Server

Model Context Protocol server for the **PS2 portfolio management system**.  
Exposes all PS2 commands as MCP tools so any MCP-compatible AI client (Claude Desktop, Cursor, Continue, OpenClaw, …) can query and manage portfolios directly.

---

## What you get

| Tool | Command |
|------|---------|
| `portfolios_list` | List portfolios with optional filter |
| `portfolios_add` | Create a portfolio |
| `portfolios_update` | Update portfolio metadata |
| `portfolios_remove` | Delete portfolio + all its trades |
| `portfolios_history` | NAV history (day/week/month sampling, with or without trade detail) |
| `portfolios_positions` | Current positions snapshot — holdings, P&L, cash buckets |
| `portfolios_trades` | Trade history for a portfolio |
| `portfolios_put_cash` | Deposit / withdraw cash |
| `portfolios_put_dividends` | Record dividend payments |
| `trades_add` | Add a buy/sell trade (equities, FX, and options/futures via `contract`) |
| `trades_update` | Correct a trade |
| `trades_remove` | Delete a single trade |
| `trades_remove_all` | Wipe all trades in a portfolio |
| `prices_historical` | Historical closing prices for symbols |
| `tools_statistic` | Performance statistics for a portfolio or price series |
| `tools_theo_price` | Theoretical price for an option or future/forward - standalone calculator, no position/Contract required |

---

## Prerequisites

- **Node.js 18+**
- Network access to the PS2 server (`top.softcapital.com` by default, or your own instance)
- A valid PS2 login (member or admin role)

---

## Installation

```bash
git clone <this-repo>          # or copy the mcp/ folder into your project
cd mcp
npm install
npm run build                  # compiles TypeScript → dist/
```

---

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PS2_LOGIN` | **Yes** | — | PS2 username |
| `PS2_PASSWORD` | **Yes** | — | PS2 password |
| `PS2_HOST` | No | `top.softcapital.com` | PS2 server hostname or IP |
| `PS2_LOGIN_PORT` | No | `3331` | Login WebSocket port |
| `PS2_APP_PORT` | No | `3332` | App WebSocket port |
| `PS2_SSL` | No | `true` | Set to `false` for a local HTTP-only dev server |
| `PS2_TIMEOUT` | No | `30000` | Command timeout in ms |

**Local development server example** (HTTP, ports 3001/3002):

```
PS2_SSL=false PS2_LOGIN_PORT=3001 PS2_APP_PORT=3002 PS2_HOST=localhost
```

---

## Adding to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or  
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ps2": {
      "command": "node",
      "args": ["/absolute/path/to/ps2/mcp/dist/index.js"],
      "env": {
        "PS2_LOGIN": "yourlogin",
        "PS2_PASSWORD": "yourpassword",
        "PS2_HOST": "top.softcapital.com"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the PS2 tools appear in the tool list.

---

## Adding to Cursor / Continue / VS Code

In `.cursor/mcp.json` or your MCP client's config:

```json
{
  "mcpServers": {
    "ps2": {
      "command": "node",
      "args": ["/absolute/path/to/ps2/mcp/dist/index.js"],
      "env": {
        "PS2_LOGIN": "yourlogin",
        "PS2_PASSWORD": "yourpassword"
      }
    }
  }
}
```

---

## Adding to OpenClaw (or any stdio MCP client)

Start the server process with the required env vars and pipe stdin/stdout:

```bash
PS2_LOGIN=yourlogin PS2_PASSWORD=yourpass node /path/to/mcp/dist/index.js
```

The process speaks the MCP stdio protocol on stdin/stdout.  
stderr is used for error logging and does not carry protocol messages.

---

## Running the smoke test

The smoke test creates a portfolio, funds it, adds multiple trades, inspects positions and history, updates trades, records dividends, and then cleans everything up. It finishes with a pass/fail summary.

```bash
cd mcp

# Against production
PS2_LOGIN=yourlogin PS2_PASSWORD=yourpass npm run smoke

# Against a local dev server (HTTP)
PS2_LOGIN=admin PS2_PASSWORD=pass PS2_SSL=false PS2_LOGIN_PORT=3001 PS2_APP_PORT=3002 PS2_HOST=localhost npm run smoke
```

Expected output:

```
PS2 Smoke Test — portfolio: _smoke_1714123456789
Server: wss://top.softcapital.com

━━━ portfolios.list — baseline ─────────────────────────────────────────
  ✅ returns an array
     3 existing portfolio(s)

━━━ portfolios.add ──────────────────────────────────────────────────────
  ✅ has _id
  ✅ name matches
  ✅ currency is USD
     portfolioId: 663a1b2c3d4e5f6a7b8c9d0e
…
════════════════════════════════════════════════════════════
Results: 42 passed, 0 failed
```

Exit code 0 = all passed, 1 = at least one failure.

---

## Tool reference

### `portfolios_list`

```json
{ "filter": {} }
{ "filter": { "name": "MyPortfolio" } }
```

### `portfolios_add`

```json
{
  "name": "Growth Portfolio",
  "currency": "USD",
  "baseInstrument": "SPY",
  "description": "Long-term growth"
}
```

### `portfolios_update`

```json
{ "_id": "Growth Portfolio", "description": "Updated description", "baseInstrument": "QQQ" }
```

`_id` accepts MongoDB `_id`, portfolio name, or `accountId`.

### `portfolios_remove`

```json
{ "_id": "Growth Portfolio" }
```

Removes the portfolio and **all its trades**. Irreversible.

### `portfolios_history`

```json
{
  "_id": "Growth Portfolio",
  "from": "2024-01-01",
  "till": "2024-12-31",
  "sample": 3,
  "detail": 0
}
```

`sample`: `0`=trade dates, `1`=daily, `2`=weekly, `3`=monthly  
`detail`: `0`=summary, `1`=summary + per-trade breakdown  

Response shape:
```json
{
  "days": [
    { "date": "2024-01-31", "nav": 103059.31, "cash": 1083.71, "invested": 101975.60, "investedWithoutTrades": 0 }
  ],
  "details": [ ... ]
}
```

`nav = cash + invested + investedWithoutTrades`

### `portfolios_positions`

```json
{ "_id": "Growth Portfolio", "marketType": 4, "basePrice": 4 }
```

`marketType` / `basePrice`: `0`=bid, `1`=offer, `2`=last, `3`=open, `4`=close, `5`=high, `6`=low, `7`=avg

Cash positions appear as `CASH_USD`, `CASH_EUR`, etc. with `total` (portfolio currency) and `totalLocal`.

### `portfolios_trades`

```json
{ "_id": "Growth Portfolio", "from": "2024-01-01" }
```

### `portfolios_put_cash`

```json
{
  "portfolioId": "Growth Portfolio",
  "amount": 100000,
  "currency": "USD",
  "tradeTime": "2024-01-01T08:00:00",
  "description": "Initial investment",
  "tradeType": "investment"
}
```

`tradeType`: `cash` (default) | `investment` | `dividends` | `correction`  
Negative `amount` = withdrawal.

### `portfolios_put_dividends`

```json
{
  "portfolioId": "Growth Portfolio",
  "symbol": "AAPL",
  "amount": 0.24,
  "currency": "USD",
  "tradeTime": "2024-02-15T00:00:00"
}
```

Adds `current_symbol_volume × amount` to cash.

### `trades_add`

**Equity buy:**
```json
{
  "portfolioId": "Growth Portfolio",
  "side": "B",
  "symbol": "AAPL",
  "volume": 50,
  "price": 182.68,
  "currency": "USD",
  "rate": 1,
  "fee": 2.74,
  "tradeTime": "2024-01-10T09:30:00"
}
```

**Equity sell:**
```json
{
  "portfolioId": "Growth Portfolio",
  "side": "S",
  "symbol": "AAPL",
  "volume": 25,
  "price": 193.12,
  "currency": "USD",
  "fee": 1.93,
  "tradeTime": "2024-01-29T10:00:00"
}
```

**FX trade — buy EUR with DKK (EURDKK:FX, side=B moves DKK→EUR):**
```json
{
  "portfolioId": "FX Portfolio",
  "side": "B",
  "symbol": "EURDKK:FX",
  "volume": 100000,
  "price": 7.46,
  "currency": "DKK",
  "fee": 50,
  "tradeTime": "2024-04-19T09:00:00"
}
```

**Option trade — buy an MSFT call, booked as an OTC trade:**

Omit `symbol` and pass `contract` instead — the contract is created/upserted by identity
(`underlyingSymbolMic` + `contractType` + `strike` + `expirationDate`) and `trade.symbol`/
`contractId` are set from it automatically. See
`portfolio-server/docs/derivatives/03-migration-notes.md` for the full data model.

```json
{
  "portfolioId": "Growth Portfolio",
  "side": "B",
  "contract": {
    "underlyingSymbolMic": "MSFT:XNAS",
    "contractType": "call",
    "strike": 400,
    "expirationDate": "2026-09-18",
    "symbol": "MSFT260918C00400000"
  },
  "volume": 10,
  "price": 12.5,
  "currency": "USD",
  "fee": 6.5,
  "tradeTime": "2026-07-06T14:00:00"
}
```

`contract.contractType`: `future` | `forward` | `call` | `put` — direction/kind only; exercise
style is a separate, optional `executionStyle` (`european` | `american`) that cascades from
`underlyingOptionSettings` → `contractExpirations` → the contract itself if not set here.
An option-on-future sets `baseContractId` to the future contract's `_id` instead of pricing off
the cash underlying.

### `trades_update`

```json
{ "_id": "663a1b2c3d4e5f...", "fee": 2.00, "description": "Corrected fee" }
```

### `trades_remove`

```json
{ "_id": "663a1b2c3d4e5f..." }
```

### `trades_remove_all`

```json
{ "portfolioId": "Growth Portfolio" }
```

Removes **all** trades. Portfolio becomes empty.

### `prices_historical`

**Single date:**
```json
{ "symbols": "AAPL,INTC,SPY", "date": "2024-01-10" }
```
Response: `{ "AAPL": 182.68, "INTC": 47.25, "SPY": 476.07 }`

**Date range:**
```json
{ "symbols": "AAPL,SPY", "from": "2024-01-08", "till": "2024-01-12", "precision": 2 }
```
Response: `[{ "date": "2024-01-08", "AAPL": 185.56, "SPY": 474.19 }, ...]`

### `tools_statistic`

**Portfolio statistics:**
```json
{ "portfolio": "Growth Portfolio" }
```

**Historical symbol statistics:**
```json
{ "history": "SPY", "from": "2020-01-02", "till": "2023-12-29" }
```

### `tools_theo_price`

Standalone theoretical-price calculator - not tied to any held position or existing `Contract`.
Every field beyond `underlyingSymbolMic`/`contractType`/expiration/strike is optional and
auto-resolved (live spot, historical realized volatility, risk-free rate, dividend yield,
execution style, day-count convention, pricing model); pass any of them to override, e.g. for a
what-if scenario. Use `daysToExpiration` instead of `expirationDate` for anything that should stay
valid over time rather than hardcoding a date.

**Auto-resolve everything (live data):**
```json
{
  "underlyingSymbolMic": "MSFT:XNAS",
  "contractType": "call",
  "strike": 400,
  "daysToExpiration": 90
}
```
Response:
```json
{
  "theoPrice": 121.94,
  "greeks": {
    "delta": 0.8534, "gamma": 0.0041, "vega": 0.7218, "theta": -0.0489,
    "rho": 0.6142, "rhoTenBasis": 0.0615, "rhoOneBasis": 0.0061,
    "speed": -0.0002, "charm": -0.0003, "color": 0.00001
  },
  "resolved": {
    "spotPrice": 507.29,
    "priceDriverSymbol": "MSFT:XNAS",
    "volatility": 48.74,
    "interestRate": 4.25,
    "dividendRate": 0.95,
    "dayCountConvention": "act365",
    "executionStyle": "american",
    "futureBased": false,
    "theoModel": "americanBinomial",
    "timeToExpiry": 0.293,
    "calcDate": "2026-09-02"
  }
}
```

**Full manual override (what-if scenario, no live data touched):**
```json
{
  "underlyingSymbolMic": "MSFT:XNAS",
  "contractType": "put",
  "strike": 400,
  "daysToExpiration": 90,
  "spotPrice": 400,
  "volatility": 25,
  "interestRate": 4.5,
  "dividendRate": 1,
  "executionStyle": "european"
}
```

**Option-on-future** (priced via Black-76 off an existing future `Contract`'s own price, not the
cash underlying) - set `baseContractId` to that future's `_id`:
```json
{
  "underlyingSymbolMic": "SPY:ARCX",
  "contractType": "call",
  "strike": 6300,
  "daysToExpiration": 90,
  "baseContractId": "..."
}
```

**Plain future/forward** (cost-of-carry, `F = S * e^((r-q)*T)` - no `theoModel`/`executionStyle` applies):
```json
{ "underlyingSymbolMic": "SPY:ARCX", "contractType": "future", "daysToExpiration": 30 }
```

**Greeks.** Every option reply carries a `greeks` block alongside `theoPrice` - no extra flag.
A plain future/forward has none, since it is priced by cost of carry rather than an option model.

| Greek | Meaning |
|---|---|
| `delta` | price change per 1.00 move in the underlying (call 0..1, put -1..0) |
| `gamma` | delta change per 1.00 move in the underlying |
| `vega` | price change per **1 percentage point** of volatility (22 -> 23) |
| `theta` | price given up over **one trading day** (Friday's covers the weekend) |
| `rho` | price change per 1 percentage point of interest rate |
| `rhoTenBasis` / `rhoOneBasis` | the same for a 10bp / 1bp move |
| `speed` | gamma change per 1.00 move in the underlying |
| `charm` | delta change over one trading day |
| `color` | gamma change over one trading day |

Delta and gamma are closed-form for European contracts and read off the binomial tree for
American ones; the rest are finite-difference bumps of the price, matching how the original
JCalc engine computed them.

An expired contract (`calcDate` past `expirationDate`) returns `{ "error": "Contract has already
expired as of calcDate", "resolved": {...} }` rather than a stale price.

---

## How PS2 identifies portfolios

All tools that accept `_id` or `portfolioId` support three forms:
- MongoDB `_id`: `"663a1b2c3d4e5f6a7b8c9d0e"`
- Portfolio name: `"Growth Portfolio"`
- Account ID: `"ACC123"`

---

## Protocol notes (for contributors)

The PS2 WebSocket API uses a custom fragmentation protocol for large responses.  
Each response is split into 1024-character chunks, each sent as:

```json
{ "index": 0, "total": 5, "data": "<chunk>", "msgId": 42 }
```

The client (`src/client.ts`) reassembles these fragments in order before resolving the promise.

Authentication flow:
1. Connect to login WS → send `{cmd:"login", login, password}` → receive `{token, role, userId}`
2. Connect to app WS at `wss://host:appPort/?<token>`
3. Send commands as `{command, msgId, ...params}` → receive fragmented responses matched by `msgId`

---

## Project structure

```
mcp/
├── src/
│   ├── index.ts     MCP server entry point (stdio transport)
│   ├── client.ts    PS2 WebSocket client (auth, fragmentation, reconnect)
│   └── tools.ts     All tool definitions and handlers
├── test/
│   └── smoke.ts     End-to-end test covering every command
├── dist/            Compiled output (after npm run build)
├── package.json
├── tsconfig.json
└── README.md
```
