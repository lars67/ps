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
  lastDividendCheck: { type: Date, required: false }, // Track last dividend check timestamp
  aiComment: { type: String, default: "" } // Free-text AI-generated or user-provided comment about the portfolio
});

export const PortfolioModel: Model<Portfolio> =
  (models && models.Portfolio) ||
  model("Portfolio", PortfolioSchema, "portfolios");

// Defer index creation to happen after connection is established
// This prevents buffering timeouts in worker threads
const ensureIndexes = async () => {
  try {
    if (PortfolioModel.collection) {
      await PortfolioModel.collection.createIndex({ userId: 1 });
      await PortfolioModel.collection.createIndex({ access: 1 });
      await PortfolioModel.collection.createIndex({ userId: 1, access: 1 });
      await PortfolioModel.collection.createIndex({ accountId: 1 });
      console.log('✅ Portfolio indexes ensured');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create portfolio indexes:', error);
    // Don't throw - indexes might already exist or connection might not be ready
  }
};

// Ensure indexes when the model is first used
PortfolioModel.init().then(() => {
  ensureIndexes();
});
