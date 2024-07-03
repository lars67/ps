import { Trade, TradeSide } from "../../types/trade";
import { ErrorType } from "../../types/other";
import { PortfolioModel } from "../../models/portfolio";
import { CurrencyModel } from "../../models/currency";
import {
  getModelInstanceByIDorName,
  getRealId,
  isErrorType,
  isISODate,
} from "../../utils";
import { TradeModel } from "../../models/trade";
import { sendEvent } from "../../services/app/eventEmiter";
import { Portfolio, PortfolioWithID } from "../../types/portfolio";
import {
  checkPriceCurrency,
  getDateSymbolPrice,
  getRate,
} from "../../services/app/priceCashe";
import moment from "moment";
import { errorMsgs, formatYMD } from "../../constants";
import { UserData } from "../../services/websocket";
import { Model } from "mongoose";

export type PutCash = {
  portfolioId: string;
  amount: string;
  currency: string;
  userId?: string;
  tradeTime?: string;
  tradeType: string;
  rate: number;
  description?: string;
  fee?: number;
  aml?:boolean;
  tradeId?: string;
};

export type PutInvestment = PutCash & {
  shares?: number
};

export async function putSpecialTrade(
  par: PutInvestment,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userId: string,
): Promise<Trade | ErrorType | undefined> {
  let err_required = ["currency", "amount", "portfolioId"].reduce(
    (err, fld) => {
      if (!par[fld as keyof PutCash]) {
        err += `${fld}, `;
      }
      return err;
    },
    "",
  );

  const realId = await getRealId<Portfolio>(par.portfolioId, PortfolioModel);
  if (isErrorType(realId)) {
    return realId;
  } else {
    par.portfolioId = realId;
  }
  const portfolio = await PortfolioModel.findById(par.portfolioId);
  if (!portfolio) {
    return { error: `Unknown portfolio ` };
  }
  if (!(await CurrencyModel.find({ symbol: par.currency }))) {
    return { error: `Unknown currency` };
  }

  if (!par.userId) {
    par.userId = userId;
  }
  if (!par.tradeTime) {
    par.tradeTime = new Date().toISOString();
  } else if (!isISODate(par.tradeTime)) {
    return { error: `Wrong tradeTime format` };
  }
  if (!par.rate) {
    if (portfolio.currency === par.currency) {
      par.rate = 1;
    } else {
      const fx = `${par.currency}${portfolio.currency}`;
      let rate = getDateSymbolPrice(par.tradeTime, fx);
      console.log("fx, rate", fx, rate);
      if (!rate) {
        const leftDate = moment(par.tradeTime.split("T").shift(), formatYMD);
        console.log("leftDate", leftDate.add(-7, "days").format(formatYMD));

        await checkPriceCurrency(
          par.currency,
          portfolio.currency,
          leftDate.add(-7, "days").format(formatYMD),
        );
        rate = getDateSymbolPrice(par.tradeTime, fx);
      }
      if (rate) {
        par.rate = rate;
      } else {
        return {error: `RATE unknown ${fx}`};
      }
    }
  }

  const newTrade = new TradeModel({
    portfolioId: par.portfolioId,
    price: Number(par.amount),
    currency: par.currency,
    userId: par.userId,
    ...(par.tradeId && {tradeId: par.tradeId}) ,
    tradeTime: par.tradeTime,
    tradeType: par.tradeType,
    fee:par.fee || 0,
    ...(par.description && {description: par.description}) ,
    state: 1,
    side: TradeSide.PUT,
    volume: 0,
    contract: "CASH",
    rate: par.rate,
    aml: par.aml
  });
console.log(newTrade);
  const added = await newTrade.save();
  sendEvent("trade.add", added);
  return added;
}

