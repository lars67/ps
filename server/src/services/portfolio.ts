import { Portfolio, PortfolioWithID } from "@/types/portfolio";
import { PortfolioModel } from "../models/portfolio";
import { FilterQuery } from "mongoose";
import { CommandDescription } from "@/types/custom";
import {
  checkCurrency,
  checkUnique, extractUniqueValues, findMinByField,
  getModelInstanceByIDorName,
  getRealId,
  isErrorType,
  validateRequired
} from "../utils";

import {errorMsgs} from "../constants";
import {ErrorType} from "../types/other"
import {Trade} from "../types/trade";

import {fixRate, PutCash, putSpecialTrade, summationFlatPortfolios} from "../services/portfolio/helper";
import {TradeModel} from "../models/trade";
import {getCurrentPosition, getPortfolioTrades} from "../utils/portfolio";
import {checkPriceCurrency} from "../services/app/priceCashe";

export  {history} from './portfolio/history';
export  {positions} from './portfolio/positions';

export const validationsAddRequired:string[] = ['name','currency', 'baseInstrument'];

export async function list(
  filter: FilterQuery<Portfolio> = {},
): Promise<Portfolio[] | null> {
  try {
    console.log("filter", filter);
    const portfolios = await PortfolioModel.find(filter?.filter).lean();
    return portfolios;
  } catch (err) {}
  return [];
}

export async function add(
  portfolio: Portfolio,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userId: string,
): Promise<Portfolio | ErrorType | null> {
  let err_required = validateRequired<Portfolio>(validationsAddRequired, portfolio)
  if (err_required) {
    return errorMsgs.required(err_required);
  }
  let error  = await checkUnique<Portfolio>(PortfolioModel, portfolio.name, 'name');
  if (error) return error
  error =  await checkCurrency(portfolio.currency);
  if (error) return error

  if (!portfolio.userId) {
    portfolio.userId = userId;
  }
  const newPortfolio = new PortfolioModel(portfolio);
  const added = await newPortfolio.save();
  return added;
}

export async function update(
  Portfolio: Partial<PortfolioWithID>,
): Promise<Portfolio | ErrorType | null> {
  const { _id, ...other } = Portfolio;
  if (other.currency) {
    return errorMsgs.notAllowed('change currency')
  }
  if (!_id) {
    return errorMsgs.required1('_id')
  }
  const realId = await getRealId<Portfolio>(_id as string,PortfolioModel);
  if (  isErrorType(realId)){
    return realId;
  }
  return await PortfolioModel.findByIdAndUpdate(realId, other,{new: true});
}

export async function remove({
  _id,
}: {
  _id: string;
}): Promise<Portfolio | ErrorType | null> {
  if (!_id) {
    return errorMsgs.required1('_id')
  }
  const realId = await getRealId<Portfolio>(_id as string,PortfolioModel);
  console.log('realId',realId, typeof realId , isErrorType(realId));
  if (  isErrorType(realId)){
    return realId;//error mean
  }
  try {
    const result = await PortfolioModel.findByIdAndDelete(realId);
    if (result) {
      const result2 = await TradeModel.deleteMany({portfolioId: realId.toString()});
      console.log('result2', result2);
      return result
    } else {
      return errorMsgs.notExists(realId)
    }
  } catch (err) {
    return errorMsgs.failed('portfolio remove')
  }
}


export async function trades(
    {_id, from}: {_id:string, from?:string},
    sendResponse: (data: any) => void,
    msgId: string,
): Promise<Trade[] | ErrorType> {
  if (!_id) {
    return errorMsgs.required1('_id')
  }
  return await getPortfolioTrades(_id, from);

}

export async function putCash(
    par: PutCash,
    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
): Promise<Trade | ErrorType | undefined> {

  return await putSpecialTrade(
      {...par, tradeType:'31'},
      sendResponse,
      msgId,
      userModif,
      userId);

}

export async function putDividends(
    par: PutCash,
    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
): Promise<Trade | ErrorType | undefined> {

  return await putSpecialTrade(
      {...par, tradeType:'20'},
      sendResponse,
      msgId,
      userModif,
      userId);

}

export async function current(
    {_id}: {_id:string},

    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
){

  return await getCurrentPosition(_id);

}

export const description: CommandDescription = {

  history: {
    label: "Portfolio History",
    value: `${JSON.stringify({command: "portfolios.history", _id: "?", from: "", till: "", sample: "", detail: 0, precision:2})}

               
      
    `,
  },
  positions: {
    label: "Portfolio Positions",
    value: `${JSON.stringify({
      command: "portfolios.positions",
      _id: "?",
      requestType: "0",
      marketPrice: "4",
      basePrice: "4",
      closed: 'all' ,  //all|only|no 
    })}`,
    extended: [{button: 'portfolioEmulator'}]
  },

  putCash: {
    label: "Portfolio Put Cash",
    value: JSON.stringify({
      command: "portfolios.putCash",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      userId: "",
    }),
  },

  putDividends: {
    label: "Portfolio Put Dividends",
    value: JSON.stringify({
      command: "portfolios.putDividends",
      portfolioId: "?",
      amount: "?",
      currency: "?",
      userId: "",
    }),
  },

  trades: {
    label: "Get Portfolio Trades",
    value: JSON.stringify({
      command: "portfolios.trades",
      _id: "?",
      from: "",

    }),

  },

  current: {
    label: "Get Portfolio now",
    value: JSON.stringify({
      command: "portfolios.current",
      _id: "?",
    }),
  }
}
