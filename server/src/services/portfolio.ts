import { Portfolio, PortfolioWithID } from "../types/portfolio";
import { PortfolioModel } from "../models/portfolio";
import { FilterQuery } from "mongoose";
import { CommandDescription } from "@/types/custom";
import {validateRequired} from "../utils";

import {errorMsgs} from "../constants";
import {ErrorType} from "../types/other";

export  {snapshot} from './portfolio/snapshot';
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
  return await PortfolioModel.findByIdAndUpdate(_id, other,{new: true});
}

export async function remove({
  _id,
}: {
  _id: string;
}): Promise<Portfolio | ErrorType | null> {
  if (!_id) {
    return errorMsgs.required1('_id')
  }
  return await PortfolioModel.findByIdAndDelete(_id);
}

export async function clear10({
  _id,
}: {
  _id: string;
}): Promise<Portfolio | null> {
  console.log("from collection");
  //remove all trades
  return await PortfolioModel.findById(_id);
}

export const description: CommandDescription = {
  clear10: {
    label: "Clear portfolio",
    value: JSON.stringify({ command: "portfolios.clear10", _id: "?" }),
  },
  snapshot: {
    label: "Snapshot portfolio",
    value: `${JSON.stringify({ command: "portfolios.snapshot", _id: "?", onDate:"", history:"" })}
  Get portfolio for  portfolio by _id till onDate
  onDate = '': last trade date, or 'YYYY-MM-DD' 
  history: '' only for onDate
           'trade'  trade dates
               
      
    `,
  },
  positions: {
    label: "Portfolio positions",
    value: `${JSON.stringify({ command: "portfolios.positions", _id: "?" , requestType:"0", marketPrice:"4", basePrice:"4"})}`,
    extended: [{button:'portfolioEmulator'}]



  },
};
