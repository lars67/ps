# PS2 API Manual

## Introduction

This document provides a comprehensive guide to the PS2 API, its components, and operations.

## Authentication

### Login

Authenticates a user and returns a token for subsequent API calls.

**Command:**

```json
{"cmd":"login","login":"username","password":"userpassword"}
```

**Parameters:**

| Parameter | Description     | Required |
| :-------- | :-------------- | :------- |
| login     | User's username | Yes      |
| password  | User's password | Yes      |

**Successful Response:**

```json
{
  "token": "eyJhbGciOiJIU...",
  "role": "member",
  "userId": "66450cb15e1f94688db59355"
}
```

**Error Response:**

```json
{"error": "Invalid credentials"}
```

### Signup

Creates a new user account in the system.

**Command:**

```json
{
  "cmd": "signup",
  "login": "newuser",
  "password": "newpassword",
  "email": "user@example.com",
  "firstName": "John",
  "secondName": "Doe",
  "accountNumber": "ACC123456",
  "telephone": "+1234567890",
  "country": "USA",
  "source": "web-form"
}
```

**Parameters:**

| Parameter     | Description                        | Required |
| :------------ | :--------------------------------- | :------- |
| login         | Desired username                   | Yes      |
| password      | Desired password                   | Yes      |
| email         | User's email address               | Yes      |
| firstName     | User's first name                  | Yes      |
| secondName    | User's last name                   | Yes      |
| accountNumber | User's account number              | Yes      |
| telephone     | User's phone number                | Yes      |
| country       | User's country                     | Yes      |
| source        | Signup source/origin channel       | Yes      |

**Successful Response:** Returns the newly created user object.

**Error Response:**

```json
{"error": "Username already exists"}
```

## Collections

Collections represent groups of related data. Common operations on collections include list, add, update, and remove.

### General Syntax

Collection operations follow the syntax: `collection_name.method`

**Example:**

```json
{"command": "portfolios.list", "filter": {}}
```

### List

Retrieves a list of items from the specified collection.

**Command:**

```json
{"command": "collection_name.list", "filter": {}}
```

**Parameters:**

| Parameter | Description                                  | Required |
| :-------- | :------------------------------------------- | :------- |
| filter    | Object with collection fields to filter results | No       |

**Output:** Returns an array of objects matching the filter criteria.

### Add

Adds a new item to the specified collection.

**Command:**

```json
{"command": "collection_name.add", "field1": "value1", "field2": "value2"}
```

**Parameters:** Fields depend on the specific collection.

**Output:** Returns the newly created object, including its assigned \_id.

### Update

Updates an existing item in the collection.

**Command:**

```json
{"command": "collection_name.update", "_id": "record_id", "field1": "new_value"}
```

**Parameters:**

| Parameter        | Description                            | Required |
| :--------------- | :------------------------------------- | :------- |
| \_id             | MongoDB key for the record to update   | Yes      |
| field1, field2... | Fields to update with their new values | At least one |

**Output:** Returns the updated object.

### Remove

Removes an item from the collection.

**Command:**

```json
{"command": "collection_name.remove", "_id": "record_id"}
```

**Parameters:**

| Parameter | Description                          | Required |
| :-------- | :----------------------------------- | :------- |
| \_id     | MongoDB key for the record to remove | Yes      |

**Output:** Returns a success message or the removed object.

## Console

The PS2Dox console provides a command-line interface for interacting with the system.

### Features:

*   Command execution
*   Output display
*   Error reporting
*   System status monitoring

## Operations

Operations in PS2Dox encompass various actions and processes within the system.

### Categories of operations:

1.  User Management
    *   User registration
    *   Authentication
    *   Profile management
2.  Portfolio Management
    *   Portfolio creation
    *   Portfolio updates
    *   Portfolio deletion
3.  Trading
    *   Order placement
    *   Order modification
    *   Order cancellation
4.  Data Retrieval
    *   Market data fetching
    *   Performance metrics calculation
    *   Report generation
5.  System Administration
    *   User account management
    *   System configuration
    *   Performance monitoring

## Portfolios

Portfolios in PS2Dox represent collections of financial instruments or assets.

### Create Portfolio

Creates a new portfolio with the specified details.

**Command:**

```json
{
  "command": "portfolios.add",
  "name": "Growth Portfolio",
  "description": "High-risk, high-reward strategy",
  "currency": "USD",
  "baseInstrument": "SPY"
}
```

**Parameters:**

| Parameter      | Description                                  | Required |
| :------------- | :------------------------------------------- | :------- |
| name           | Name of the portfolio                        | Yes      |
| description    | Description of the portfolio strategy        | No       |
| currency       | Base currency for the portfolio              | Yes      |
| baseInstrument | Benchmark instrument for performance comparison | Yes      |

