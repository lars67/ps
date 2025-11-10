import { Portfolio } from "../types/portfolio";
import { Model, Schema, model, models } from "mongoose";

const PortfolioSchema = new Schema<Portfolio>({
  name: { type: String, default: "PortfolioName", required: true },
  description: { type: String },
  currency: { type: String, default: "USD", required: true },
  userId: { type: String,  required: true },
  baseInstrument: { type: String, default: "SPY", required: true },
  portfolioType: {type: String}, //summation, portfolio
  portfolioIds:{type: [String]},
  accountId:{type: String},
  access:{type: String},
  bookDividends: { type: Boolean, default: true }, // Enable/disable automatic dividend booking
  lastDividendCheck: { type: Date, required: false } // Track last dividend check timestamp
});

export const PortfolioModel: Model<Portfolio> =
  (models && models.Portfolio) ||
  model("Portfolio", PortfolioSchema, "portfolios");
