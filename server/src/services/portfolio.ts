import { Portfolio, PortfolioWithID } from "@/types/portfolio";
import { PortfolioModel } from "../models/portfolio";
import { FilterQuery } from "mongoose";
import { CommandDescription } from "@/types/custom";
import {
  checkCurrency,
  checkUnique,
  getRealId,
  isErrorType,
  validateRequired,
} from "../utils";

import { errorMsgs } from "../constants";
import { ErrorType } from "../types/other";
import {
  convertMoneyTypeToTradeType,
  MoneyTypes,
  Trade,
  TradeTypes,
} from "../types/trade";

import {
  getPortfolioInstanceByIDorName,
  PutCash,
  PutDividends,
  PutInvestment,
  putSpecialTrade,
} from "../services/portfolio/helper";
import { TradeModel } from "../models/trade";
import { getPortfolioTrades } from "../utils/portfolio";
import { UserData } from "@/services/websocket";
import { generateAccountID } from "../utils/idGenerator";

export { history } from "./portfolio/history"; // Use the updated history file
export { positions } from "./portfolio/positions";
export { debug } from "./portfolio/debug";
// Removed export for historyV2 as it's now integrated into history.ts

export const validationsAddRequired: string[] = [
  "name",
  "currency",
  "baseInstrument",
];

