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
            'Symbol, e.g. AAPL, INTC, DANSKE:XCSE, SPY, EURDKK:FX',
        },
        volume: { type: 'number', description: 'Number of shares/units' },
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
      required: ['portfolioId', 'side', 'symbol', 'volume', 'price', 'currency'],
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
];
