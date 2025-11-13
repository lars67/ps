import { PortfolioHistoryDay } from "../types/portfolioHistory";
import { Model, Schema, model, models } from "mongoose";

// Extend the Model interface to include our static methods
interface IPortfolioHistoryModel extends Model<PortfolioHistoryDay> {
  findByPortfolioAndDateRange(portfolioId: string, from?: string, till?: string): Promise<PortfolioHistoryDay[]>;
  deleteOldRecords(cutoffDate: string): Promise<any>;
  getPortfolioDateRange(portfolioId: string): Promise<{ from: string; till: string } | null>;
}

const PortfolioHistoryDaySchema = new Schema<PortfolioHistoryDay>({
  portfolioId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD format
  invested: { type: Number, required: true, default: 0 },
  investedWithoutTrades: { type: Number, required: true, default: 0 },
  cash: { type: Number, required: true, default: 0 },
  nav: { type: Number, required: true, default: 0 },
  index: { type: Number, required: true, default: 0 },
  perfomance: { type: Number, required: true, default: 0 },
  shares: { type: Number, required: true, default: 0 },
  navShare: { type: Number, required: true, default: 0 },
  perfShare: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, required: true, default: Date.now },
  isCalculated: { type: Boolean, required: true, default: false }
}, {
  timestamps: false, // We handle lastUpdated manually
  collection: 'portfolio_histories'
});

// === PRIMARY INDEXES ===

// Compound unique index for efficient queries by portfolio and date range
// Covers most common queries: getHistory, saveHistoryDay
PortfolioHistoryDaySchema.index(
  { portfolioId: 1, date: 1 },
  {
    unique: true,
    name: "portfolio_date_unique"
  }
);

// Index for date-based queries within a portfolio (range queries, sorting)
PortfolioHistoryDaySchema.index(
  { portfolioId: 1, date: -1 },
  { name: "portfolio_date_desc" }
);

// === OPTIMIZATION INDEXES ===

// Covering index for cache freshness checks (avoids document fetch)
PortfolioHistoryDaySchema.index(
  { portfolioId: 1, lastUpdated: -1 },
  {
    name: "portfolio_lastUpdated",
    // Partial index for better performance - only index recent records
    partialFilterExpression: {
      lastUpdated: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }
  }
);

// Index for finding portfolios needing updates (batch processing)
PortfolioHistoryDaySchema.index(
  { lastUpdated: -1, portfolioId: 1 },
  { name: "lastUpdated_portfolio" }
);

// Index for cleanup operations (data retention)
PortfolioHistoryDaySchema.index(
  { date: 1 },
  {
    name: "date_cleanup",
    // Partial index for old records only
    partialFilterExpression: {
      date: { $lt: new Date().toISOString().split('T')[0] } // Only past dates
    }
  }
);

// === PERFORMANCE INDEXES ===

// Covering index for metadata queries (avoids document fetch)
PortfolioHistoryDaySchema.index(
  { portfolioId: 1, date: 1, lastUpdated: 1, isCalculated: 1 },
  { name: "portfolio_metadata_covering" }
);

// Index for aggregation queries (statistics, reporting)
PortfolioHistoryDaySchema.index(
  { portfolioId: 1, isCalculated: 1, date: -1 },
  { name: "portfolio_calculated_date" }
);

// === ADDITIONAL OPTIMIZATIONS ===

// Enable background index builds for production
// PortfolioHistoryDaySchema.index({ ... }, { background: true });

// For sharding (if needed in future):
// PortfolioHistoryDaySchema.index({ portfolioId: 1 }, { unique: false }); // Shard key candidate

// Static methods for common operations
PortfolioHistoryDaySchema.statics.findByPortfolioAndDateRange = function(
  portfolioId: string,
  from?: string,
  till?: string
) {
  const query: any = { portfolioId };

  if (from || till) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (till) query.date.$lte = till;
  }

  return this.find(query).sort({ date: 1 });
};

PortfolioHistoryDaySchema.statics.deleteOldRecords = function(cutoffDate: string) {
  return this.deleteMany({ date: { $lt: cutoffDate } });
};

PortfolioHistoryDaySchema.statics.getPortfolioDateRange = function(portfolioId: string) {
  return this.find({ portfolioId })
    .sort({ date: 1 })
    .limit(1)
    .then((results: PortfolioHistoryDay[]) => {
      if (results.length === 0) return null;

      const firstDate = results[0].date;
      return this.find({ portfolioId })
        .sort({ date: -1 })
        .limit(1)
        .then((lastResults: PortfolioHistoryDay[]) => ({
          from: firstDate,
          till: lastResults[0]?.date || firstDate
        }));
    });
};

export const PortfolioHistoryModel: IPortfolioHistoryModel =
  (models && models.PortfolioHistory as IPortfolioHistoryModel) ||
  model<PortfolioHistoryDay, IPortfolioHistoryModel>("PortfolioHistory", PortfolioHistoryDaySchema, "portfolio_histories");
