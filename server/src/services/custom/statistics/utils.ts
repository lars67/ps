import * as moment from 'moment';

export type DataPoint = [moment.Moment, number];

function resample(ar: DataPoint[], range: moment.unitOfTime.DurationConstructor): DataPoint[] {
    const rez: DataPoint[] = [];
    let start = ar[0][0];
    let trg = ar[0][0].endOf(range);
    let cur = ar[0][1];
    ar.forEach(([date, val]) => {
        if (date > trg) {
            rez.push([trg, cur]);
            trg = date.endOf(range);
        }
        cur = val;
    });
    rez.push([trg, cur]);

    return rez;
}

function to_returns(price: DataPoint[]): DataPoint[] {
    const rez: DataPoint[] = [];
    for (let i = 1; i < price.length; i++) {
        rez.push([price[i][0], price[i][1] / price[i - 1][1] - 1]);
    }
    return rez;
}

function to_log_returns(price: DataPoint[]): DataPoint[] {
    const rez: DataPoint[] = [];
    for (let i = 1; i < price.length; i++) {
        rez.push([price[i][0], Math.log(price[i][1] / price[i - 1][1])]);
    }
    return rez;
}

function calc_risk_return_ratio(returns: DataPoint[]): number {
    return calc_sharpe(returns);
}

function calc_sharpe(returns: DataPoint[], rf = 0, nperiods?: number, annualize = true): number {
    const er = to_excess_returns(returns, rf, nperiods);
    const res = mean(er) / std(returns, 1);

    if (annualize) {
        if (!nperiods) {
            nperiods = 1;
        }
        return res * Math.sqrt(nperiods);
    } else {
        return res;
    }
}

function letterThen(returns: DataPoint[], val: number): DataPoint[] {
    return returns.map(r => (r[1] < val ? r : [r[0], val]));
}

function calc_sortino_ratio(returns: DataPoint[], rf = 0, nperiods?: number, annualize = true): number {
    const er = to_excess_returns(returns, rf, nperiods);
    const negative_returns = letterThen(returns, 0);
    const res = mean(er) / std(negative_returns, 1);

    if (annualize) {
        if (!nperiods) {
            nperiods = 1;
        }
        return res * Math.sqrt(nperiods);
    } else {
        return res;
    }
}

function std(prices: DataPoint[], ddof = 0): number {
    const nn = prices.length;
    return Math.sqrt(variance_(prices, ddof));
}

function to_excess_returns(returns: DataPoint[], rf: number , nperiods?: number): DataPoint[] {
    let _rf: number;
    if (typeof rf === 'number' && nperiods) {
        _rf = 0;
    } else {
        _rf = rf ;
    }

    return returns.map(r => [r[0], r[1] - _rf]);
}

function variance_(x: DataPoint[], ddof: number): number {
    const nn = x.length;
    const meanX = mean(x);
    let sumSquareDiff = 0.0;
    for (let i = 0; i < nn; ++i) {
        const diff = x[i][1] - meanX;
        sumSquareDiff += diff * diff;
    }
    return sumSquareDiff / (nn - ddof);
}

function mean(x: DataPoint[]): number {
    const nn = x.length;
    let tmpMean = 0.0;
    let sum = 0.0;
    for (let i = 0; i < nn; ++i) {
        sum += x[i][1];
    }
    tmpMean = sum / nn;
    let sumDiff = 0.0;
    for (let i = 0; i < nn; ++i) {
        sumDiff += x[i][1] - tmpMean;
    }
    return (sum + sumDiff) / nn;
}

function deannualize(returns: number , nperiods: number): number {
    return (1 +  returns ) ** (1 / nperiods) - 1;
}

function year_frac(start: moment.Moment, end: moment.Moment): number {
    const delta = moment.duration(end.diff(start)).asSeconds();
    return delta / 31557600;
}

function calc_cagr(prices: DataPoint[]): number {
    const start = prices[0];
    const end = prices[prices.length - 1];
    return Math.pow(end[1] / start[1], 1 / year_frac(start[0], end[0])) - 1;
}

function to_drawdown_series(prices: DataPoint[]): DataPoint[] {
    let prevValue: number;
    let drawdown: DataPoint[]= [...prices].map(p => {
        let ret: number;
        if (p[1]) {
            ret = Number(p[1]);
            prevValue = ret;
        } else {
            ret = prevValue;
        }
        return [p[0], ret];
    });
    let max = drawdown[0][1];
    return drawdown.map(p => {
        if (p[1] > max) {
            max = p[1];
        }
        p[1] = p[1] / max - 1;
        return p;
    });
}

function findMin(price: DataPoint[]): number {
    let min: number= price[0][1];
    price.forEach(([, v]) => {
        if (!min || v < min) {
            min = v;
        }
    });
    return min;
}

