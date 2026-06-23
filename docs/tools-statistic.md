# tools.statistic

Computes a comprehensive set of financial statistics for a time series. The data source is either a price symbol (`history`) or a portfolio (`portfolio`) — one must be provided.

In portfolio mode the portfolio's `baseInstrument` (default `SPY`) is used automatically as the benchmark, and benchmark-relative metrics (Beta, Alpha, Correlation, etc.) are included in the response.

## Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `command` | string | yes | `"tools.statistic"` |
| `history` | string | one of | Price symbol to analyse (e.g. `"STIIAM.CO"`, `"AAPL:XNAS"`) |
| `portfolio` | string | one of | Portfolio ID or name |
| `from` | string | yes (for `history`) | Start date — `YYYY-MM-DD` or ISO format |
| `till` | string | no | End date — defaults to today |
| `msgId` | string | yes | WebSocket message ID |

## Examples

### Symbol (history mode)

```json
{
  "command": "tools.statistic",
  "history": "STIIAM.CO",
  "from": "2024-01-01",
  "msgId": "stat-1"
}
```

Response includes all single-series metrics. No benchmark fields.

### Portfolio mode

```json
{
  "command": "tools.statistic",
  "portfolio": "69dbf8672a9c23ba6ab4fb4b",
  "msgId": "stat-2"
}
```

Response includes all single-series metrics **plus** benchmark-relative metrics. The `benchmark` field in the response tells you which instrument was used (e.g. `"SPY"`).

## Response structure

```json
{
  "command": "tools.statistic",
  "msgId": "stat-1",
  "data": {
    "benchmark": "SPY",
    "statistic": { ... }
  }
}
```

`benchmark` is only present in portfolio mode.

## Output Fields

All percentage fields are expressed as `xx.xx` (e.g. `17.39` = 17.39%). Ratio fields are raw numbers. Fields return `null` when there is insufficient data.

### Returns

| Field | Description |
|---|---|
| `total_return` | Total return since `from` date / portfolio start |
| `cagr` | Compound annual growth rate |
| `incep` | Return since inception (same as `total_return`) |
| `startDate` | Actual first date found in the price series |
| `ytd` | Year-to-date return |
| `one_year` | Trailing 1-year return |
| `three_year` | 3-year CAGR |
| `five_year` | 5-year CAGR |
| `ten_year` | 10-year CAGR |

### Daily

| Field | Description |
|---|---|
| `daily_mean` | Annualised mean daily return |
| `daily_vol` | Annualised daily volatility |
| `daily_sharpe` | Annualised Sharpe ratio (rf = 0) |
| `daily_sortino` | Annualised Sortino ratio (rf = 0) |
| `daily_skew` | Skewness of daily returns |
| `daily_kurt` | Excess kurtosis of daily returns |
| `best_day` | Best single day return |
| `worst_day` | Worst single day return |
| `pos_day_perc` | Percentage of positive trading days |
| `rolling_vol_30d` | Latest 30-day rolling annualised volatility |

### Monthly

| Field | Description |
|---|---|
| `monthly_mean` | Annualised mean monthly return |
| `avg_monthly_return` | Simple (non-annualised) average monthly return |
| `monthly_vol` | Annualised monthly volatility |
| `monthly_sharpe` | Monthly Sharpe ratio |
| `monthly_sortino` | Monthly Sortino ratio |
| `monthly_skew` | Skewness of monthly returns |
| `monthly_kurt` | Excess kurtosis of monthly returns |
| `best_month` | Best single month return |
| `worst_month` | Worst single month return |
| `mtd` | Month-to-date return |
| `three_month` | Trailing 3-month return |
| `six_month` | Trailing 6-month return |
| `winning_months_perc` | Percentage of months with positive return |
| `pos_month_perc` | Fraction of positive months (alternative calculation) |
| `avg_up_month` | Average return of positive months |
| `avg_down_month` | Average return of negative months |

### Yearly

| Field | Description |
|---|---|
| `yearly_mean` | Mean annual return |
| `yearly_vol` | Annual return volatility |
| `yearly_sharpe` | Yearly Sharpe ratio |
| `yearly_sortino` | Yearly Sortino ratio |
| `yearly_skew` | Skewness of yearly returns |
| `yearly_kurt` | Excess kurtosis of yearly returns |
| `best_year` | Best single year return |
| `worst_year` | Worst single year return |
| `win_year_perc` | Fraction of positive years |
| `twelve_month_win_perc` | Fraction of rolling 12-month windows with positive return |

### Drawdown

| Field | Description |
|---|---|
| `max_drawdown` | Maximum peak-to-trough drawdown |
| `avg_drawdown` | Average drawdown across all drawdown periods |
| `avg_drawdown_days` | Average duration of drawdown periods (days) |
| `max_drawdown_days` | Duration of the single longest drawdown period (days) |
| `calmar` | CAGR divided by absolute max drawdown |

### Risk

| Field | Description |
|---|---|
| `var_95` | Historical Value at Risk at 95% confidence (5th percentile of daily returns) |
| `cvar_95` | Conditional VaR — expected loss on days beyond the VaR threshold |
| `ulcer_index` | Depth + duration of drawdowns combined — more sensitive than max drawdown alone |
| `martin_ratio` | CAGR divided by Ulcer Index — risk-adjusted return accounting for drawdown duration |
| `gain_to_pain` | Sum of all positive daily returns divided by sum of absolute negative returns |

### Benchmark-relative *(portfolio mode only)*

These fields are present only when using `portfolio` mode. The benchmark is taken from the portfolio's `baseInstrument` field (default `SPY`).

| Field | Type | Description |
|---|---|---|
| `beta` | ratio | Portfolio return per 1% benchmark move |
| `alpha` | % | Annualised Jensen's Alpha — excess return above what beta predicts |
| `correlation` | ratio | Pearson correlation of daily returns with benchmark (-1 to 1) |
| `tracking_error` | % | Annualised standard deviation of active returns (portfolio minus benchmark) |
| `information_ratio` | ratio | Annualised active return divided by tracking error |
| `up_capture` | ratio | Portfolio mean return on up-benchmark days / benchmark mean on those days |
| `down_capture` | ratio | Portfolio mean return on down-benchmark days / benchmark mean on those days |

A `down_capture` below 1.0 and `up_capture` above 1.0 is the ideal pattern (more upside, less downside than benchmark).
