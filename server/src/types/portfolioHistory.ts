import { ObjectId } from "mongodb";

// Interface for individual daily portfolio history snapshot
export type PortfolioHistoryDay = {
  portfolioId: string;
  date: string; // YYYY-MM-DD format
  invested: number; // Market value of holdings
  investedWithoutTrades: number; // Market value without considering same-day trades
  cash: number; // Cash balance in portfolio currency
  nav: number; // Net Asset Value (invested + cash)
  index: number; // Value of base instrument on this date
  perfomance: number; // Daily performance (placeholder)
  shares: number; // Number of shares/units
  navShare: number; // NAV per share
  perfShare: number; // Performance percentage
  lastUpdated: Date; // When this record was last calculated
  isCalculated: boolean; // Whether fully calculated or estimated
};

// Interface for portfolio history metadata
export type PortfolioHistoryMetadata = {
  portfolioId: string;
  lastCalculatedDate?: string; // Last date with calculated data
  totalRecords: number; // Number of history records
  dateRange?: {
    from: string;
    till: string;
  };
  lastUpdated: Date;
  calculationStatus: 'complete' | 'partial' | 'outdated';
};

// Parameters for history queries
export type PortfolioHistoryQuery = {
  portfolioId: string;
  from?: string;
  till?: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
};

// Result of history calculation
export type PortfolioHistoryResult = {
  days: PortfolioHistoryDay[];
  metadata: PortfolioHistoryMetadata;
  hasGaps: boolean; // Whether there are missing dates in the range
  calculationTime: number; // Time taken to calculate (ms)
};
