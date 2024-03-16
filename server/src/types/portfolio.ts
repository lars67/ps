import { ObjectId } from "mongodb";

export type Portfolio = {
  name: string;
  description: string;
  currency: string;
  userId: string;
  baseInstrument: string;
};

export type PortfolioWithID = Portfolio & { _id: string | ObjectId };