function findMax(price: DataPoint[]): number {
    let max: number= price[0][1];
    price.forEach(([, v]) => {
        if (!max || v > max) {
            max = v;
        }
    });
    return max;
}

function positive(price: DataPoint[]): DataPoint[] {
    return price.filter(p => p[1] > 0);
}

function negative(price: DataPoint[]): DataPoint[] {
    return price.filter(p => p[1] < 0);
}

function skewness(arr: DataPoint[]): number {
    if (!Array.isArray(arr)) {
        throw new TypeError('skewness()::invalid input argument. Must provide an array.');
    }
    let len = arr.length,
        delta = 0,
        delta_n = 0,
        term1 = 0,
        N = 0,
        mean = 0,
        M2 = 0,
        M3 = 0,
        g;

    for (let i = 0; i < len; i++) {
        N += 1;
        delta = arr[i][1] - mean;
        delta_n = delta / N;
        term1 = delta * delta_n * (N - 1);
        M3 += term1 * delta_n * (N - 2) - 3 * delta_n * M2;
        M2 += term1;
        mean += delta_n;
    }
    g = (Math.sqrt(N) * M3) / Math.pow(M2, 3 / 2);
    return (Math.sqrt(N * (N - 1)) * g) / (N - 2);
}

function kurt(a: DataPoint[]): number {
    const n = a.length;
    let k = 0.0;
    const m = mean(a);
    const sd = std(a, 0);

    for (let i = 0; i < n; ++i) {
        const z = (a[i][1] - m) / sd;
        k += (z * z * z * z - k) / (i + 1);
    }
    return k - 3.0;
}

function getInterval(dp: DataPoint[], what: moment.unitOfTime.DurationConstructor, n: number): number | undefined {
    const date = dp[dp.length - 1][0].clone().add(n, what);
    const trg = dp.find(d => d[0] >= date);
    return trg ? dp[dp.length - 1][1] / trg[1] - 1 : undefined;
}

function getIntervalFrom(dp: DataPoint[], what: moment.unitOfTime.DurationConstructor, n: number): DataPoint[] {
    const date = dp[dp.length - 1][0].clone().add(n, what);
    return dp.filter(d => d[0] >= date);
}

function drawdown_details(drawdown: DataPoint[]): { days: number, min: number }[] {
    let start: DataPoint | undefined;
    let min :number= drawdown[0][1];
    let prev = drawdown.shift()!;

    const result: { days: number, min: number }[] = [];
    drawdown.forEach(d => {
        if (prev[1] >= 0 && d[1] < 0) {
            start = d;
            min = d[1];
        } else {
            min = Math.min(min, d[1]);
        }
        if (d[1] >= 0 && prev[1] < 0) {
            if (start) {
                const days = Math.round(moment.duration(d[0].diff(start[0])).asDays());
                result.push({ days, min });
                start = undefined;
            }
        }
        prev = d;
    });
    if (start) {
        const days = Math.round(moment.duration(drawdown[drawdown.length - 1][0].diff(start[0])).asDays());
        result.push({ days, min });
    }
    return result;
}

function calculate_rolling_std(data: DataPoint[], window: number): DataPoint[] {
    if (data.length < window) {
        return []; // Not enough data for the window
    }
    const results: DataPoint[] = [];
    for (let i = window - 1; i < data.length; i++) {
        const windowData = data.slice(i - window + 1, i + 1);
        // Calculate std for the window, annualize assuming daily data (252 trading days)
        const windowStd = std(windowData, 1) * Math.sqrt(252);
        results.push([data[i][0], windowStd]);
    }
    return results;
}

function calculate_percentile(data: DataPoint[], percentile: number): number | null {
    if (data.length === 0 || percentile <= 0 || percentile >= 1) {
        return null; // Invalid input
    }
    const sortedValues = data.map(dp => dp[1]).sort((a, b) => a - b);
    const index = Math.floor(percentile * sortedValues.length);
    return sortedValues[index];
}

function calculate_average_below_threshold(data: DataPoint[], threshold: number): number | null {
    const belowThreshold = data.filter(dp => dp[1] < threshold);
    if (belowThreshold.length === 0) {
        return null; // No data points below threshold
    }
    const sum = belowThreshold.reduce((acc, dp) => acc + dp[1], 0);
    return sum / belowThreshold.length;
}


export default {
    resample,
    to_returns,
    to_log_returns,
    mean,
    std,
    to_excess_returns,
    calc_sharpe,
    calc_sortino_ratio,
    calc_cagr,
    to_drawdown_series,
    skewness,
    kurt,
    positive,
    negative,
    findMin,
    findMax,
    getInterval,
    getIntervalFrom,
    drawdown_details,
    // New functions
    calculate_rolling_std,
    calculate_percentile,
    calculate_average_below_threshold
};
function comp(returns: DataPoint[]): number {
  return returns.reduce((acc, val) => acc * (1 + val[1]), 1) - 1;
}

    comp,