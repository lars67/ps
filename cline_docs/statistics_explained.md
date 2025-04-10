# Understanding Your Portfolio Statistics

This document explains the different statistics calculated for your portfolio to help you understand its performance and risk. All returns and risk metrics are based on the historical data for the selected period.

## Overall Performance

*   **Total Return (`total_return`)**: The total percentage gain or loss of your portfolio over the entire selected time period. A value of 16.61 means your portfolio grew by 16.61% overall.
*   **Inception Return (`incep`)**: Similar to Total Return, this shows the overall percentage gain or loss since the very beginning of the data period you selected.
*   **CAGR (Compound Annual Growth Rate) (`cagr`)**: This tells you the average *annual* growth rate your portfolio achieved, assuming profits were reinvested. A CAGR of 79.47 means that, on average, the portfolio grew at a rate equivalent to 79.47% per year during the period. (Note: For periods shorter than a year, this number extrapolates the growth).

## Period-Specific Returns

These show performance over common timeframes ending on the last date of your data:

*   **MTD (Month to Date)**: Percentage gain or loss since the beginning of the current month.
*   **Three Month (`three_month`)**: Percentage gain or loss over the last 3 months.
*   **Six Month (`six_month`)**: Percentage gain or loss over the last 6 months.
*   **YTD (Year to Date)**: Percentage gain or loss since the beginning of the current calendar year (January 1st).
*   **(Future: One Year, Three Year, Five Year, Ten Year)**: Average annual return (CAGR) if the period included at least that many years.

## Risk Metrics

These metrics help you understand the potential downside and volatility (ups and downs) of your portfolio:

*   **Daily Volatility (`daily_vol`)**: A measure of how much the portfolio's value tends to fluctuate daily, expressed as an annualized percentage. A higher number means more daily ups and downs (higher risk). 8.37 suggests moderate daily fluctuation when annualized.
*   **Rolling Volatility 30d (`rolling_vol_30d`)**: Similar to Daily Volatility, but calculated only over the *last 30 trading days*. This shows the recent level of fluctuation. 10.95 indicates slightly higher recent volatility compared to the overall average.
*   **Max Drawdown (`max_drawdown`)**: The largest single drop in percentage from a peak value to a subsequent low point during the period. -3.41 means the biggest loss experienced from a high point was 3.41%.
*   **Average Drawdown (`avg_drawdown`)**: The average size of all the temporary dips (drawdowns) the portfolio experienced. -0.83 indicates the typical dip was less than 1%.
*   **Average Drawdown Days (`avg_drawdown_days`)**: How long, on average, it took for the portfolio to recover from a temporary dip back to its previous peak. 4.7 means recovery typically took about 4-5 days.
*   **VaR 95% (`var_95`)**: Estimates the "reasonable worst-case" loss for a single day. -0.63 means that 95% of the time (19 out of 20 days), you wouldn't expect to lose *more* than 0.63% in one day, based on past performance.
*   **CVaR 95% (`cvar_95`)**: Looks at the worst 5% of days (when losses exceeded the VaR). -1.30 means that *on those particularly bad days*, the average loss was around 1.30%.

## Return Distribution & Consistency

*   **Best Day (`best_day`) / Worst Day (`worst_day`)**: The highest and lowest single-day percentage change during the period. (1.26% and -2.14%).
*   **Best Month (`best_month`) / Worst Month (`worst_month`)**: The highest and lowest percentage change in any single calendar month during the period. (10.58% and 0.49% - note: if the worst month is positive, it means there were no losing months).
*   **Average Up Month (`avg_up_month`)**: The average percentage gain during the months where the portfolio value increased. (3.85%).
*   **Average Down Month (`avg_down_month`)**: The average percentage loss during the months where the portfolio value decreased. (`null` or `-` means there were no losing months in the period).
*   **Daily Skew (`daily_skew`)**: Measures if returns are skewed towards large gains or large losses. Negative skew (-1.00) suggests a tendency towards more frequent small gains and occasional larger losses compared to a normal distribution.
*   **Daily Kurtosis (`daily_kurt`)**: Measures the "tailedness" of returns (how often extreme gains/losses occur). Positive kurtosis (4.05) indicates that extreme results (both positive and negative) happen more often than in a perfect bell curve.

## Risk-Adjusted Returns

These metrics compare returns to the risk taken:

*   **Daily Sharpe (`daily_sharpe`)**: Measures return per unit of risk (volatility), assuming a risk-free rate of 0. Higher is generally better. (4.86).
*   **Daily Sortino (`daily_sortino`)**: Similar to Sharpe, but only considers downside volatility (risk of losses). Higher is generally better. (8.18).
*   **Calmar Ratio (`calmar`)**: Compares the annualized return (CAGR) to the maximum drawdown. Higher means better returns relative to the largest experienced loss. (23.29).

*(Note: Monthly and Yearly Sharpe/Sortino are also calculated but follow the same principle as the daily versions, just based on less frequent data).*