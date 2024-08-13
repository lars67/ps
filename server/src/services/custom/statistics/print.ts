import moment from 'moment';

type ResultField = [string | undefined, string | undefined, 'p' | 'n' | 'dt' | undefined];

const resultFields: ResultField[] = [
    ['start', 'Start', 'dt'],
    ['end', 'End', 'dt'],
    ['rf', 'Risk-free rate', 'p'],
    [undefined, undefined, undefined],
    ['total_return', 'Total Return', 'p'],
    ['cagr', 'CAGR', 'p'],
    ['max_drawdown', 'Max Drawdown', 'p'],
    ['calmar', 'Calmar Ratio', 'n'],
    [undefined, undefined, undefined],
    ['mtd', 'MTD', 'p'],
    ['three_month', '3m', 'p'],
    ['six_month', '6m', 'p'],
    ['ytd', 'YTD', 'p'],
    ['one_year', '1Y', 'p'],
    ['three_year', '3Y [ann.]', 'p'],
    ['five_year', '5Y [ann.]', 'p'],
    ['ten_year', '10Y [ann.]', 'p'],
    ['incep', 'Since Incep. [ann.]', 'p'],
    [undefined, undefined, undefined],
    ['daily_sharpe', 'Daily Sharpe', 'n'],
    ['daily_sortino', 'Daily Sortino', 'n'],
    ['daily_mean', 'Daily Mean [ann.]', 'p'],
    ['daily_vol', 'Daily Vol [ann.]', 'p'],
    ['daily_skew', 'Daily Skew', 'n'],
    ['daily_kurt', 'Daily Kurt', 'n'],
    ['best_day', 'Best Day', 'p'],
    ['worst_day', 'Worst Day', 'p'],
    [undefined, undefined, undefined],
    ['monthly_sharpe', 'Monthly Sharpe', 'n'],
    ['monthly_sortino', 'Monthly Sortino', 'n'],
    ['monthly_mean', 'Monthly Mean [ann.]', 'p'],
    ['monthly_vol', 'Monthly Vol [ann.]', 'p'],
    ['monthly_skew', 'Monthly Skew', 'n'],
    ['monthly_kurt', 'Monthly Kurt', 'n'],
    ['best_month', 'Best Month', 'p'],
    ['worst_month', 'Worst Month', 'p'],
    [undefined, undefined, undefined],
    ['yearly_sharpe', 'Yearly Sharpe', 'n'],
    ['yearly_sortino', 'Yearly Sortino', 'n'],
    ['yearly_mean', 'Yearly Mean', 'p'],
    ['yearly_vol', 'Yearly Vol', 'p'],
    ['yearly_skew', 'Yearly Skew', 'n'],
    ['yearly_kurt', 'Yearly Kurt', 'n'],
    ['best_year', 'Best Year', 'p'],
    ['worst_year', 'Worst Year', 'p'],
    [undefined, undefined, undefined],
    ['avg_drawdown', 'Avg. Drawdown', 'p'],
    ['avg_drawdown_days', 'Avg. Drawdown Days', 'n'],
    ['avg_up_month', 'Avg. Up Month', 'p'],
    ['avg_down_month', 'Avg. Down Month', 'p'],
    ['win_year_perc', 'Win Year %', 'p'],
    ['twelve_month_win_perc', 'Win 12m %', 'p']
];

function fmtp(number: number | undefined): string {
    return number ? `${(100 * number).toFixed(2)}%` : '-';
}

function fmtn(number: number | undefined): string {
    return number ? number.toFixed(2) : '-';
}

function fmtd(d: moment.Moment | undefined): string {
    return d ? d.format('YYYY-MM-DD') : '-';
}

const blank = '                 ';

function format(label: string | undefined, value: string | undefined): void {
    console.log(
        `${label}${blank}`.substring(0, 20),
        `${value}${blank}`.substring(0, 15)
    );
}

export function toValue(value: number | moment.Moment | undefined, frt: 'p' | 'n' | 'dt'): string {
    switch (frt) {
        case 'p':
            return fmtp(value as number);
        case 'n':
            return fmtn(value as number);
        case 'dt':
            return fmtd(value as moment.Moment);
    }
}

export function print(stats: Record<string, number | moment.Moment>): void {
    resultFields.forEach(([fld, label, frt]) => {
        if (!fld) {
            console.log('');
        } else {
            switch (frt) {
                case 'p':
                    format(fld, fmtp(stats[fld] as number));
                    break;
                case 'n':
                    format(fld, fmtn(stats[fld] as number));
                    break;
                case 'dt':
                    format(fld, fmtd(stats[fld] as moment.Moment));
                    break;
            }
        }
    });
}
