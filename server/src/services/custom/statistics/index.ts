import moment from "moment";
import utils, { DataPoint } from "./utils";
import * as print from "./print";

const data = `3/10/2004,13.84,25.37,492.1
3/11/2004,13.575,25.09,486.2
3/12/2004,13.78,25.38,493.1
3/15/2004,13.225,25.16,491.2
3/16/2004,12.91,25.18,499.9
3/17/2004,13.095,25.13,508.2
3/18/2004,12.835,24.89,512.8
3/19/2004,12.93,24.63,503.4
3/22/2004,12.93,24.5,496.1
3/23/2004,12.645,24.15,498`;

const symbolData: DataPoint[] = data.split("\n").map((row) => {
  const ar = row.split(",");
  const d = ar[0].split("/");
  return [
    moment([Number(d[2]), Number(d[0]) - 1, Number(d[1])]),
    Number(ar[1]),
  ];
});

const resultFields: Record<
  string,
  number | string  | undefined
> = {
  daily_mean: undefined,
  daily_vol: undefined,
  daily_sharpe: undefined,
  daily_sortino: undefined,
  best_day: undefined,
  worst_day: undefined,
  total_return: undefined,
  cagr: undefined,
  incep: undefined,
  drawdown: undefined,
  max_drawdown: undefined,
  drawdown_details: undefined,
  daily_skew: undefined,
  daily_kurt: undefined,
  monthly_returns: undefined,
  avg_drawdown: undefined,
  avg_drawdown_days: undefined,
  monthly_mean: undefined,
  monthly_vol: undefined,
  monthly_sharpe: undefined,
  monthly_sortino: undefined,
  best_month: undefined,
  worst_month: undefined,
  mtd: undefined,
  three_month: undefined,
  pos_month_perc: undefined,
  avg_up_month: undefined,
  avg_down_month: undefined,
  monthly_skew: undefined,
  monthly_kurt: undefined,
  six_month: undefined,
  yearly_returns: undefined,
  ytd: undefined,
  one_year: undefined,
  yearly_mean: undefined,
  yearly_vol: undefined,
  yearly_sharpe: undefined,
  yearly_sortino: undefined,
  best_year: undefined,
  worst_year: undefined,
  three_year: undefined,
  win_year_perc: undefined,
  twelve_month_win_perc: undefined,
  yearly_skew: undefined,
  yearly_kurt: undefined,
  five_year: undefined,
  ten_year: undefined,
  calmar: undefined,
};

function cloneData(ar: DataPoint[]): DataPoint[] {
  return ar.map(([d, v]) => [d.clone(), v]);
}

function fmtp(number: number ): number {
  return Math.round(10000 * number)/100;
}

function fmtn(number: number | undefined): string {
  return number ? number.toFixed(2) : "-";
}

