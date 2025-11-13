import { PortfolioHistoryModel } from "../../models/portfolioHistory";
import {
  PortfolioHistoryDay,
  PortfolioHistoryQuery,
  PortfolioHistoryResult,
  PortfolioHistoryMetadata
} from "../../types/portfolioHistory";

/**
 * Portfolio History Service
 * Provides CRUD operations for portfolio history data
 */
export class PortfolioHistoryService {

  /**
   * Get portfolio history for a date range
   */
  static async getHistory(
    portfolioId: string,
    from?: string,
    till?: string
  ): Promise<PortfolioHistoryDay[]> {
    try {
      const results = await PortfolioHistoryModel.findByPortfolioAndDateRange(
        portfolioId,
        from,
        till
      );
      return results;
    } catch (error) {
      console.error(`Error getting portfolio history for ${portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Save or update a single history day
   */
  static async saveHistoryDay(historyDay: PortfolioHistoryDay): Promise<PortfolioHistoryDay> {
    try {
      const result = await PortfolioHistoryModel.findOneAndUpdate(
        { portfolioId: historyDay.portfolioId, date: historyDay.date },
        { ...historyDay, lastUpdated: new Date() },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
      return result.toObject();
    } catch (error) {
      console.error(`Error saving history day for ${historyDay.portfolioId} on ${historyDay.date}:`, error);
      throw error;
    }
  }

  /**
   * Save multiple history days (bulk operation)
   */
  static async saveHistoryDays(historyDays: PortfolioHistoryDay[]): Promise<PortfolioHistoryDay[]> {
    if (historyDays.length === 0) return [];

    try {
      const bulkOps = historyDays.map(day => ({
        updateOne: {
          filter: { portfolioId: day.portfolioId, date: day.date },
          update: { ...day, lastUpdated: new Date() },
          upsert: true,
          setDefaultsOnInsert: true
        }
      }));

      await PortfolioHistoryModel.bulkWrite(bulkOps);

      // Return the saved documents
      const portfolioId = historyDays[0].portfolioId;
      const dates = historyDays.map(d => d.date);
      const saved = await PortfolioHistoryModel.find({
        portfolioId,
        date: { $in: dates }
      }).sort({ date: 1 });

      return saved.map(doc => doc.toObject());
    } catch (error) {
      console.error(`Error saving ${historyDays.length} history days for ${historyDays[0]?.portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Delete history for a portfolio within a date range
   */
  static async deleteHistory(
    portfolioId: string,
    from?: string,
    till?: string
  ): Promise<number> {
    try {
      const query: any = { portfolioId };

      if (from || till) {
        query.date = {};
        if (from) query.date.$gte = from;
        if (till) query.date.$lte = till;
      }

      const result = await PortfolioHistoryModel.deleteMany(query);
      return result.deletedCount || 0;
    } catch (error) {
      console.error(`Error deleting history for ${portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Get metadata about a portfolio's history
   */
  static async getMetadata(portfolioId: string): Promise<PortfolioHistoryMetadata | null> {
    try {
      const count = await PortfolioHistoryModel.countDocuments({ portfolioId });

      if (count === 0) {
        return {
          portfolioId,
          totalRecords: 0,
          lastUpdated: new Date(),
          calculationStatus: 'outdated'
        };
      }

      const dateRange = await PortfolioHistoryModel.getPortfolioDateRange(portfolioId);
      const lastRecord = await PortfolioHistoryModel.findOne({ portfolioId })
        .sort({ lastUpdated: -1 })
        .limit(1);

      return {
        portfolioId,
        lastCalculatedDate: dateRange?.till,
        totalRecords: count,
        dateRange: dateRange ? { from: dateRange.from, till: dateRange.till } : undefined,
        lastUpdated: lastRecord?.lastUpdated || new Date(),
        calculationStatus: 'complete' // TODO: Implement logic to determine if outdated
      };
    } catch (error) {
      console.error(`Error getting metadata for ${portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Check if portfolio has recent history data
   */
  static async hasRecentData(
    portfolioId: string,
    maxAgeHours: number = 24
  ): Promise<boolean> {
    try {
      const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

      const recentRecord = await PortfolioHistoryModel.findOne({
        portfolioId,
        lastUpdated: { $gte: cutoffDate }
      });

      return !!recentRecord;
    } catch (error) {
      console.error(`Error checking recent data for ${portfolioId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old history records beyond retention period
   */
  static async cleanupOldRecords(retentionYears: number = 5): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];

      const result = await PortfolioHistoryModel.deleteOldRecords(cutoffDateString);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error cleaning up old history records:', error);
      throw error;
    }
  }

  /**
   * Get portfolios that need history updates
   */
  static async getPortfoliosNeedingUpdate(maxAgeHours: number = 24): Promise<string[]> {
    try {
      // This is a simplified implementation
      // In practice, you'd compare against a portfolio list
      const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

      const portfoliosWithOldData = await PortfolioHistoryModel.distinct('portfolioId', {
        lastUpdated: { $lt: cutoffDate }
      });

      return portfoliosWithOldData;
    } catch (error) {
      console.error('Error getting portfolios needing update:', error);
      throw error;
    }
  }

  /**
   * Data retention and cleanup policies
   */
  static async applyRetentionPolicy(retentionYears: number = 5): Promise<{
    deletedRecords: number;
    portfoliosAffected: number;
  }> {
    try {
      console.log(`Applying ${retentionYears}-year retention policy to portfolio history`);

      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];

      // Get count of records that will be deleted
      const recordsToDelete = await PortfolioHistoryModel.countDocuments({
        date: { $lt: cutoffDateString }
      });

      // Get unique portfolio IDs affected
      const affectedPortfolios = await PortfolioHistoryModel.distinct('portfolioId', {
        date: { $lt: cutoffDateString }
      });

      // Perform cleanup
      const deletedRecords = await this.cleanupOldRecords(retentionYears);

      console.log(`Retention policy applied: ${deletedRecords} records deleted across ${affectedPortfolios.length} portfolios`);

      return {
        deletedRecords,
        portfoliosAffected: affectedPortfolios.length
      };
    } catch (error) {
      console.error('Error applying retention policy:', error);
      throw error;
    }
  }

  /**
   * Validate data integrity for a portfolio
   */
  static async validatePortfolioData(portfolioId: string): Promise<{
    isValid: boolean;
    issues: string[];
    totalRecords: number;
    dateRange?: { from: string; till: string };
  }> {
    try {
      const issues: string[] = [];
      const metadata = await this.getMetadata(portfolioId);

      if (!metadata) {
        return {
          isValid: false,
          issues: ['No history data found for portfolio'],
          totalRecords: 0
        };
      }

      // Check for gaps in date sequence
      if (metadata.totalRecords > 0 && metadata.dateRange) {
        const history = await this.getHistory(portfolioId, metadata.dateRange.from, metadata.dateRange.till);
        const dates = history.map(h => h.date).sort();

        // Check for missing dates (simplified - only check for obvious gaps)
        for (let i = 1; i < dates.length; i++) {
          const prevDate = new Date(dates[i - 1]);
          const currentDate = new Date(dates[i]);
          const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff > 1) {
            issues.push(`Gap detected between ${dates[i - 1]} and ${dates[i]} (${dayDiff - 1} days missing)`);
          }
        }
      }

      // Check for records with invalid NAV calculations
      const invalidRecords = await PortfolioHistoryModel.countDocuments({
        portfolioId,
        $or: [
          { nav: { $lt: 0 } },
          { invested: { $lt: 0 } },
          { cash: { $lt: 0 } }
        ]
      });

      if (invalidRecords > 0) {
        issues.push(`${invalidRecords} records have negative values`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        totalRecords: metadata.totalRecords,
        dateRange: metadata.dateRange
      };
    } catch (error) {
      console.error(`Error validating data for portfolio ${portfolioId}:`, error);
      return {
        isValid: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        totalRecords: 0
      };
    }
  }
}
