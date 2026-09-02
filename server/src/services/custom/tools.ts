import { CommandDescription } from "../../types/custom";
import utils, { CashFlow, DataPoint } from "./statistics/utils";
import moment from "moment";
import statistics from "./statistics";
import { TradeModel } from "../../models/trade";
import { TradeTypes, TradeSide } from "../../types/trade";
import {
  getPortfolioInstanceByIDorName,
  PutCash,
  putSpecialTrade,
} from "../../services/portfolio/helper";
import { UserData } from "../../services/websocket";

import { checkPrices, getDatesSymbols } from "../../services/app/priceCashe";
import { errorMsgs, formatYMD } from "../../constants";
import { isValidDateFormat } from "../../utils";
import {
  DayType,
} from "../../services/portfolio/portfolioCalculator";
import {
  history as historyService,
} from "../../services/portfolio/history";
import { getTheoPrice, GetTheoPriceParams } from "../../services/derivatives/getTheoPrice";

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

type StatisticsData = {
  portfolio?: string;
  history?: string;
  data?: { date: string; value: string }[];
  from?: string;
  till?: string;
};

export async function statistic(
  { history, portfolio, from, till }: StatisticsData,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
) {
  if (!history && !portfolio) {
    return errorMsgs.error('Need set history or portfolio')
  }
  if (from) {
    if (!isValidDateFormat(from)) {
      return  errorMsgs.error("Wrong 'from'" );
    }
    from = `${from.split("T")[0]}T00:00:00`;
  } else if (history) {
    return { error: "Please set 'from'" };
  }
  if (till) {
    if (!isValidDateFormat(till)) {
      return { error: "Wrong 'till'" };
    }
    till = `${till.split("T")[0]}T23:59:59`;
  } else {
    till = moment().format(`${formatYMD}T23:59:59`);
  }
  try {
    if (history) {
      const dateShift = moment(from, formatYMD)
        .add(-7, "day")
        .format(formatYMD);
      await checkPrices([history], dateShift);
      const prices = getDatesSymbols([history], from as string, till)
        .map((p) => [
          moment(p.date, formatYMD),
          Number(p[history] as keyof number),
        ])
        .filter((p) => p[1]) as DataPoint[];
      const statistic = statistics.statistics(prices, 0);
      return { statistic };
    } else if (portfolio) {
      const {
        _id: realId,
        error,
        instance,
      } = await getPortfolioInstanceByIDorName(portfolio, userData);
      if (error) {
        return error;
      }
      if (!instance) {
        return { error: `Portfolio with _id=${realId} is not exists` };
      }
      // Use a no-op sendResponse so the intermediate history payload is not
      // sent to the client under this msgId before the statistic is ready.
      let capturedDays: DayType[] = [];
      const captureResponse = (data: any) => {
        if (data?.days) capturedDays = data.days;
      };

      const h = await historyService(
        { _id: realId, detail: "0", sample: "1", precision: 2 },
        captureResponse,
        `__stat_internal_${msgId}`,
        userModif,
        userData,
      ) as any;

      let rawDays: DayType[];
      if (h?.done) {
        rawDays = capturedDays;
      } else if (h?.update) {
        rawDays = [...capturedDays, ...(h.days || [])];
      } else {
        rawDays = h?.days || [];
      }

      const days = rawDays.filter((p) => p.navShare && p.index);
      const prices = days.map(
        (p) => [moment(p.date, formatYMD), Number(p.navShare)],
      ) as DataPoint[];
      const benchmarkPrices = days.map(
        (p) => [moment(p.date, formatYMD), Number(p.index)],
      ) as DataPoint[];
      const statistic = statistics.statistics(prices, 0, benchmarkPrices);

      // Money-weighted annual return (IRR): actual funding flows + terminal NAV.
      // Deposits/withdrawals (Investment + Cash trades) are external investor
      // flows; dividends and P&L stay internal to the NAV.
      const lastDay = days[days.length - 1];
      if (lastDay && Number(lastDay.nav) > 0) {
        const moneyTrades = await TradeModel.find({
          portfolioId: realId,
          tradeType: { $in: [TradeTypes.Investment, TradeTypes.Cash] },
        }).lean();
        const flows: CashFlow[] = moneyTrades
          .filter((t) => t.tradeTime && t.tradeTime.split("T")[0] <= lastDay.date)
          .map((t) => {
            const amount = t.price * (t.rate || 1) + (t.fee || 0) * (t.rate || 1);
            const signed =
              t.tradeType === TradeTypes.Cash && t.side === TradeSide.WITHDRAW
                ? -amount
                : amount; // Investment amounts carry their own sign
            // investor perspective: money paid in is negative
            return { date: moment(t.tradeTime.split("T")[0], formatYMD), amount: -signed };
          });
        if (flows.length) {
          flows.push({ date: moment(lastDay.date, formatYMD), amount: Number(lastDay.nav) });
          flows.sort((a, b) => a.date.valueOf() - b.date.valueOf());
          const irr = utils.calc_xirr(flows);
          if (irr !== undefined && isFinite(irr)) {
            statistic.irr = Math.round(10000 * irr) / 100;
          }
        }
      }

      return { statistic, benchmark: instance.baseInstrument };
    }
  } catch (err) {
    return errorMsgs.failed("tools.statistic");
  }
}