function statistics(
  data: DataPoint[],
  rf: number | DataPoint[],
): Record<string, number | string | undefined> {
  const result = { ...resultFields };
  const daily_prices = [...data];
  const monthly_prices = [...utils.resample(cloneData(data), "M")];
  const yearly_prices = [...utils.resample(cloneData(data), "y")];

  const dp = daily_prices;
  const mp = monthly_prices;
  const yp = yearly_prices;

  if (daily_prices.length === 1) {
    return formatFld(result);
  }

  const returns = utils.to_returns(dp);
  const log_returns = utils.to_log_returns(dp);
  const r = returns;

  if (r.length < 2) {
    return formatFld(result);
  }

  result.daily_mean = utils.mean(r) * 252;
  result.daily_vol = utils.std(r, 1) * Math.sqrt(252);

  if (typeof rf === "number") {
    result.daily_sharpe = utils.calc_sharpe(r, rf, 252);
    result.daily_sortino = utils.calc_sortino_ratio(r, rf, 252);
  } else {
    //   const _rf_daily_price_returns = utils.to_returns(rf);
    //   result.daily_sharpe = utils.calc_sharpe(r, _rf_daily_price_returns, 252);
    //   result.daily_sortino = utils.calc_sortino_ratio(r, _rf_daily_price_returns, 252);
  }

  result.best_day = utils.findMax(r);
  result.worst_day = utils.findMin(r);

  result.total_return = data[data.length - 1][1] / data[0][1] - 1;
  result.ytd = result.total_return;
  result.cagr = utils.calc_cagr(dp);
  result.incep = result.cagr;

  const drawdown = utils.to_drawdown_series(dp);
  result.max_drawdown = utils.findMin(drawdown);
  const drawdown_details = utils.drawdown_details(drawdown);
  if (drawdown_details && drawdown_details.length) {
    result.avg_drawdown =
      drawdown_details.map((d) => d.min).reduce((sum, i) => sum + i, 0) /
      drawdown_details.length;
    result.avg_drawdown_days =
      drawdown_details.map((d) => d.days).reduce((sum, i) => sum + i, 0) /
      drawdown_details.length;
  }

  result.calmar = result.cagr / Math.abs(result.max_drawdown as number);

  if (r.length < 4) {
    return formatFld(result);
  }

  result.daily_skew = utils.skewness(r);
  result.daily_kurt = utils.kurt(r);

  const monthly_returns = utils.to_returns(monthly_prices);
  const mr = monthly_returns;

  if (mr.length < 2) {
    return formatFld(result);
  }

  result.monthly_mean = utils.mean(mr) * 12;
  result.monthly_vol = utils.std(mr, 1) * Math.sqrt(12);
  if (typeof rf === "number") {
    result.monthly_sharpe = utils.calc_sharpe(mr, rf, 12);
    result.monthly_sortino = utils.calc_sortino_ratio(mr, rf, 12);
  }

  result.best_month = utils.findMax(mr);
  result.worst_month = utils.findMin(mr);

  result.mtd = dp[dp.length - 1][1] / mp[mp.length - 2][1] - 1;

  const positive = utils.positive(mr);
  const negative = utils.negative(mr);
  result.pos_month_perc = positive.length / mr.length - 1;
  result.avg_up_month = utils.mean(positive);
  result.avg_down_month = utils.mean(negative);

  if (mr.length < 3) {
    return formatFld(result);
  }

  result.three_month = utils.getInterval(dp, "months", -3);

  if (mr.length < 4) {
    return formatFld(result);
  }

  result.six_month = utils.getInterval(dp, "months", -6);

  result.monthly_skew = utils.skewness(mr);
  result.monthly_kurt = utils.kurt(mr);

  //result.yearly_returns = utils.to_returns(yearly_prices);
  const yr = utils.to_returns(yearly_prices); //result.yearly_returns;

  result.six_month = utils.getInterval(dp, "months", -6);

  if (yr.length < 2) {
    return formatFld(result);
  }

  result.ytd = dp[dp.length - 1][1] / yp[yp.length - 2][1] - 1;
  result.one_year = utils.getInterval(dp, "years", -1);

  result.yearly_mean = utils.mean(yr);
  result.yearly_vol = utils.std(yr, 1);

  if (typeof rf === "number") {
    result.yearly_sharpe = utils.calc_sharpe(yr, rf, 1);
    result.yearly_sortino = utils.calc_sortino_ratio(yr, rf, 1);
  }

  result.best_year = utils.findMax(yr);
  result.worst_year = utils.findMin(yr);

  result.yearly_skew = utils.skewness(yr);
  result.yearly_kurt = utils.kurt(yr);

  result.three_year = utils.calc_cagr(utils.getIntervalFrom(dp, "years", -3));

  result.win_year_perc = utils.positive(yr).length / yr.length;

  if (mr.length > 11) {
    let tot = 0;
    let win = 0;
    for (let i = 11; i < mr.length; i++) {
      tot += 1;
      if (mp[i][1] / mp[i - 11][1] > 1) {
        win++;
      }
    }
    result.twelve_month_win_perc = win / tot;
  }

  if (yr.length < 4) {
    return formatFld(result);
  }

  result.five_year = utils.calc_cagr(utils.getIntervalFrom(dp, "years", -5));
  result.ten_year = utils.calc_cagr(utils.getIntervalFrom(dp, "years", -10));
console.log('-------------------------------------------------------',result);
  return formatFld(result);
}

const percentFields = [
  //"total_return",
  "cagr",
  "max_drawdown",
  "mtd",
  "three_month",
  "six_month",
  "ytd",
  "one_year",
  "three_year",
  "five_year",
  "ten_year",
  "incep",
    "daily_mean",
  "daily_vol",
  "best_day",
  "worst_day",
  "monthly_mean",
  "monthly_vol",
  "best_month",
  "worst_month",
  "yearly_mean",
  "yearly_vol",
  "best_year",
  "worst_year",
  "avg_drawdown",
  "avg_up_month",
  "avg_down_month",
  "win_year_perc",
  "twelve_month_win_perc",
];
function formatFld(
  result: Record<string, number | string | undefined>,
): Record<string, string | number | undefined> {
  const result2: Record<string, string | number | undefined> = { ...result };
  percentFields.forEach((fld) => {
    if (result2[fld]) {
      console.log(fld, result2[fld], fmtp(result2[fld] as number));
      result2[fld] = fmtp(result2[fld] as number);
    }
  });
  return result2;
}
export default {
  statistics,
};

//print.print(res as Record<string, number|moment.Moment>);
