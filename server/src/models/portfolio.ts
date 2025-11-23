import { Portfolio } from "../types/portfolio";
import { Model, Schema, model, models } from "mongoose";

const PortfolioSchema = new Schema<Portfolio>({
  name: { type: String, default: "PortfolioName", required: true },
  description: { type: String },
  currency: { type: String, default: "USD", required: true },
  userId: { type: String, required: true, index: true },
  baseInstrument: { type: String, default: "SPY", required: true },
  portfolioType: {type: String}, //summation, portfolio
  portfolioIds:{type: [String]},
  accountId:{type: String, index: true},
  access:{type: String, index: true},
  bookDividends: { type: Boolean, default: true }, // Enable/disable automatic dividend booking
  lastDividendCheck: { type: Date, required: false } // Track last dividend check timestamp
});

export const PortfolioModel: Model<Portfolio> =
  (models && models.Portfolio) ||
  model("Portfolio", PortfolioSchema, "portfolios");

// Apply indexes
PortfolioModel.collection.createIndex({ userId: 1 });
PortfolioModel.collection.createIndex({ access: 1 });
PortfolioModel.collection.createIndex({ userId: 1, access: 1 });
PortfolioModel.collection.createIndex({ accountId: 1 });