**Output:** Returns the newly created portfolio object.

### List Portfolios

Retrieves a list of portfolios.

**Command:**

```json
{
  "command": "portfolios.list",
  "filter": {"currency": "USD"}
}
```

**Parameters:**

| Parameter | Description                                  | Required |
| :-------- | :------------------------------------------- | :------- |
| filter    | Object with portfolio fields to filter results | No       |

**Output:** Returns an array of portfolio objects matching the filter criteria.

### Update Portfolio

Modifies an existing portfolio.

**Command:**

```json
{
  "command": "portfolios.update",
  "_id": "portfolio_id",
  "description": "Updated portfolio description"
}
```

**Parameters:**

| Parameter                | Description            | Required |
| :----------------------- | :--------------------- | :------- |
| \_id                     | ID of the portfolio to update | Yes      |
| name, description, ... | Fields to update       | At least one |

**Output:** Returns the updated portfolio object.

### Remove Portfolio

Deletes a portfolio from the system.

**Command:**

```json
{
  "command": "portfolios.remove",
  "_id": "portfolio_id"
}
```

**Parameters:**

| Parameter | Description                 | Required |
| :-------- | :-------------------------- | :------- |
| \_id     | ID of the portfolio to remove | Yes      |

**Output:** Returns a success message or the removed portfolio object.

### Get Portfolio Positions

Retrieves current portfolio positions with real-time market data and optional attribution analysis.

### Get Portfolio Attribution

Calculates the performance breakdown of a portfolio into Trading, Passive (Dividends), and Currency components.

**Command:**

```json
{
  "command": "portfolios.attribution",
  "_id": "portfolio_id"
}
```

**Parameters:**

| Parameter | Description         | Required |
| :-------- | :------------------ | :------- |
| _id       | ID of the portfolio | Yes      |

**Output:** Returns an `ATTRIBUTION` object with the amount and percentage breakdown for each income stream.

#### Income Streams:
- **Trading**: Profit/Loss from asset price movements (Gross of fees).
- **Passive**: Income from dividends.
- **Currency**: Profit/Loss from fluctuations in exchange rates.

**Command:**

```json
{
  "command": "portfolios.positions",
  "_id": "portfolio_id",
  "requestType": "0",
  "marketPrice": "4",
  "basePrice": "4",
  "closed": "no",
  "totalsMode": "all",
  "includeAttribution": false
}
```

**Parameters:**

| Parameter        | Description                                                                 | Required | Default |
| :--------------- | :-------------------------------------------------------------------------- | :------- | :------ |
| \_id             | ID of the portfolio                                                         | Yes      | -       |
| requestType      | Request type: "0" for snapshot, "1" for subscribe                          | No       | "0"     |
| marketPrice      | Market price type (0-8, see below)                                         | No       | "4"     |
| basePrice        | Base price type (0-8, see below)                                           | No       | "4"     |
| closed           | Filter: "no" (open only), "only" (closed only), "all" (both)               | No       | "no"    |
| totalsMode       | Totals inclusion mode: "all" (include all totals), "minimal" (main total only), "none" (no totals) | No       | "all"   |
| includeAttribution | Include portfolio attribution breakdown (trading/passive/currency income) | No       | false   |

**Price Types:**
- 0: IEX Bid Price
- 1: IEX Ask Price
- 2: Latest Price
- 3: Open Price
- 4: Close Price
- 5: High Price
- 6: Low Price
- 7: Mid Price (avg bid/ask)
- 8: Latest or Mid Price

**Attribution Calculation Example:**

Given portfolio positions:
- IBM (USD): investedFull: 5760 DKK, result: 90.35 DKK, dividends: 5.04 USD × 6.4169 = 32.33 DKK
- DELL (USD): investedFull: 2028.75 DKK, result: -291.90 DKK, dividends: 0

**Total Return:** -201.55 + 32.33 = -169.22 DKK

**Attribution Breakdown:**
- Trading income: -201.55 DKK (118.9%)
- Passive income: 32.33 DKK (-19.1%)
- Currency income: 0.53 DKK (-0.3%)

**Output:** Returns an array of position objects with market data. If `includeAttribution=true`, includes an `ATTRIBUTION` object with breakdown percentages.

### Debug Portfolio

Generates a detailed, row-by-row debug report for a specified portfolio, including historical trades, cash movements, and daily position snapshots.

**Command:**

```json
{
  "command": "portfolios.debug",
  "portfolioId": "portfolio_id",
  "from": "YYYY-MM-DD",
  "till": "YYYY-MM-DD",
  "granularity": "day",
  "includeSummaries": true,
  "exportToCsv": false,
  "fileName": "debug_report.csv"
}
```

**Parameters:**

