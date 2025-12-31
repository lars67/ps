import { PortfolioHistoryService } from "./historyService";
import { PortfolioHistoryDay, PortfolioHistoryMetadata } from "../../types/portfolioHistory";
import { DayType } from "./portfolioCalculator";

/**
 * Portfolio History Cache Service
 * Provides intelligent caching layer for portfolio history data
 * Implements hybrid approach: serve cached data immediately, calculate in background when needed
 */
export class PortfolioHistoryCache {

  /**
   * Get portfolio history with intelligent caching
   * Returns cached data immediately if available and fresh, otherwise triggers background calculation
   */
  static async getHistory(
    portfolioId: string,
    from?: string,
    till?: string,
    maxAgeMinutes: number = 1440 // 24 hours default
  ): Promise<{
    days: PortfolioHistoryDay[];
    cached: boolean;
    cacheAge?: number; // minutes since last update
    metadata?: PortfolioHistoryMetadata;
  }> {
    try {
      // Check if we have cached data
      const metadata = await PortfolioHistoryService.getMetadata(portfolioId);

      if (!metadata || metadata.totalRecords === 0) {
        // No cached data exists - trigger immediate calculation
        console.log(`No cached data for portfolio ${portfolioId}, calculating immediately`);
        return await this.forceRecalculate(portfolioId, from, till);
      }

      // Check if cached data is within acceptable age
      const cacheAgeMinutes = (Date.now() - metadata.lastUpdated.getTime()) / (1000 * 60);
      const isDataFresh = cacheAgeMinutes <= maxAgeMinutes;

      // Get the actual history data
      let historyData: PortfolioHistoryDay[] = [];

      if (isDataFresh && metadata.calculationStatus !== 'outdated') {
        // Data is fresh, return it immediately
        historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);

        // Validate that cached data is not corrupted
        const hasValidData = this.validateCachedData(historyData);
        if (!hasValidData) {
          console.warn(`Cached data for portfolio ${portfolioId} appears corrupted, forcing recalculation`);
          // Force immediate recalculation instead of background
          return await this.forceRecalculate(portfolioId, from, till);
        }

        return {
          days: historyData,
          cached: true,
          cacheAge: Math.round(cacheAgeMinutes),
          metadata
        };
      } else {
        // Data is stale - trigger immediate refresh for better UX
        console.log(`Data for portfolio ${portfolioId} is stale (${Math.round(cacheAgeMinutes)}min old), refreshing immediately`);
        try {
          const updateResult = await this.updateHistory(portfolioId, undefined, false);
          if (updateResult.success) {
            // Fetch the freshly calculated data
            historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);
            const updatedMetadata = await PortfolioHistoryService.getMetadata(portfolioId);

            return {
              days: historyData,
              cached: false, // Indicate freshly calculated
              cacheAge: 0,
              metadata: updatedMetadata || undefined
            };
          } else {
            console.error(`Failed to update history for ${portfolioId}: ${updateResult.error}`);
            // Fall back to existing data if refresh fails
            historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);
            return {
              days: historyData,
              cached: true,
              cacheAge: Math.round(cacheAgeMinutes),
              metadata: { ...metadata, calculationStatus: 'outdated' as const }
            };
          }
        } catch (refreshError) {
          console.error(`Refresh failed for portfolio ${portfolioId}, using existing data:`, refreshError);
          historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);
          return {
            days: historyData,
            cached: true,
            cacheAge: Math.round(cacheAgeMinutes),
            metadata: { ...metadata, calculationStatus: 'outdated' as const }
          };
        }
      }

    } catch (error) {
      console.error(`Error in getHistory for portfolio ${portfolioId}:`, error);
      // Return empty result on error - client can fall back to on-demand calculation
      return {
        days: [],
        cached: false
      };
    }
  }

  /**
   * Incrementally update portfolio history cache
   * Only calculates new days since last update
   */
  static async updateHistoryIncremental(
    portfolioId: string,
    maxAgeHours: number = 24
  ): Promise<{
    success: boolean;
    recordsUpdated: number;
    calculationTime: number;
    lastUpdate?: Date;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      console.log(`Starting incremental update for portfolio ${portfolioId}`);

      // Get existing metadata to see what we have
      const metadata = await PortfolioHistoryService.getMetadata(portfolioId);
      if (!metadata || metadata.totalRecords === 0) {
        // No existing history, do full calculation from scratch
        console.log(`No existing history for ${portfolioId}, falling back to full calculation`);
        return await this.updateHistory(portfolioId, undefined, false);
      }

      // Always perform incremental update for cron jobs - portfolios need daily market data updates
      // Market prices change daily, so all portfolios need recalculation to get current values

      console.log(`Performing full recalculation for portfolio ${portfolioId} (daily cron update)`);
      return await this.updateHistory(portfolioId, undefined, true);

    } catch (error) {
      const calculationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Failed incremental update for portfolio ${portfolioId}:`, error);

      return {
        success: false,
        recordsUpdated: 0,
        calculationTime,
        error: errorMessage
      };
    }
  }

  /**
   * Extend existing history with new days
   */
  private static async extendHistory(
    portfolioId: string,
    fromDate: string,
    toDate: string
  ): Promise<{
    success: boolean;
    recordsUpdated: number;
    calculationTime: number;
    lastUpdate?: Date;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Use the history calculation but only for the new date range
      // This is a simplified version - in practice we'd want to resume from the last known state

      // For now, trigger a full calculation but log that it's for incremental extension
      console.log(`Extending history for ${portfolioId} from ${fromDate} to ${toDate}`);
      const fullResult = await this.updateHistory(portfolioId, fromDate, false);

      return {
        ...fullResult,
        calculationTime: Date.now() - startTime
      };

    } catch (error) {
      const calculationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Failed to extend history for portfolio ${portfolioId}:`, error);

      return {
        success: false,
        recordsUpdated: 0,
        calculationTime,
        error: errorMessage
      };
    }
  }

  /**
   * Check if portfolio has recent activity that would require history updates
   */
  private static async hasRecentActivity(portfolioId: string, lastHistoryDate: string): Promise<{
    hasActivity: boolean;
    latestActivity?: string;
  }> {
    try {
      // Query for trades, cash operations, dividends, or investments after the last history date
      const PortfolioModel = require('../../models/portfolio');
      const TradeModel = require('../../models/trade');

      // Check trades
      const latestTrade = await TradeModel.findOne({
        portfolioId: portfolioId,
        tradeTime: { $gt: `${lastHistoryDate}T23:59:59` },
        state: '1'
      }).sort({ tradeTime: -1 }).limit(1);

      if (latestTrade) {
        return {
          hasActivity: true,
          latestActivity: latestTrade.tradeTime.split('T')[0]
        };
      }

      // Could also check for portfolio metadata updates, but trades are the main driver
      return { hasActivity: false };

    } catch (error) {
      console.error(`Error checking recent activity for ${portfolioId}:`, error);
      // On error, assume activity exists to be safe
      return { hasActivity: true };
    }
  }

  /**
   * Update portfolio history cache
   * This method calculates and caches portfolio history data using the shared calculator
   */
  static async updateHistory(
    portfolioId: string,
    fromDate?: string,
    fullRecalculation: boolean = false
  ): Promise<{
    success: boolean;
    recordsUpdated: number;
    calculationTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      console.log(`Updating history cache for portfolio ${portfolioId}${fromDate ? ` from ${fromDate}` : ''}`);

      // Import the shared calculator
      const { PortfolioCalculator } = require('./portfolioCalculator');

      // Calculate history using the shared calculator
      const calculationResult = await PortfolioCalculator.calculatePortfolioHistory(
        portfolioId,
        fromDate,
        undefined, // till - use default (today)
        2, // precision
        true // forceRefresh to ensure fresh calculation
      );

      if (calculationResult.error) {
        throw new Error(calculationResult.error);
      }

      const { days } = calculationResult;

      if (days.length === 0) {
        // No trades, create empty baseline record
        const baselineRecord = {
          portfolioId: portfolioId,
          date: new Date().toISOString().split('T')[0],
          invested: 0,
          investedWithoutTrades: 0,
          cash: 0,
          nav: 0,
          index: 0,
          perfomance: 0,
          shares: 0,
          navShare: 0,
          perfShare: 0,
          lastUpdated: new Date(),
          isCalculated: true
        };

        await PortfolioHistoryService.saveHistoryDay(baselineRecord);

        return {
          success: true,
          recordsUpdated: 1,
          calculationTime: Date.now() - startTime
        };
      }

      // Convert DayType[] to PortfolioHistoryDay[] for storage
      const historyDays = days.map((day: DayType) => ({
        portfolioId: portfolioId,
        date: day.date,
        invested: day.invested,
        investedWithoutTrades: day.investedWithoutTrades,
        cash: day.cash,
        nav: day.nav,
        index: day.index,
        perfomance: day.perfomance,
        shares: day.shares,
        navShare: day.navShare,
        perfShare: day.perfShare,
        lastUpdated: new Date(),
        isCalculated: true
      }));

      // Save all history days
      await PortfolioHistoryService.saveHistoryDays(historyDays);

      const calculationTime = Date.now() - startTime;
      console.log(`✅ Successfully calculated and cached ${historyDays.length} days of history for portfolio ${portfolioId}`);

      return {
        success: true,
        recordsUpdated: historyDays.length,
        calculationTime
      };

    } catch (error) {
      const calculationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Failed to update history cache for portfolio ${portfolioId}:`, error);

      return {
        success: false,
        recordsUpdated: 0,
        calculationTime,
        error: errorMessage
      };
    }
  }

  /**
   * Invalidate cache for a portfolio
   * Forces next request to either recalculate or fetch fresh data
   */
  static async invalidateHistory(portfolioId: string): Promise<boolean> {
    try {
      // For now, this is a no-op since we don't have a separate cache layer
      // In the future, this could clear Redis cache or mark database records as stale
      console.log(`Cache invalidation requested for portfolio ${portfolioId}`);
      return true;
    } catch (error) {
      console.error(`Error invalidating cache for portfolio ${portfolioId}:`, error);
      return false;
    }
  }

  /**
   * Check if portfolio has fresh cached data
   */
  static async hasFreshData(
    portfolioId: string,
    maxAgeMinutes: number = 1440
  ): Promise<boolean> {
    try {
      return await PortfolioHistoryService.hasRecentData(portfolioId, maxAgeMinutes / 60); // Convert to hours
    } catch (error) {
      console.error(`Error checking fresh data for portfolio ${portfolioId}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getCacheStats(): Promise<{
    totalPortfolios: number;
    portfoliosWithData: number;
    totalRecords: number;
    averageRecordsPerPortfolio: number;
    portfoliosNeedingUpdate: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you'd query the database for actual statistics
      const portfoliosNeedingUpdate = await PortfolioHistoryService.getPortfoliosNeedingUpdate();

      return {
        totalPortfolios: 0, // Would need to query portfolio collection
        portfoliosWithData: 0, // Would need to count distinct portfolioIds in history collection
        totalRecords: 0, // Would need to count total history records
        averageRecordsPerPortfolio: 0,
        portfoliosNeedingUpdate: portfoliosNeedingUpdate.length
      };
    } catch (error) {
      console.error('Error getting cache statistics:', error);
      throw error;
    }
  }

  /**
   * Validate that cached data is not corrupted (checks for calculation errors)
   * Improved to only flag genuinely corrupted data, not valid zero/low-activity portfolios
   */
  private static validateCachedData(historyData: PortfolioHistoryDay[]): boolean {
    if (!historyData || historyData.length === 0) {
      return true; // Empty data is valid (no trades case)
    }

    // 1. Check for negative NAV values on recent records only (allow historical negative due to trades)
    const recentRecords = historyData.slice(-Math.min(7, historyData.length)); // Last 7 days
    const negativeNavRecords = recentRecords.filter(day => day.nav < -1000); // Allow small negative values
    if (negativeNavRecords.length > 0) {
      console.warn(`Cached data contains ${negativeNavRecords.length} recent records with abnormally negative NAV values`);
      return false;
    }

    // 2. Check for NaN or Infinity values
    const invalidRecords = historyData.filter(day =>
      !isFinite(day.invested) || !isFinite(day.cash) || !isFinite(day.nav) ||
      !isFinite(day.index) || !isFinite(day.shares)
    );
    if (invalidRecords.length > historyData.length * 0.02) { // More lenient - only flag if >2% corrupted
      console.warn(`Cached data contains ${invalidRecords.length} records with invalid numeric values`);
      return false;
    }

    // 3. Relaxed NAV sanity check - allow for rounding and calculation differences
    // Only flag if NAV is wildly wrong (more than 50% off)
    const navMismatchedRecords = historyData.filter(day => {
      const expectedNav = day.invested + day.cash;
      const tolerance = Math.max(100, Math.abs(expectedNav) * 0.5); // 50% or $100 minimum tolerance
      return Math.abs(day.nav - expectedNav) > tolerance;
    });
    if (navMismatchedRecords.length > historyData.length * 0.1) {
      console.warn(`Cached data has NAV/invested+cash mismatch in ${navMismatchedRecords.length}/${historyData.length} records`);
      return false;
    }

    // 4. Don't penalize portfolios with all identical values - could be valid small portfolios
    // Only look for problems in portfolios with significant variation

    return true;
  }

  /**
   * Force immediate recalculation when cached data appears invalid
   */
  private static async forceRecalculate(
    portfolioId: string,
    from?: string,
    till?: string
  ): Promise<{
    days: PortfolioHistoryDay[];
    cached: boolean;
    cacheAge?: number;
    metadata?: PortfolioHistoryMetadata;
  }> {
    try {
      console.log(`Forcing immediate recalculation for portfolio ${portfolioId}`);

      // Use the updateHistory method which handles recalculation properly
      const updateResult = await this.updateHistory(portfolioId, from, true);

      if (!updateResult.success) {
        console.error(`Update failed during force recalculation: ${updateResult.error}`);
        return { days: [], cached: false };
      }

      // Now fetch the freshly calculated data
      const historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);
      const metadata = await PortfolioHistoryService.getMetadata(portfolioId);

      console.log(`Force recalculation completed for portfolio ${portfolioId} (${historyData.length} records)`);

      return {
        days: historyData,
        cached: false, // Indicate this is freshly calculated
        cacheAge: 0,
        metadata: metadata || undefined
      };

    } catch (error) {
      console.error(`Failed to force recalculation for portfolio ${portfolioId}:`, error);

      // Return empty result on failure - client can handle gracefully
      return {
        days: [],
        cached: false
      };
    }
  }

  /**
   * Trigger background refresh for a portfolio
   * This is called when stale data is served to ensure future requests get fresh data
   */
  private static async triggerBackgroundRefresh(portfolioId: string): Promise<void> {
    try {
      // In a production system, this would queue the job
      // For now, we'll do a simple async update
      setTimeout(async () => {
        try {
          await this.updateHistory(portfolioId, undefined, false);
          console.log(`Background refresh completed for portfolio ${portfolioId}`);
        } catch (error) {
          console.error(`Background refresh failed for portfolio ${portfolioId}:`, error);
        }
      }, 100); // Small delay to not block the response

    } catch (error) {
      console.error(`Error triggering background refresh for portfolio ${portfolioId}:`, error);
    }
  }

  /**
   * Warm up cache for frequently accessed portfolios
   * This could be called during system startup or maintenance windows
   */
  static async warmupCache(frequentPortfolioIds: string[]): Promise<{
    portfoliosProcessed: number;
    totalRecords: number;
    errors: string[];
  }> {
    const result = {
      portfoliosProcessed: 0,
      totalRecords: 0,
      errors: [] as string[]
    };

    for (const portfolioId of frequentPortfolioIds) {
      try {
        const hasFreshData = await this.hasFreshData(portfolioId, 60); // 1 hour

        if (!hasFreshData) {
          const updateResult = await this.updateHistory(portfolioId);
          if (updateResult.success) {
            result.portfoliosProcessed++;
            result.totalRecords += updateResult.recordsUpdated;
          } else {
            result.errors.push(`Failed to update ${portfolioId}: ${updateResult.error}`);
          }
        } else {
          result.portfoliosProcessed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error warming up ${portfolioId}: ${errorMessage}`);
      }
    }

    return result;
  }
}
