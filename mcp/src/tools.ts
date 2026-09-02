import type { PS2Client } from './client.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (client: PS2Client, args: Record<string, unknown>) => Promise<unknown>;
}

export const tools: ToolDef[] = [

  // ─── PORTFOLIOS ────────────────────────────────────────────────────────────

  {
    name: 'portfolios_list',
    description:
      'List portfolios. Members see own + public portfolios. Admins see all. ' +
      'Pass a filter object to narrow results, e.g. {"name": "MyPortfolio"}.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          description: 'Optional filter, e.g. {"name": "MyPortfolio"} or {} for all',
        },
      },
    },
    handler: async (client, args) =>
      client.send('portfolios.list', { filter: args.filter ?? {} }),
  },

  {
    name: 'portfolios_add',
    description: 'Create a new portfolio.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique portfolio name' },
        currency: { type: 'string', description: 'Base currency, e.g. USD, EUR, DKK' },
        baseInstrument: { type: 'string', description: 'Benchmark symbol, e.g. SPY, OMXC25' },
        description: { type: 'string', description: 'Free-text description' },
        portfolioIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Child portfolio IDs for summation-type portfolios',
        },
        userId: {
          type: 'string',
          description: 'Assign to a specific user (admin only; defaults to current user)',
        },
      },
      required: ['name', 'currency', 'baseInstrument'],
    },
    handler: async (client, args) => client.send('portfolios.add', args),
  },

  {
    name: 'portfolios_update',
    description:
      'Update portfolio metadata. _id accepts MongoDB _id, portfolio name, or accountId.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'Portfolio identifier (MongoDB _id, name, or accountId)',
        },
        name: { type: 'string', description: 'New name' },
        description: { type: 'string', description: 'New description' },
        currency: { type: 'string', description: 'New base currency' },
        baseInstrument: { type: 'string', description: 'New benchmark symbol' },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('portfolios.update', args),
  },

  {
    name: 'portfolios_remove',
    description:
      'Permanently remove a portfolio and all its trades. ' +
      '_id accepts MongoDB _id, name, or accountId.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'Portfolio identifier (MongoDB _id, name, or accountId)',
        },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('portfolios.remove', args),
  },

  {
    name: 'portfolios_history',
    description:
      'Get day-by-day NAV history for a portfolio. ' +
      'Returns an array of {date, nav, cash, invested, investedWithoutTrades} entries. ' +
      'nav = cash + invested + investedWithoutTrades. ' +
      'Set detail=1 to also receive per-trade breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'Portfolio identifier',
        },
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        till: { type: 'string', description: 'End date YYYY-MM-DD' },
        sample: {
          type: 'number',
          description:
            'Sampling step: 0=trade dates only (default), 1=daily, 2=weekly, 3=monthly',
        },
        detail: {
          type: 'number',
          description: '0=summary only (default), 1=summary + per-trade details array',
        },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('portfolios.history', args),
  },

  {
    name: 'portfolios_positions',
    description:
      'Get current positions snapshot for a portfolio. ' +
      'Returns holdings with market value, P&L, weights, and cash buckets per currency. ' +
      'Each cash bucket has symbol CASH_<CURRENCY>, total (portfolio currency), and totalLocal.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'Portfolio identifier',
        },
        marketType: {
          type: 'number',
          description:
            'Price type for current market value: 0=bid, 1=offer, 2=last, 3=open, 4=close (default), 5=high, 6=low, 7=avg',
        },
        basePrice: {
          type: 'number',
          description:
            'Price type for base/cost value: same options as marketType',
        },
      },
      required: ['_id'],
    },
    handler: async (client, args) =>
      client.send('portfolios.positions', { requestType: '0', ...args }),
  },

  {
    name: 'portfolios_trades',
    description: 'Get the trade history for a portfolio, optionally filtered by start date.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: { type: 'string', description: 'Portfolio identifier' },
        from: {
          type: 'string',
          description: 'Only return trades on or after this date YYYY-MM-DD',
        },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('portfolio.trades', args),
  },

  {
    name: 'portfolios_put_cash',
    description:
      'Deposit or withdraw cash. Use a negative amount to withdraw. ' +
      'FX rate is auto-fetched from the price cache when not provided.',
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: {
          type: 'string',
          description: 'Portfolio identifier (_id, name, or accountId)',
        },
        amount: {
          type: 'number',
          description: 'Amount in the given currency. Negative = withdrawal.',
        },
        currency: { type: 'string', description: 'Transaction currency, e.g. USD, EUR, DKK' },
        rate: {
          type: 'number',
          description:
            'FX rate: transaction currency → portfolio currency. ' +
            'Auto-filled from historical data when omitted.',
        },
        tradeTime: {
          type: 'string',
          description: 'ISO datetime, e.g. 2024-03-05T08:00:00. Defaults to now.',
        },
        fee: {
          type: 'number',
          description: 'Fee in transaction currency, applied as -fee*rate to portfolio cash',
        },
        description: { type: 'string' },
        tradeType: {
          type: 'string',
          description: 'cash | dividends | investment | correction (default: cash)',
        },
        aml: { type: 'string', description: 'AML reference string' },
        tradeId: { type: 'string', description: 'External system reference ID' },
      },
      required: ['portfolioId', 'amount', 'currency'],
    },
    handler: async (client, args) => client.send('portfolios.putCash', args),
  },

  {
    name: 'portfolios_put_dividends',
    description:
      'Record a dividend payment for a symbol. ' +
      'Adds current_symbol_volume × amount to the portfolio cash in the given currency.',
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: {
          type: 'string',
          description: 'Portfolio identifier (_id, name, or accountId)',
        },
        symbol: { type: 'string', description: 'Symbol, e.g. AAPL' },
        amount: { type: 'number', description: 'Dividend per share' },
        currency: { type: 'string', description: 'Dividend currency, e.g. USD' },
        tradeTime: {
          type: 'string',
          description: 'ISO datetime, e.g. 2024-03-15T00:00:00. Defaults to now.',
        },
        fee: { type: 'number', description: 'Fee in transaction currency' },
        description: { type: 'string' },
        aml: { type: 'string' },
        tradeId: { type: 'string', description: 'External system reference ID' },
      },
      required: ['portfolioId', 'symbol', 'amount', 'currency'],
    },
    handler: async (client, args) => client.send('portfolios.putDividends', args),
  },

  // ─── TRADES ────────────────────────────────────────────────────────────────

  {
    name: 'trades_list',
    description:
      'List trades using a filter object. Works like any collection list — ' +
      'pass any trade fields to filter by, e.g. {"portfolioId": "..."} or {"symbol": "AAPL"}. ' +
      'Returns all matching trade documents.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          description: 'Filter object with trade fields, e.g. {"portfolioId": "...", "symbol": "AAPL"}. Pass {} for all trades.',
        },
      },
    },
    handler: async (client, args) =>
      client.send('trades.list', { filter: args.filter ?? {} }),
  },

  {
    name: 'trades_add',
    description:
      'Add a buy or sell trade. ' +
      'For equity: use side=B (buy) or S (sell) with a regular symbol like AAPL or DANSKE:XCSE. ' +
      'For FX: use symbol format EURDKK:FX — side=B moves DKK→EUR, side=S moves EUR→DKK. ' +
      'For an option or future: omit symbol and pass `contract` instead — the contract is ' +
      'created/upserted by identity and its own tradable symbol is used automatically. ' +
      'Fee is in the trade currency and is applied as -fee*rate to portfolio cash.',
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: {
          type: 'string',
          description: 'Portfolio identifier (_id, name, or accountId)',
        },
        side: { type: 'string', description: 'B = Buy, S = Sell' },
        symbol: {
          type: 'string',
          description:
            'Symbol, e.g. AAPL, INTC, DANSKE:XCSE, SPY, EURDKK:FX. Omit when `contract` is given.',
        },
        contract: {
          type: 'object',
          description:
            'Option/future spec — provide this instead of `symbol` for a derivative trade. ' +
            'The contract is upserted by identity (underlyingSymbolMic + contractType + ' +
            'strike + expirationDate) and trade.symbol/contractId are set from it automatically.',
          properties: {
            underlyingSymbolMic: {
              type: 'string',
              description: 'Underlying reference, "Symbol-Mic" form, e.g. MSFT:XNAS',
            },
            contractType: {
              type: 'string',
              enum: ['future', 'forward', 'call', 'put'],
              description: 'Direction/kind only — exercise style is set separately via executionStyle.',
            },
            strike: { type: 'number', description: 'Required for call/put, omit for future/forward' },
            expirationDate: { type: 'string', description: 'YYYY-MM-DD' },
            baseContractId: {
              type: 'string',
              description: 'Contract _id to price off of (e.g. an option-on-future\'s underlying future), if not the cash underlying',
            },
            symbol: { type: 'string', description: 'The contract\'s own tradable symbol (e.g. an OCC-style option symbol)' },
            multiplier: { type: 'number', description: 'Contract/lot size. Falls back to the underlying/expiration cascade default if omitted.' },
            market: { type: 'string' },
            feedCode: { type: 'string' },
            provider: { type: 'string' },
            executionStyle: {
              type: 'string',
              enum: ['european', 'american'],
              description: 'Overrides the underlying/expiration default if set.',
            },
            dayCountConvention: {
              type: 'string',
              enum: ['actAct', 'act365', '30/365'],
              description: 'Overrides the underlying/expiration default if set.',
            },
            volatilityOffset: {
              type: 'number',
              description: 'Additive, percentage points, stacked on top of the underlying base vol and any expiration-level offset.',
            },
            rateOffset: {
              type: 'number',
              description: 'Additive, percentage points, stacked on top of the base risk-free rate and any expiration-level offset.',
            },
          },
          required: ['underlyingSymbolMic', 'contractType', 'expirationDate', 'symbol'],
        },
        volume: { type: 'number', description: 'Number of shares/units/contracts' },
        price: { type: 'number', description: 'Price per unit in trade currency' },
        currency: { type: 'string', description: 'Trade currency, e.g. USD, DKK, EUR' },
        rate: {
          type: 'number',
          description:
            'FX rate: trade currency → portfolio currency. Auto-fetched when omitted.',
        },
        fee: {
          type: 'number',
          description: 'Commission/brokerage fee in trade currency (default 0)',
        },
        tradeTime: {
          type: 'string',
          description: 'ISO datetime, e.g. 2024-01-10T00:00:02. Defaults to now.',
        },
        description: { type: 'string' },
        tradeId: { type: 'string', description: 'External reference ID' },
        tradeSource: { type: 'string' },
        orderId: { type: 'string' },
        accountId: { type: 'string' },
        aml: { type: 'string' },
      },
      required: ['portfolioId', 'side', 'volume', 'price', 'currency'],
    },
    handler: async (client, args) =>
      client.send('trades.add', { tradeType: '1', ...args }),
  },

  {
    name: 'trades_remove_all',
    description:
      'Remove ALL trades in a portfolio, leaving it completely empty. This cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        portfolioId: { type: 'string', description: 'Portfolio identifier' },
      },
      required: ['portfolioId'],
    },
    handler: async (client, args) => client.send('trades.removeAll', args),
  },

  {
    name: 'trades_update',
    description: 'Update fields on an existing trade by its MongoDB _id.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: { type: 'string', description: 'Trade MongoDB _id' },
        price: { type: 'number' },
        volume: { type: 'number' },
        fee: { type: 'number' },
        rate: { type: 'number' },
        currency: { type: 'string' },
        tradeTime: { type: 'string', description: 'ISO datetime' },
        description: { type: 'string' },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('trades.update', args),
  },

  {
    name: 'trades_remove',
    description: 'Remove a single trade by its MongoDB _id.',
    inputSchema: {
      type: 'object',
      properties: {
        _id: { type: 'string', description: 'Trade MongoDB _id' },
      },
      required: ['_id'],
    },
    handler: async (client, args) => client.send('trades.remove', args),
  },

  // ─── PRICES ────────────────────────────────────────────────────────────────

  {
    name: 'prices_historical',
    description:
      'Retrieve historical closing prices for one or more symbols. ' +
      'Use "date" for a single day snapshot, or "from"/"till" for a date range. ' +
      'Single-date response: {"AAPL": 186.19, "INTC": 47.25}. ' +
      'Range response: [{date, AAPL, INTC}, ...].',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'string',
          description: 'Comma-separated symbol list, e.g. "AAPL,INTC,SPY"',
        },
        date: {
          type: 'string',
          description: 'Single date YYYY-MM-DD. Use this OR from/till.',
        },
        from: {
          type: 'string',
          description: 'Start date YYYY-MM-DD for a range. Use this OR date.',
        },
        till: {
          type: 'string',
          description: 'End date YYYY-MM-DD. Only used together with from.',
        },
        precision: {
          type: 'number',
          description: 'Decimal places in returned prices (default 4)',
        },
      },
      required: ['symbols'],
    },
    handler: async (client, args) => client.send('prices.historical', args),
  },

  // ─── ANALYTICS ─────────────────────────────────────────────────────────────

  {
    name: 'tools_statistic',
    description:
      'Calculate a full set of financial statistics for a portfolio or a historical price series. ' +
      'Provide either "portfolio" (name or _id) or "history" (symbol) — not both. ' +
      'Returns: returns (total, CAGR, YTD, 1/3/5/10y, MTD, 3m, 6m), ' +
      'daily stats (mean, vol, Sharpe, Sortino, skew, kurt, best/worst day, pos_day_perc, rolling_vol_30d), ' +
      'monthly stats (mean, vol, Sharpe, avg_monthly_return, winning_months_perc, best/worst month), ' +
      'drawdown (max_drawdown, avg_drawdown, max_drawdown_days, calmar, ulcer_index, martin_ratio), ' +
      'risk (VaR 95%, CVaR 95%, gain_to_pain). ' +
      'In portfolio mode the portfolio\'s baseInstrument (default SPY) is used as benchmark and ' +
      'additional benchmark-relative metrics are returned: ' +
      'beta, alpha (annualised Jensen\'s Alpha), correlation, tracking_error, information_ratio, ' +
      'up_capture, down_capture. The "benchmark" field in the response names the instrument used.',
    inputSchema: {
      type: 'object',
      properties: {
        portfolio: {
          type: 'string',
          description: 'Portfolio _id, name, or accountId (use this OR history)',
        },
        history: {
          type: 'string',
          description:
            'Symbol for a historical price series, e.g. STIIAM.CO, AAPL:XNAS (use this OR portfolio)',
        },
        from: {
          type: 'string',
          description: 'Start date YYYY-MM-DD (required when using history)',
        },
        till: { type: 'string', description: 'End date YYYY-MM-DD (defaults to today)' },
      },
    },
    handler: async (client, args) => client.send('tools.statistic', args),
  },

  {
    name: 'tools_theo_price',
    description:
      'Compute a theoretical price for an option or future/forward - not tied to any held ' +
      'position or existing Contract, a standalone "what would this be worth" calculator. ' +
      'Every input beyond underlyingSymbolMic/contractType/expiration/strike is optional and ' +
      'auto-resolved (live spot price, historical realized volatility, risk-free rate, dividend ' +
      'yield, execution style, day-count convention, pricing model) - pass any of them explicitly ' +
      'to override, e.g. for a what-if scenario at a hypothetical spot/vol. Options price via ' +
      'Black-Scholes (European, spot-based), Black-76 (European, future-based - set ' +
      'baseContractId), or a binomial tree (American, either basis). Plain futures/forwards price ' +
      'via cost-of-carry (F = S * e^((r-q)*T)) - no model selection applies to them. The response ' +
      'includes a `resolved` object showing every input actually used, so you can see what was ' +
      'auto-derived, and for options a `greeks` object: delta, gamma, vega (per 1 volatility ' +
      'point), theta (per trading day), rho (per 1 percentage point, plus rhoTenBasis/' +
      'rhoOneBasis for 10bp/1bp), and the second-tier speed, charm and color. Futures/forwards ' +
      'carry no greeks.',
    inputSchema: {
      type: 'object',
      properties: {
        underlyingSymbolMic: {
          type: 'string',
          description: 'Underlying reference, "Symbol-Mic" form, e.g. MSFT:XNAS. Always drives volatility/dividend/currency resolution, even for a future-based option (see baseContractId).',
        },
        contractType: {
          type: 'string',
          enum: ['future', 'forward', 'call', 'put'],
          description: 'Direction/kind only - exercise style is set separately via executionStyle.',
        },
        expirationDate: {
          type: 'string',
          description: 'YYYY-MM-DD. Provide this OR daysToExpiration, not both.',
        },
        daysToExpiration: {
          type: 'number',
          description: 'Alternative to expirationDate: resolves to calcDate + this many days. Use this for anything that should stay valid over time instead of hardcoding a date.',
        },
        strike: { type: 'number', description: 'Required for call/put, omit for future/forward' },
        baseContractId: {
          type: 'string',
          description: 'Existing future/forward Contract _id to price this option off of (an option-on-future) instead of the cash underlying - triggers Black-76/Black-76-American and uses that contract\'s own tradable symbol as the live price driver.',
        },
        executionStyle: {
          type: 'string',
          enum: ['european', 'american'],
          description: 'Overrides the underlying/expiration cascade default (american) if set.',
        },
        dayCountConvention: {
          type: 'string',
          enum: ['actAct', 'act365', '30/365'],
          description: 'Overrides the cascade default (act365) if set. Governs time-to-expiry, not rate compounding (ps2 always discounts continuously).',
        },
        spotPrice: {
          type: 'number',
          description: 'Overrides the auto-fetched last known price of the price-driver symbol (the underlying, or the base future if baseContractId is set).',
        },
        volatility: {
          type: 'number',
          description: 'Percentage points, e.g. 25 for 25%. Full override - if omitted, computed from real historical realized volatility (see volatilityDays), falling back to the underlying\'s vendor-supplied field only if there isn\'t enough price history.',
        },
        volatilityDays: {
          type: 'number',
          description: 'Lookback window in days for the historical-volatility calc when volatility is omitted (default 30).',
        },
        interestRate: {
          type: 'number',
          description: 'Percentage points. Full override - if omitted, resolved from the underlying currency\'s yield curve (defaults to 0 if none seeded).',
        },
        dividendRate: {
          type: 'number',
          description: 'Percentage points, continuous yield. Full override - if omitted, resolved from the underlying\'s Aktia.Symbols document.',
        },
        theoModel: {
          type: 'string',
          enum: ['blackScholes', 'black76', 'black76American', 'bjerksund', 'baroneAdesi', 'geske', 'macMillan', 'americanBinomial', 'euroBinomial'],
          description: 'Overrides automatic model selection (call/put only). Only blackScholes/black76/black76American/americanBinomial/euroBinomial are actually computable today - the rest are reserved for models not yet ported into the native pricing addon.',
        },
        calcDate: {
          type: 'string',
          description: 'YYYY-MM-DD as-of date for the calculation. Defaults to today.',
        },
      },
      required: ['underlyingSymbolMic', 'contractType'],
    },
    handler: async (client, args) => client.send('tools.theoPrice', args),
  },
];