| Parameter        | Description                                            | Required |
| :--------------- | :----------------------------------------------------- | :------- |
| portfolioId      | ID of the portfolio to debug                           | Yes      |
| from             | Start date for the report (YYYY-MM-DD)                 | No       |
| till             | End date for the report (YYYY-MM-DD)                   | No       |
| granularity      | Reporting interval: "day" or "trade" (defaults to "day") | No       |
| includeSummaries | Boolean to include "Portfolio Summary" and "Daily Close" rows (defaults to `true`) | No       |
| exportToCsv      | Set to `true` to export the report to a CSV file      | No       |
| fileName         | Optional filename for the CSV export                   | No       |

**Output:** Returns an array of report rows (JSON) or a file path to the generated CSV.
 Sample output rows include:
 - `Portfolio Summary`: Aggregated daily portfolio metrics.
 - `Position Snapshot`: End-of-day details for each security held.
 - `Trade (Buy/Sell)`: Detailed information for each trade.
 - `Cash Deposit/Withdrawal`, `Dividends`, `Investment`, `Correction`: Details for non-trade cash/equity movements.

## Prices

The Prices module in PS2Dox handles asset pricing data.

### Get Current Price

Retrieves the most recent price for a specified symbol.

**Command:**

```json
{
  "command": "prices.getCurrent",
  "symbol": "AAPL",
  "exchange": "NASDAQ"
}
```

**Parameters:**

| Parameter | Description             | Required |
| :-------- | :---------------------- | :------- |
| symbol    | Ticker symbol of the asset | Yes      |
| exchange  | Exchange where the asset is traded | Yes      |

**Output:** Returns an object with the current price and timestamp.

### Get Historical Prices

Fetches historical price data for a symbol over a specified date range.

**Command:**

```json
{
  "command": "prices.getHistorical",
  "symbol": "GOOGL",
  "startDate": "2023-01-01",
  "endDate": "2023-12-31",
  "interval": "daily"
}
```

**Parameters:**

| Parameter | Description                               | Required |
| :-------- | :---------------------------------------- | :------- |
| symbol    | Ticker symbol of the asset                | Yes      |
| startDate | Start date for historical data (YYYY-MM-DD) | Yes      |
| endDate   | End date for historical data (YYYY-MM-DD)   | Yes      |
| interval  | Data interval (daily, weekly, monthly)    | Yes      |

**Output:** Returns an array of objects, each containing a date and corresponding price data.

### Set Price Alert

Creates a price alert for a specific symbol.

**Command:**

```json
{
  "command": "prices.setAlert",
  "symbol": "TSLA",
  "condition": "above",
  "price": 800.00
}
```

**Parameters:**

| Parameter | Description           | Required |
| :-------- | :-------------------- | :------- |
| symbol    | Ticker symbol of the asset | Yes      |
| condition | Alert condition (above, below) | Yes      |
| price     | Target price for the alert | Yes      |

**Output:** Returns a confirmation object with the alert details.

### Manage Price Feed

Allows you to subscribe to or unsubscribe from real-time price feeds for specified symbols.

**Command:**

```json
{
  "command": "prices.manageFeed",
  "action": "subscribe",
  "symbols": ["AAPL", "GOOGL", "MSFT"]
}
```

**Parameters:**

| Parameter | Description                         | Required |
| :-------- | :---------------------------------- | :------- |
| action    | Action to perform (subscribe, unsubscribe) | Yes      |
| symbols   | Array of ticker symbols             | Yes      |

**Output:** Returns a confirmation object with the updated subscription status.

## Tests

The Tests module in PS2Dox ensures system reliability and performance.

### Run Unit Tests

Executes unit tests for a specific module.

**Command:**

```json
{
  "command": "tests.runUnit",
  "module": "authentication"
}
```

**Parameters:**

| Parameter | Description                | Required |
| :-------- | :------------------------- | :------- |
| module    | Name of the module to test | Yes      |

**Output:** Returns a detailed report of the unit test results.

### Run Integration Tests

Runs integration tests to ensure different parts of the system work correctly together.

**Command:**

```json
{
  "command": "tests.runIntegration",
  "scenario": "full_trade_cycle"
}
```

**Parameters:**

| Parameter | Description                     | Required |
| :-------- | :------------------------------ | :------- |
| scenario  | Name of the integration test scenario | Yes      |

**Output:** Returns a comprehensive report of the integration test results.

### Run Performance Tests

Executes performance tests to evaluate the system's behavior under various load conditions.

**Command:**

```json
{
  "command": "tests.runPerformance",
  "testCase": "high_volume_trading"
}
```

**Parameters:**

| Parameter | Description                    | Required |
| :-------- | :----------------------------- | :------- |
| testCase  | Name of the performance test case | Yes      |

