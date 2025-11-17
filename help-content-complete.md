# PS2 Help Documentation

## Home

*In construction...*

## Access

### Roles

There are 3 main roles:

- **admin** - has full access to all commands and data. Can do commands with any userId, so instead userId!!!??
- **member** - has restricted access to commands and data. See member access details below
- **guest** - has not authorized guest access to public portfolios and some limited number commands

### Member Access

Member must present in db (login and password) communication via websocket

Have access to own portfolios and public portfolios other users

Available commands:
- `portfolios.list` - show public and own portfolios
- `portfolios.add` - add own portfolio
- `portfolios.update` - update own portfolio
- `portfolios.remove` - remove own portfolio
- `portfolios.history`
- `portfolios.positions`
- `portfolios.putCash`
- `portfolios.putInvestment`
- `portfolios.putDividends`
- `portfolios.trades`
- `trades.add`
- `trades.update`
- `trades.remove`

### Guest Access

Guest communication via separated websocket, no login required.

Have access to public portfolios and commands:
- `portfolios.history`
- `portfolios.positions`

## Commands

### Collections

Common collection commands are **list, add, update, remove**. Syntax: `collection_name.method`.

Example:
```json
{"command": "portfolios.list", "filter": {}}
```

This is general description for collection methods **list, add, update, remove**. For more details see specific collection commands.

#### List
**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| filter | Object with collection fields | No |

**Example:**
```json
{"command": "portfolios.list", "filter": {"name": "_Renamed"}}
```

#### Add
**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| some fields | Current collection fields. New record will be added. | Yes |

**Example:**
```json
{"command": "portfolios.add", "name": "_testPortfolio", "description": "", "currency": "USD", "userId": "", "baseInstrument": "SPY"}
```

#### Update
**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | MongoDB key (_id) for current record | Yes |
| some fields | Current collection fields which will be updated | No |

**Example:**
```json
{"command": "portfolios.update", "_id": "$var.pid", "description": "Update description and name", "name": "_Renamed"}
```

#### Remove
**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | MongoDB key (_id) for current record | Yes |

**Example:**
```json
{"command": "portfolios.remove", "_id": "_testPortfolio"}
```

### Portfolios

#### Available Commands

