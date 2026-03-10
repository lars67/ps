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
  aiComment?: string; // Free-text AI-generated or user-provided comment about the portfolio
};

export type PortfolioWithID = Portfolio & { _id: string | ObjectId };