**Output:** Returns a detailed performance report including metrics like response times and throughput.

### Run Automated Test Suite

Runs a predefined suite of tests, which may include a combination of unit, integration, and performance tests.

**Command:**

```json
{
  "command": "tests.runSuite",
  "suite": "daily_regression"
}
```

**Parameters:**

| Parameter | Description                | Required |
| :-------- | :------------------------- | :------- |
| suite     | Name of the test suite to run | Yes      |

**Output:** Returns a comprehensive report of all tests run in the suite.

## Tools

PS2Dox provides various tools to assist users in their operations.

### Data Analysis

Performs statistical analysis on specified datasets.

**Command:**

```json
{
  "command": "tools.analyzeData",
  "dataset": "portfolio_returns",
  "method": "regression"
}
```

**Parameters:**

| Parameter | Description                 | Required |
| :-------- | :-------------------------- | :------- |
| dataset   | Name of the dataset to analyze | Yes      |
| method    | Analysis method to apply    | Yes      |

**Output:** Returns the results of the analysis, which vary based on the chosen method.

### Report Generation

Creates detailed reports based on portfolio data.

**Command:**

```json
{
  "command": "tools.generateReport",
  "type": "monthly_performance",
  "portfolioId": "portfolio_id"
}
```

**Parameters:**

| Parameter   | Description                 | Required |
| :---------- | :-------------------------- | :------- |
| type        | Type of report to generate  | Yes      |
| portfolioId | ID of the portfolio for the report | Yes      |

**Output:** Returns a detailed report object or a link to download the report.

### Risk Assessment

Evaluates the risk associated with a portfolio.

**Command:**

```json
{
  "command": "tools.assessRisk",
  "portfolioId": "portfolio_id",
  "method": "var"
}
```

**Parameters:**

| Parameter   | Description                | Required |
| :---------- | :------------------------- | :------- |
| portfolioId | ID of the portfolio to assess | Yes      |
| method      | Risk assessment method to use | Yes      |

**Output:** Returns a risk assessment report with various risk metrics.

### API Integration

Sets up integration with external APIs.

**Command:**

```json
{
  "command": "tools.integrateAPI",
  "externalService": "marketDataProvider",
  "apiKey": "your_api_key"
}
```

**Parameters:**

| Parameter       | Description                         | Required |
| :-------------- | :---------------------------------- | :------- |
| externalService | Name of the external service to integrate | Yes      |
| apiKey          | API key for the external service    | Yes      |

**Output:** Returns a confirmation object with integration status and details.

## Trades

The Trades module manages all aspects of trading operations in PS2Dox.

### Place Order

Places a new order for a specified symbol within a portfolio.

**Command:**

```json
{
  "command": "trades.placeOrder",
  "portfolioId": "portfolio_id",
  "symbol": "AAPL",
  "type": "buy",
  "quantity": 100,
  "price": 150.00,
  "orderType": "limit"
}
```

**Parameters:**

| Parameter   | Description                         | Required |
| :---------- | :---------------------------------- | :------- |
| portfolioId | ID of the portfolio for the trade | Yes      |
| symbol      | Ticker symbol of the asset        | Yes      |
| type        | Order type (buy or sell)          | Yes      |
| quantity    | Number of shares to trade         | Yes      |
| price       | Limit price (for limit orders)    | Yes for limit orders |
| orderType   | Type of order (market or limit)   | Yes      |

**Output:** Returns an order confirmation object with order details and status.

### Modify Order

Modifies an existing, unfilled order.

**Command:**

```json
{
  "command": "trades.modifyOrder",
  "orderId": "order_id",
  "newQuantity": 150,
  "newPrice": 155.00
}
```

**Parameters:**

| Parameter   | Description                     | Required |
| :---------- | :------------------------------ | :------- |
| orderId     | ID of the order to modify       | Yes      |
| newQuantity | New quantity for the order      | No       |
| newPrice    | New price for the order (limit orders only) | No       |

**Output:** Returns the updated order object.

### Cancel Order

Cancels an unfilled order.

**Command:**

```json
{
  "command": "trades.cancelOrder",
  "orderId": "order_id"
}
```

**Parameters:**

| Parameter | Description               | Required |
| :-------- | :------------------------ | :------- |
| orderId   | ID of the order to cancel | Yes      |

**Output:** Returns a confirmation of the cancellation.

### Get Trade History

Retrieves the trading history for a specified portfolio over a given date range.

**Command:**

```json
{
  "command": "trades.getHistory",
  "_id": "portfolio_id",
  "from": "2023-01-01",
  "till": "2023-12-31",
  "sample": "day",
  "detail": 1
}
```

**Parameters:**

| Parameter | Value                                                        | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             .