export async function list(
  filter: FilterQuery<Portfolio> = {},
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<Portfolio[] | null> {
  try {
    if (userData.role !== "admin") {
      filter = {
        ...filter?.filter,
        $or: [{ access: "public" }, { userId: userData.userId }],
      };
    } else {
      filter = filter?.filter;
    }
    console.log("filter", filter, userData.role);
    const portfolios = await PortfolioModel.find(filter).lean();
    return portfolios;
  } catch (err) {}
  return [];
}

export async function add(
  portfolio: Portfolio,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<Portfolio | ErrorType | null> {
  let err_required = validateRequired<Portfolio>(
    validationsAddRequired,
    portfolio,
  );
  if (err_required) {
    return errorMsgs.required(err_required);
  }
  let error = await checkUnique<Portfolio>(
    PortfolioModel,
    portfolio.name,
    "name",
  );
  if (error) return error;
  error = await checkCurrency(portfolio.currency);
  if (error) return error;

  if (!portfolio.userId || userData.role !== "admin") {
    portfolio.userId = userData.userId;
  }
  portfolio.accountId = generateAccountID();

  const newPortfolio = new PortfolioModel(portfolio);
  const added = await newPortfolio.save();
  return added;
}

export async function update(
  Portfolio: Partial<PortfolioWithID>,
): Promise<Portfolio | ErrorType | null> {
  const { _id, accountId, userId, ...other } = Portfolio;
  if (other.currency) {
    return errorMsgs.notAllowed("change currency");
  }
  if (!_id) {
    return errorMsgs.required1("_id");
  }
  const realId = await getRealId<Portfolio>(_id as string, PortfolioModel);
  if (isErrorType(realId)) {
    return realId;
  }
  return await PortfolioModel.findByIdAndUpdate(realId, other, { new: true });
}

export async function remove({
  _id,
}: {
  _id: string;
}): Promise<Portfolio | ErrorType | null> {
  if (!_id) {
    return errorMsgs.required1("_id");
  }
  const realId = await getRealId<Portfolio>(_id as string, PortfolioModel);
  console.log("realId", realId, typeof realId, isErrorType(realId));
  if (isErrorType(realId)) {
    return realId; //error mean
  }
  try {
    const result = await PortfolioModel.findByIdAndDelete(realId);
    if (result) {
      const result2 = await TradeModel.deleteMany({
        portfolioId: realId.toString(),
      });
      console.log("result2", result2);
      return result;
    } else {
      return errorMsgs.notExists(realId);
    }
  } catch (err) {
    return errorMsgs.failed("portfolio remove");
  }
}

export async function trades(
  { _id, from }: { _id: string; from?: string },
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<Trade[] | ErrorType> {
  if (!_id) {
    return errorMsgs.required1("_id");
  }
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getPortfolioInstanceByIDorName(_id, userData);
  if (error) {
    return error as ErrorType;
  }

  return await getPortfolioTrades(realId, from);
}

export async function putCash(
  par: PutCash,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  { userId }: UserData,
): Promise<Trade | ErrorType | undefined> {
  return await putSpecialTrade(
    {
      ...par,
      tradeType: convertMoneyTypeToTradeType(
        par.tradeType as MoneyTypes,
        TradeTypes.Cash,
      ),
    },
    sendResponse,
    msgId,
    userModif,
    userId,
  );
}

export async function putInvestment(
  par: PutInvestment,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  { userId }: UserData,
): Promise<Trade | ErrorType | undefined> {
  return await putSpecialTrade(
    { ...par, tradeType: TradeTypes.Investment },
    sendResponse,
    msgId,
    userModif,
    userId,
  );
}
export async function putDividends(
  par: PutDividends,
  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  { userId }: UserData,
): Promise<Trade | ErrorType | undefined> {
  if (!par.symbol) {
    return errorMsgs.required1("symbol");
  }
  return await putSpecialTrade(
    { ...par, tradeType: TradeTypes.Dividends },
    sendResponse,
    msgId,
    userModif,
    userId,
  );
}

export async function access(
  { _id, access }: { _id: string; access: string },

  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
) {
  if (!_id) {
    return errorMsgs.required1("_id");
  }
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getPortfolioInstanceByIDorName(_id, userData);
  if (error) {
    return error;
  }
  return await PortfolioModel.findByIdAndUpdate(
    realId,
    { access },
    { new: true },
  );
}

export async function detailList(
  { filter }: { filter: {} },

  sendResponse: (data: any) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
) {
  const isNotAdmin = userData.role !== "admin";
  if (isNotAdmin)
    filter = {
      ...filter,
      $or: [{ access: "public" }, { userId: userData.userId }],
    };
  console.log("FILTER", filter);
  return await PortfolioModel.aggregate([
    {
      $addFields: {
        userIdObject: {
          $toObjectId: "$userId",
        }, // Преобразование userId в ObjectId
      },
    },
    {
      $lookup: {
        from: "users",
        // Имя коллекции пользователей
        localField: "userIdObject",
        // Преобразованное поле

        foreignField: "_id",
        // Поле в коллекции пользователей
        as: "userDetails", // Имя для объединенного результата
      },
    },
    {
      $unwind: "$userDetails", // Развернуть массив объединенных документов
    },
    {
      $match: filter || {},
    },
    {
      $project: {
        name: 1,
        description: 1,
        currency: 1,
        userId: 1,
        baseInstrument: 1,
        portfolioType: 1,
        portfolioIds: 1,
        accountId: 1,
        access: 1,
        userName: "$userDetails.name", // Добавить поле userName с именем пользователя
        userRole: "$userDetails.role",
      },
    },
  ]);
}

export const description: CommandDescription = {
  history: {
    label: "Portfolio History (Optimized with Caching)",
    value: `${JSON.stringify({
      command: "portfolios.history",
      _id: "?",
      from: "",
      till: "",
      sample: "",
      detail: 0,
      precision: 2,
      forceRefresh: false,
      maxAge: 1440,
      streamUpdates: false
    })}`,
    access: "public",
  },
  // Removed description for historyV2
  // Removed extra closing brace from previous diff
  positions: {
    label: "Portfolio Positions",
    value: `${JSON.stringify({
      command: "portfolios.positions",
      _id: "?",
      requestType: "0",
      marketPrice: "4",
      basePrice: "4",
      closed: "all", //all|only|no
    })}`,
    access: "public",
  },

  putCash: {
    label: "Portfolio Put Cash",
    value: JSON.stringify({
      command: "portfolios.putCash",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      rate: "",
      description: "",
      fee: "",
      userId: "",
    }),
    access: "member",
  },

  putInvestment: {
    label: "Portfolio Put Cash",
    value: JSON.stringify({
      command: "portfolios.putInvestment",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      shares: 1,
      userId: "",
      rate: "",
      descriptuion: "",
      fee: "",
    }),
    access: "member",
  },

  putDividends: {
    label: "Portfolio Put Dividends",
    value: JSON.stringify({
      command: "portfolios.putDividends",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      userId: "",
      rate: "",
      descriptuion: "",
      fee: "",
    }),
    access: "member",
  },

  trades: {
    label: "Get Portfolio Trades",
    value: JSON.stringify({
      command: "portfolios.trades",
      _id: "?",
      from: "",
    }),
    access: "member",
  },

  access: {
    label: "Change access",
    access: "admin",
    value: JSON.stringify({
      command: "portfolios.access",
      _id: "?",
      access: "?'",
    }),
  },

  detailList: {
    label: "Portfolio detail list",
    value: JSON.stringify({
      command: "portfolios.detailList",
      filter: {},
    }),
    access: "member",
  },
  debug: {
    label: "Portfolio debug report",
    value: JSON.stringify({
      command: "portfolios.debug",
      portfolioId: "?",
      fee: "?",
      granularity: "day", // or "trade"
    }),
    access: "member", // Assuming this will be a member-access command
  }
};