export async function theoPrice(
  params: GetTheoPriceParams,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
) {
  try {
    return await getTheoPrice(params);
  } catch (err) {
    return errorMsgs.failed("tools.theoPrice");
  }
}

export const description: CommandDescription = {
  statistic: {
    label: "Statistic",
    access: "public",
    value: JSON.stringify({
      command: "tools.statistic",
      history: "",
      portfolio: "",
      from: "",
      till: "",
    }),
  },
  // ── tools.theoPrice samples ────────────────────────────────────────────────────────────────
  //
  // Six console samples for one command, covering the shapes the calculator actually supports:
  // auto-resolve, manual what-if, plain future, option-on-future, and two for the greeks (one
  // explaining what each greek means and in which units, one firing several calculations at
  // once so the results pane shows the greeks side by side across strikes and exercise styles).
  // Only the first key (`theoPrice`) is the real handler name - the rest are **sample-only
  // aliases**: what
  // gets sent is their `value`'s own `"command": "tools.theoPrice"`, not the key. This is a
  // deliberate deviation from this file's usual 1:1 key-to-handler convention, because there's no
  // other way to offer more than one preset per command today (`extended` exists on the type but
  // react/src/components/CommandBar renders a dead button and ignores its contents).
  // Side effect, checked and harmless: services/command.ts's getMemberAccessAlowedCommands()
  // derives its allowlist from these keys, so `tools.theopricewhatif` & co. become "allowed"
  // names. Nothing is reachable through them - controllers/websocket.ts finds no matching handler
  // and returns "Command unknown" - and the real command is public anyway.
  //
  // Every sample uses `daysToExpiration` rather than an absolute `expirationDate` so these presets
  // don't quietly expire (a hardcoded date would start returning "already expired" once it passed).
  //
  // The explanatory lines are part of the sample text itself: getCommands()
  // (react/src/utils/command.ts) only extracts balanced {...} objects that carry a "command" key,
  // so any prose outside the braces is ignored and travels with the sample into the editor.
  theoPrice: {
    label: "Theo Price - option, auto-resolve everything",
    access: "public",
    value: [
      "# What is a 400-strike MSFT call worth, 90 days out?",
      "# Minimal form - only the contract identity is given. Spot price, volatility (real",
      "# realized vol from price history), interest rate, dividend yield, execution style,",
      "# day-count convention and the pricing model are all resolved automatically.",
      "# The reply carries a `resolved` block showing every input that was actually used.",
      "# daysToExpiration is relative to today, so this sample never goes stale.",
      JSON.stringify({
        command: "tools.theoPrice",
        underlyingSymbolMic: "MSFT:XNAS",
        contractType: "call",
        strike: 400,
        daysToExpiration: 90,
      }),
    ].join("\n"),
  },
  theoPriceWhatIf: {
    label: "Theo Price - option, manual what-if scenario",
    access: "public",
    value: [
      "# Same command, but every pricing input is given by hand, so nothing is read from",
      "# live market data - this is how you ask 'what would it be worth at this spot and",
      "# this volatility'. Override only the fields you care about; the rest still resolve.",
      "# volatility / interestRate / dividendRate are percentage points (25 = 25%).",
      "# executionStyle european -> Black-Scholes. Change it to american (or leave it out,",
      "# american is the default) to price on the binomial tree instead.",
      JSON.stringify({
        command: "tools.theoPrice",
        underlyingSymbolMic: "MSFT:XNAS",
        contractType: "put",
        strike: 400,
        daysToExpiration: 90,
        spotPrice: 400,
        volatility: 25,
        interestRate: 4.5,
        dividendRate: 1,
        executionStyle: "european",
        dayCountConvention: "act365",
      }),
    ].join("\n"),
  },
  theoPriceFuture: {
    label: "Theo Price - plain future (cost of carry)",
    access: "public",
    value: [
      "# A plain future or forward is priced by cost of carry, F = S * e^((r-q)*T), not by",
      "# any of the option models - so there is no strike, no executionStyle and no",
      "# theoModel in the reply. Set contractType to forward for the same calculation.",
      "# Drop spotPrice / interestRate / dividendRate to have them resolved from live data.",
      JSON.stringify({
        command: "tools.theoPrice",
        underlyingSymbolMic: "SPY:ARCX",
        contractType: "future",
        daysToExpiration: 30,
        spotPrice: 4500,
        interestRate: 4.25,
        dividendRate: 1.3,
      }),
    ].join("\n"),
  },
  theoPriceGreeks: {
    label: "Theo Price - greeks explained",
    access: "public",
    value: [
      "# Every option reply carries a `greeks` block alongside theoPrice - no extra flag needed.",
      "# A plain future/forward has none (it is priced by cost of carry, not an option model).",
      "#",
      "#   delta  price change per 1.00 move in the underlying. Call 0..1, put -1..0.",
      "#   gamma  delta change per 1.00 move in the underlying - i.e. how fast delta shifts.",
      "#   vega   price change per 1 percentage point of volatility (22 -> 23).",
      "#   theta  price given up over one trading day (Friday's covers the weekend).",
      "#   rho    price change per 1 percentage point of interest rate.",
      "#          rhoTenBasis / rhoOneBasis are the same for a 10bp and a 1bp move.",
      "#",
      "# Second-tier, all third-order or day-over-day differences:",
      "#   speed  gamma change per 1.00 move in the underlying.",
      "#   charm  delta change over one trading day.",
      "#   color  gamma change over one trading day.",
      "#",
      "# Delta and gamma are closed form for european contracts and read off the tree for",
      "# american ones; the rest are finite-difference bumps of the price.",
      "# Change executionStyle to american below to see the tree values instead.",
      JSON.stringify({
        command: "tools.theoPrice",
        underlyingSymbolMic: "MSFT:XNAS",
        contractType: "call",
        strike: 100,
        daysToExpiration: 182,
        spotPrice: 100,
        volatility: 22,
        interestRate: 4.5,
        dividendRate: 1.2,
        executionStyle: "european",
      }),
    ].join("\n"),
  },
  theoPriceGreeksCompare: {
    label: "Theo Price - greeks, compare strikes and exercise styles",
    access: "public",
    value: [
      "# Sends several calculations in one go - the console runs every {...} in the buffer, so",
      "# the results pane gives you the greeks side by side. Same underlying, same 182 days,",
      "# same 22 vol throughout; only the strike and the exercise style change.",
      "#",
      "# 1-3: ITM / ATM / OTM european calls. What to look for:",
      "#      delta falls as the strike rises (0.94 -> 0.57 -> 0.16),",
      "#      gamma and vega both peak at the money and fall off either side,",
      "#      theta is most negative at the money - the ATM option has the most time value to lose.",
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"call","strike":80,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"european"}',
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"call","strike":100,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"european"}',
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"call","strike":120,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"european"}',
      "",
      "# 4-5: the same ATM put european vs american. The american is worth more (early exercise",
      "#      has value), its delta is more negative, and its greeks come from the binomial tree",
      "#      rather than a closed-form expression - a good check that the tree path is sane.",
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"put","strike":100,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"european"}',
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"put","strike":100,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"american"}',
      "",
      "# 6: a call and put on the same strike - gamma and vega should come back identical, and",
      "#    delta(call) - delta(put) should equal exp(-dividendRate*T). Put-call parity is the",
      "#    easiest way to sanity-check greeks by eye.",
      '{"command":"tools.theoPrice","underlyingSymbolMic":"MSFT:XNAS","contractType":"call","strike":100,"daysToExpiration":182,"spotPrice":100,"volatility":22,"interestRate":4.5,"dividendRate":1.2,"executionStyle":"european"}',
    ].join("\n"),
  },
  theoPriceOnFuture: {
    label: "Theo Price - option on a future (Black-76)",
    access: "public",
    value: [
      "# An option on a future. baseContractId points at an existing future/forward Contract,",
      "# and the option is then priced off THAT future's own price (Black-76 for european,",
      "# Black-76-American for american) instead of the cash underlying.",
      "# So spotPrice here is the FUTURE's price, not the share price. underlyingSymbolMic",
      "# is still what drives volatility / dividend / currency resolution.",
      "# Replace the \"?\" with a real future contract _id before sending.",
      JSON.stringify({
        command: "tools.theoPrice",
        underlyingSymbolMic: "SPY:ARCX",
        contractType: "call",
        strike: 6300,
        daysToExpiration: 90,
        baseContractId: "?",
        spotPrice: 6250,
        volatility: 18,
        interestRate: 4,
        executionStyle: "european",
      }),
    ].join("\n"),
  },
};
