import { ObjectId } from "mongodb";
export enum  PortfolioTypes  {
  STANDART= '',
  SUMMATION= 'summation',
  FUND='fund'
}
export type Portfolio = {
  name: string;
  description: string;
  currency: string;
  userId: string;
  baseInstrument: string;
  portfolioType?: string; //summation, portfolio
  portfolioIds?:string[]
  accountId?: string;
  access?:string;
  bookDividends?: boolean; // Enable/disable automatic dividend booking
  lastDividendCheck?: Date; // Track last dividend check timestamp
};

export type PortfolioWithID = Portfolio & { _id: string | ObjectId };