export async function summationFlatPortfolios(portfolio: Portfolio) {
  const portfolioRateMap = {} as Record<string, string[]>;
  let sumPortfolios: Portfolio[] = []; //flat portfolios im all sum
  const portfolioFilterItems: string[] = [];

  console.log("processSumation.portfolio", portfolio);
  const processChilds = async (portfolio: Portfolio, rates: string[] = []) => {
    if (portfolio.portfolioType === "summation" && portfolio.portfolioIds) {
      for (let pid of portfolio.portfolioIds) {
        console.log("pid ", pid);
        const {
          _id: childId,
          error,
          instance,
        } = await getModelInstanceByIDorName<Portfolio>(pid, PortfolioModel);
        if (error) {
          return { error: "Error processing child portfolio" };
        }
        sumPortfolios.push(instance);
        if (instance.portfolioType !== "summation") {
          console.log(
            "SUMNO",
            instance.name,
            instance.currency,
            portfolio.currency,
          );
          portfolioRateMap[childId] = [
            ...rates,
            `${instance.currency}${portfolio.currency}`,
          ];
          portfolioFilterItems.push(childId);
        } else {
          await processChilds(
            instance,
            instance.currency === portfolio.currency
              ? rates
              : [...rates, `${instance.currency}${portfolio.currency}`],
          );
        }
      }
      //} else {
      //  portfolioRateMap[portfolio._id.toString()]= rates;
      //  console.log(portfolio.name, ':',rates);
    }
  };

  await processChilds(portfolio, []);
  console.log(
    "portfolioFilterItems",
    portfolioFilterItems,
    "portfolioRateMap",
    portfolioRateMap,
  );
  return { portfolioFilterItems, portfolioRateMap };
}

export async function fixRate(
  trades: Trade[],
  portfolioRates: Record<string, string[]>,
): Promise<Trade[]> {
  for (let trade of trades) {
    const rates = portfolioRates[trade.portfolioId];
    const rateChange = rates.reduce((s, r) => {
      const c = r.slice(0, 3);
      const pCur = r.slice(3);
      const tCur = trade.currency;
      const t = trade.tradeTime.split("T").shift();
      console.log("fixRate", t, r, getRate(c, pCur, t || "2020-01-01"));
      return s * getRate(c, pCur, t || "2020-01-01"); //TO DO FIX
    }, 1);
    console.log(
      "TTT",
      trade.tradeTime,
      trade.symbol,
      trade.currency,
      trade.price,
      trade.fee,
      trade.rate,
      portfolioRates[trade.portfolioId],
      rateChange,
      ">",
    );
    trade.rate *= rateChange;
  }
  return trades;
}

const portfolioNameCash: Record<string, { name: string; accountId: string }> =
  {};
export async function mapKeyToName(
  portfoliosInvested: Record<
    string,
    { invested: number; investedSymbol: number; fee: number; feeSymbol: number }
  >,
) {
  const ids = Object.keys(portfoliosInvested);
  for (const id of ids) {
    if (!portfolioNameCash[id]) {
      const p = await PortfolioModel.findById(id).lean();
      if (p && p.name) {
        portfolioNameCash[id] = {
          name: p.name,
          accountId: p.accountId as string,
        };
      }
    }
    if (portfolioNameCash[id]) {
      portfoliosInvested[portfolioNameCash[id].name] = portfoliosInvested[id];
      delete portfoliosInvested[id];
    }
  }
  return portfoliosInvested;
}

export function checkAccessByRole(
  portfolio: Portfolio,
  userData: UserData,
): boolean {
  const { userId, role } = userData;
  return (
    portfolio.userId === userId ||
    role === "admin" ||
    portfolio.access === "public"
  );
}

export const getPortfolioInstanceByIDorName = async (
  id: string,
  userData: UserData,
) => {
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getModelInstanceByIDorName<Portfolio>(id, PortfolioModel);

  if (error) {
    return { _id: realId, error, instance: portfolio };
  }

  if (!portfolio) {
    return {
      _id: realId,
      instance: portfolio,
      ...errorMsgs.error(`Portfolio with _id=${realId} does not exist`),
    };
  }

  const accessDenied = !checkAccessByRole(portfolio, userData);
  if (accessDenied) {
    return {
      _id: realId,
      instance: portfolio,
      ...errorMsgs.denied(`portfolio ${portfolio.name}`),
    };
  }

  return { _id: realId, error, instance: portfolio };
};


//
export const calculatePerfomance = (days: any[]) => {

};