| Command | Call |
| :------ | :-- |
| [List](#portfolios-list) | `{"command": "portfolios.list", "filter": {}}` |
| [Detail List](#portfolios-detail-list) | `{"command": "portfolios.detailList", "filter": {}}` |
| [Add](#portfolios-add) | `{"command": "portfolios.add", "name": "PortfolioName", "description": "", "currency": "USD", "userId": "", "baseInstrument": "SPY"}` |
| [Update](#portfolios-update) | `{"command": "portfolios.update", "_id": "?", "name": "PortfolioName", "description": "", "currency": "USD", "userId": "", "baseInstrument": "SPY"}` |
| [Remove](#portfolios-remove) | `{"command": "portfolios.remove", "_id": "?"}` |
| [History](#portfolios-history) | `{"command": "portfolios.history", "_id": "?", "from": "", "till": "", "detail": 0}` |
| [Positions](#portfolios-positions) | `{"command": "portfolios.positions", "_id": "?", "requestType": "0", "marketPrice": "4", "basePrice": "4"}` |
| [Trades](#portfolios-trades) | `{"command": "portfolios.trades", "_id": "?", "from": ""}` |
| [Put Cash](#portfolios-put-cash) | `{"command": "portfolios.putCash", "portfolioId": "?", "amount": "?", "currency": "?", "rate": "", "description": "", "fee": "", "userId": ""}` |
| [Put Dividends](#portfolios-put-dividends) | `{"command": "portfolios.putDividends", "portfolioId": "_testCashPortfolio2", "tradeId": "t4", "amount": "1", "symbol": "CBK:XETR", "description": "put dividends CBK:XETR", "tradeTime": "2024-01-15T00:00:02"}` |

**Note:** In all portfolio commands using `_id`, can also use portfolio name or portfolio accountId instead. Examples:

Remove with portfolio name:
```json
{"command": "portfolios.remove", "_id": "_testPortfolio"}
```

Portfolio field name usage:
```json
{"command": "portfolios.history", "_id": "$var.pid", "detail": 1, "_as": "history2"}
```

#### Portfolios List

Used filter parameter similar to common list filter parameter. For user with role member available only own portfolios or public portfolios.

#### Portfolios Detail List

Only admin command. Used similar to list, additionally added portfolio user name.

#### Portfolios Add

Add a new portfolio.

**Example 1:**
```json
{"command": "portfolios.add", "name": "_testPortfolio", "description": "", "currency": "USD", "userId": "", "baseInstrument": "SPY"}
```

**Example 2:**
```json
{"command": "portfolios.add", "_id": "65f52f98ab7128acd188b301", "name": "testPortfolioName", "description": "", "currency": "USD", "userId": "", "baseInstrument": "SPY"}
```

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| name | Portfolio name. Must be unique | Yes |
| currency | Portfolio currency value like: USD, DKK... | Yes |
| baseInstrument | Some symbol like: SPY | Yes |
| description | Description | No |
| userId | Automatically assign current user _id | No |
| portfolioIds | Children portfolios _id or names. [child1, 661fb59b6d472d966c0a7521] | No |
| userId | UserId, when not set will be used userId of current logged User. **Basically this field must set only automatically for current user.** | No |

**Successful Response:**
```json
{
  "command": "portfolios.add",
  "msgId": 64,
  "data": {
    "name": "_testPortfolioHistory",
    "currency": "USD",
    "userId": "65dd09760689c3bd1c0ff45a",
    "baseInstrument": "SPY",
    "portfolioIds": [],
    "_id": "661fb59b6d472d966c0a7521"
  }
}
```

#### Portfolios Update

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | Portfolio, can be portfolio fields: _id or name | Yes |
| updated portfolio fields | description, currency, baseInstrument | No |

#### Portfolios Remove

Remove portfolio with all portfolio trades

**Example:**
```json
{"command": "portfolios.remove", "_id": "_testPortfolio"}
```

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | Portfolio, can be portfolio fields: _id or name or accountId | Yes |

**Successful Response:**
```json
{
  "command": "portfolios.remove",
  "msgId": 63,
  "data": {
    "_id": "661fb52d6d472d966c0a747e",
    "name": "_testPortfolioHistory",
    "currency": "USD",
    "userId": "65dd09760689c3bd1c0ff45a",
    "baseInstrument": "SPY",
    "portfolioIds": [],
    "__v": 0
  }
}
```

**Error Response:**
```json
{
  "command": "portfolios.remove",
  "msgId": 1,
  "error": "Can't find record with this _id or name"
}
```

#### Portfolios History

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | Portfolio selection, can be portfolio fields: _id or name | Yes |
| from | Date from trades will be returned. Format YYYY-MM-DD | No |
| till | Date till trades will be returned. Format YYYY-MM-DD. Without will be used all from first | No |
| sample | Output date: not set or 0 - trade dates(default), 'day' or 1 - date step, 'week' or 2 - week step, 'month' or 3 - month step | No |
| detail | 0: show summary result only by trade dates, 1: show summary and trades result | No |

Output contain array with date history result in property 'days', and when detail=1 property 'details' with symbol information. Each day contain nav, cash, invested, investedWithoutTrades, where **nav = cash + invested + investedWithoutTrades**, invested - part invested via trade in this day, investedWithoutTrades - part invested early, but without trade in this day but in current prices, cash - is not invested in symbols yet.

**Response Example:**
```json
{
  "command": "portfolios.history",
  "data": {
    "days": [
      {
        "date": "2024-01-29",
        "invested": 101975.6,
        "investedWithoutTrades": 0,
        "cash": 1083.7146,
        "nav": 103059.3146
      }
    ],
    "details": [
      {
        "symbol": "XLC",
        "operation": "BUY",
        "tradeTime": "2024-01-29T00:00:22",
        "currency": "USD",
        "rate": 1,
        "volume": 24,
        "price": 78.33,
        "fee": 0.93996,
        "cash": -1887.02,
        "newVolume": 646,
        "nav": 48714.160694,
        "invested": 50601.18,
        "investedSymbol": 50601.18,
        "cashChangeSymbol": -1880.86
      }
    ]
  }
}
```

#### Portfolios Positions

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | Portfolio selection, can be portfolio fields _id or name | Yes |
| requestType | 0: Snapshot(default), 1: Subscribe, 2: Unsubscribe | No |
| marketType | 0: bid, 1: offer, 2: last, 3: open, 4: close, 5: high, 6: low, 7: average | No |
| basePrice | 0: bid, 1: offer, 2: last, 3: open, 4: close, 5: high, 6: low, 7: average | No |

#### Portfolios Trades

Return portfolio trades

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| _id | Portfolio selection, can be portfolio fields _id or name | Yes |
| from | Date from trades will be returned. Format YYYY-MM-DD | No |

#### Portfolios Put Cash

Put/Get cash to/from portfolio

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| portfolioId | Portfolio selection, can be used portfolio fields: _id or name or accountId | Yes |
| amount | value in currency | Yes |
| currency | value. Example USD, DKK, EUR... | Yes |
| rate | Cash currency rate. When rate is not set and currency is not portfolio.currency will be used currency rate from server or used from historical date according tradeTime. Rate used for calculate value this currency in base currency | No |
| tradeTime | When not set will be used current time. Format: "tradeTime": "2024-03-05T08:00:00" | No |
| fee | Fee for command in current currency. Fee applied to portfolio currency as -fee*rate | No |
| description | Description | No |
| tradeType | Trade Type: cash\|dividends\|investment\|correction. Default type: cash | No |
| aml | AML | No |
| tradeId | Some external system id | No |

#### Portfolios Put Dividends

Put symbol dividends. To current cash currency will be added value = current_symbol_volume * amount

Put symbol dividends

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| portfolioId | Portfolio selection, can be used portfolio fields: _id or name or accountId | Yes |
| symbol | Symbol | Yes |
| amount | value in currency | Yes |
| currency | value. Example USD, DKK, EUR... | Yes |
| tradeTime | When not set will be used current time. Format: "tradeTime": "2024-03-05T08:00:00" | No |
| fee | Fee for command in current currency. Fee applied to portfolio currency as -fee*rate | No |
| description | Description | No |
| aml | AML | No |
| tradeId | Some external system id | No |

### Trades

#### Available Commands

| Command | Call |
| :------ | :-- |
| Add | `{"command": "trades.add", "portfolioId": "65f52f98ab7128acd188b300", "tradeType": "1", "side": "B", "price": "73.6900", "currency": "USD", "rate": "1.0000", "volume": "575", "fee": "21.185875", "symbol": "XLC", "tradeTime": "2024-01-10T00:00:02"}` |
| Remove all trades in portfolio | `{"command": "trades.removeAll", "portfolioId": "65f52f98ab7128acd188b300"}` |
| Update | - |
| Remove | - |

#### Add Trade

Required fields:

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| portfolioId | Can be used: Portfolio id or name or accountId. Finally this field will contain portfolio id, which detected when used not portfolio id | Yes |
| tradeType | Currently this field for trade must have for trade type '1' | Yes |
| side | Currently this field for trade must contain for buy: **B** or **S** for sell | Yes |
| symbol | Some symbol like **INTC** | Yes |
| volume | Trade Volume | Yes |
| price | Trade Price | Yes |
| currency | Trade Currency | Yes |

Not Required fields (will be set when not filled):

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| userId | Trade userId. Will be used user id for current user | No |
| tradeTime | Trade time YYYY-MM-DDThh:mm:ss | No |
| rate | Trade rate to [portfolio currency] | No |
| fee | Trade fee. Treat as 0 | No |

Additional not required fields:
- description: Trade description
- shares: Trade shares
- tradeId: Trade Id some external information
- tradeSource: Trade Source some external information
- orderId
- accountId
- exchangeTime
- updateTime
- oldTradeId
- aml

#### Remove All Portfolio Trades

Remove all portfolio trades. Portfolio will be fully empty

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| portfolioId | Portfolio ID | Yes |

#### Update

**Note:** For this moment this command works similar to common collection.update

#### Remove

**Note:** For this moment this command works similar to common collection.remove

## Operations

Below in Results present fragments of portfolios.positions cash.

- total - cash in portfolio currency
- totalLocal - cash in symbol currency
- rate - rate to portfolio currency in moment convertation to portfolio currency (now).

### Buy Symbol

Invest in symbol in portfolio currency

**Command:**
```json
{"command": "trades.add", "portfolioId": "tfx1", "tradeType": "1", "state": "1", "side": "B", "price": "400.0", "currency": "DKK", "rate": "0.2", "volume": "1000", "fee": "2", "symbol": "DANSKE:XCSE", "name": "Danske Bank A/S", "tradeTime": "2024-01-15T00:00:08"}
```

Will be invested in symbol in portfolio currency 400000DKK. Commission will be applied to portfolio currency (EUR).

**Cash Result:**
```json
{
  "symbol": "CASH_DKK",
  "total": -53605.72187475291,
  "rate": 0.13401430468688227,
  "totalLocal": -400000
},
{
  "symbol": "CASH_EUR",
  "total": -0.4,
  "rate": 1,
  "totalLocal": -0.4
}
```

### Sell Symbol

Invested money in symbol back to symbol currency cash. Commission will be applied to portfolio currency.

**Command:**
```json
{"command": "trades.add", "portfolioId": "tfx1", "tradeType": "1", "state": "1", "side": "S", "price": "400.0", "currency": "DKK", "rate": "0.2", "volume": "1000", "fee": "2", "symbol": "DANSKE:XCSE", "name": "Danske Bank A/S", "tradeTime": "2024-01-15T00:00:08"}
```

**Cash Result:**
```json
{
  "symbol": "CASH_DKK",
  "total": 53605.72187475291,
  "rate": 0.13401430468688227,
  "totalLocal": 400000
},
{
  "symbol": "CASH_EUR",
  "total": -0.4,
  "rate": 1,
  "totalLocal": -0.4
}
```

### Put Cash

Put money to currency cash

**Command:**
```json
{"command": "portfolios.putInvestment", "portfolioId": "tfx1", "amount": "100000", "shares": "1", "currency": "DKK", "tradeTime": "2024-04-09T00:01:00"}
```

**Cash Result:**
```json
{
  "symbol": "CASH_DKK",
  "total": 13401.430468688228,
  "rate": 0.13401430468688227,
  "totalLocal": 100000
},
{
  "symbol": "CASH_EUR",
  "total": 0,
  "rate": 1,
  "totalLocal": 0
}
```

### Buy FX

Buy EURDKK:FX means that money from DKK cash will be moved to EUR cash. Fee will be applied to portfolio currency. When rate is not set it will be received from historical data for current day in moment creation trade.

**Command:**
```json
{"command": "trades.add", "portfolioId": "tfx1", "tradeType": "1", "state": "1", "side": "B", "price": "10", "rate": "0.1", "volume": "10000", "fee": "0", "symbol": "EURDKK:FX", "tradeTime": "2024-04-19T02:00:15"}
```

**Cash Result:**
```json
{
  "symbol": "CASH_DKK",
  "total": -13401.430468688228,
  "rate": 0.13401430468688227,
  "totalLocal": -100000
},
{
  "symbol": "CASH_EUR",
  "total": 13404.681987324531,
  "rate": 1,
  "totalLocal": 13404.681987324531
}
```

### Sell FX

Sell EURDKK:FX means that money will be added to DKK cash from EUR cash (portfolio base currency). Fee will be applied to portfolio currency. When rate is not set it will be received from historical data for current day in moment creation trade.

**Command:**
```json
{"command": "trades.add", "portfolioId": "tfx1", "tradeType": "1", "state": "1", "side": "S", "price": "10", "volume": "10000", "fee": "20", "symbol": "EURDKK:FX", "tradeTime": "2024-04-19T02:00:15"}
```

**Cash Result:**
```json
{
  "symbol": "CASH_DKK",
  "total": -13401.430468688228,
  "rate": 0.13401430468688227,
  "totalLocal": -100000
},
{
  "symbol": "CASH_EUR",
  "total": 13404.681987324531,
  "rate": 1,
  "totalLocal": 13404.681987324531
}
```

## Tests

### Test Commands and Variables

Execute test commands on the client side, enabling the creation of tests alongside other commands.

Test commands can create and utilize variables with arbitrary values during the execution of the command package. Creating a variable is done using the parameter "_as"="name_variable". Adding this parameter to any command allows creating a variable with the value of the "data" field.

**Example:** Save command output to variable 'response'
```json
{"command": "portfolios.add", "name": "_testErrorInputPortfolio", "_as": "response", "currency": "USD", "baseInstrument": "SPY"}
```

Output:
```json
{
  "command": "portfolios.add",
  "msgId": 16,
  "data": {
    "name": "_testErrorInputPortfolio",
    "currency": "USD",
    "userId": "65dd09760689c3bd1c0ff45a",
    "baseInstrument": "SPY",
    "_id": "6614ea8a5684c7131cd42793"
  }
}
```

Variable with name 'response' will be the object from field "data":
```json
response = {
  "name": "_testErrorInputPortfolio",
  "currency": "USD",
  "userId": "65dd09760689c3bd1c0ff45a",
  "baseInstrument": "SPY",
  "_id": "6614ea8a5684c7131cd42793"
}
```

**Example:** Create variable from list command
```json
{"command": "portfolios.list", "filter": {"name": "_testErrorInputPortfolio"}, "_as": "result"}
```

This creates variable 'result' as an array from field 'data'.

**Access to variable:**
With property 'path' in test commands like tests.check, tests.getVar:

Example:
```json
{"command": "tests.check", "path": "result.0", "conditions": {"name": {"$eq": "_testErrorInputPortfolio"}}, "description": "Check portfolio with requested name"}
```

With $var - root of all variables, can get variable with name 'somename' as $var.somename, for array type used $var.somename.0.fieldname

Example:
```json
{"command": "tests.setVar", "v": {"pid": "$var.result.0._id"}}
```

Variable array property access by index: .1

Variable array property find: [symbol=XLC]

**Example:** Find object in array
```json
{"command": "tests.check", "path": "history1.days.[date=2024-01-24]", "conditions": {"cash": {"$sub": 8}, "nav": {"$sub": 101010}}, "description": "compare 2024-01-24 nav, cash with PS"}
```

### Test Block Commands

This commands contain base test for testing:

- tests_portfolio.add: Tests with portfolio add operations
- tests_portfolio.remove: Tests with portfolio remove operations
- tests_portfolio.history: Tests with portfolio history operations
- tests_portfolio.positions: Tests with portfolio positions operations

#### Available Commands

| Command | Call |
| :------ | :-- |
| [Check](#check) | `{"command": "tests.check", "path": "?", "conditions": {}}` |
| [Set Variable](#set-variable) | `{"command": "tests.setVar", "v": "?"}` |
| [Get Variable](#get-variable) | `{"command": "tests.getVar", "path": "?"}` |
| [Set Output Mode](#set-output-mode) | `{"command": "tests.setMode", "hide": true}` |

#### Check

Check variable defined by path

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| path | Variable by path | Yes |
| conditions | Object which contain conditions for check variable defined by path. Format: {field: {condition: value}}. Conditions: $eq, $gt, $lt, $isArray, $isObject, $absent, $has, $sub | Yes |
| description | Check description | Yes |

#### Set Variable

Add variable object to variables

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| v | Add object v={field:value} to variables as variable with name field and value. Can add multiple variables with v={var1:1, var2:2} | Yes |

#### Get Variable

Get variable (print)

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| path | Get variable by its path | Yes |

#### Set Output Mode

**Parameters:**
| Parameter | Value | Required |
| :-------- | :---- | :------- |
| hide | When true hide non test command output for all next commands | Yes |

### Help Commands

| Command | Call |
| :------ | :-- |
| Break Test sequence | `{"command": "tests.breakTests"}` |
| Wait msg | - |
| Find object in array with minimal field value | - |
