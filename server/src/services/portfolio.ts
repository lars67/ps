import { Portfolio, PortfolioWithID } from "@/types/portfolio";
import { PortfolioModel } from "../models/portfolio";
import { FilterQuery } from "mongoose";
import { CommandDescription } from "@/types/custom";
import {checkUnique, getRealId, isErrorType, validateRequired} from "../utils";

import {errorMsgs} from "../constants";
import {ErrorType} from "@/types/other";
import {Trade} from "@/types/trade";

import {PutCash, putSpecialTrade} from "../services/portfolio/helper";

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
  const error  = await checkUnique<Portfolio>(PortfolioModel, portfolio.name, 'name');
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
  console.log('realId',realId, typeof realId );
  if (  isErrorType(realId)){
    return realId;//error mean
  }
  const result = await PortfolioModel.findByIdAndDelete(realId);
  if (result) {
    return result
  } else {
    return errorMsgs.notExists(realId)
  }
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


export const description: CommandDescription = {

  history: {
    label: "Portfolio History",
    value: `${JSON.stringify({ command: "portfolios.history", _id: "?", from:"", till:"", detail:0 })}
  Get portfolio history 
  onDate = '': last trade date, or 'YYYY-MM-DD' 
  history: '' only for onDate
           'trade'  trade dates
               
      
    `,
  },
  positions: {
    label: "Portfolio Positions",
    value: `${JSON.stringify({ command: "portfolios.positions", _id: "?" , requestType:"0", marketPrice:"4", basePrice:"4", emulator:true})}`,
    extended: [{button:'portfolioEmulator'}]
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
};
