import { PortfolioHistoryService } from "./historyService";
import { PortfolioHistoryDay, PortfolioHistoryMetadata } from "../../types/portfolioHistory";
import { DayType } from "./history";

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
        // No cached data exists
        return {
          days: [],
          cached: false
        };
      }

      // Check if cached data is within acceptable age
      const cacheAgeMinutes = (Date.now() - metadata.lastUpdated.getTime()) / (1000 * 60);
      const isDataFresh = cacheAgeMinutes <= maxAgeMinutes;

      // Get the actual history data
      let historyData: PortfolioHistoryDay[] = [];

      if (isDataFresh) {
        // Data is fresh, return it immediately
        historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);

        // Validate that cached data is not all zeros (indicates calculation error)
        const hasValidData = this.validateCachedData(historyData);
        if (!hasValidData) {
          console.warn(`Cached data for portfolio ${portfolioId} appears to be all zeros, forcing recalculation`);
          // Force recalculation by falling through to background logic
          return await this.forceRecalculate(portfolioId, from, till);
        }

        return {
          days: historyData,
          cached: true,
          cacheAge: Math.round(cacheAgeMinutes),
          metadata
        };
      } else {
        // Data is stale, return what we have and trigger background refresh
        historyData = await PortfolioHistoryService.getHistory(portfolioId, from, till);

        // Validate that stale cached data is not all zeros
        const hasValidData = this.validateCachedData(historyData);
        if (!hasValidData) {
          console.warn(`Stale cached data for portfolio ${portfolioId} appears to be all zeros, forcing fresh calculation`);
          return await this.forceRecalculate(portfolioId, from, till);
        }

        // Trigger background refresh (don't await)
        this.triggerBackgroundRefresh(portfolioId).catch(err => {
          console.error(`Background refresh failed for portfolio ${portfolioId}:`, err);
        });

        return {
          days: historyData,
          cached: true,
          cacheAge: Math.round(cacheAgeMinutes),
          metadata: { ...metadata, calculationStatus: 'outdated' as const }
        };
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
   * Update portfolio history cache
   * This method calculates and caches portfolio history data
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

      // Import required dependencies
      const moment = require('moment');
      const { PortfolioModel } = require('../../models/portfolio');
      const { getPortfolioTrades } = require('../../utils/portfolio');
      const {
        checkPortfolioPricesCurrencies,
        checkPrices,
        fillDateHistoryFromTrades,
        getDateSymbolPrice,
        getRate,
        checkPriceCurrency,
        getDatePrices
      } = require('../../services/app/priceCashe');
      const { getPortfolioInstanceByIDorName } = require('./helper');
      const { isValidDateFormat, toNum } = require('../../utils');
      const { formatYMD } = require('../../constants');

      // Get portfolio instance
      const { instance: portfolio, error } = await getPortfolioInstanceByIDorName(portfolioId, { userId: '', role: 'admin' });
      if (error || !portfolio) {
        throw new Error(`Portfolio not found: ${portfolioId}`);
      }

      const realId = portfolio._id.toString();

      // Fetch ALL trades for this portfolio
      const allTradesResult = await getPortfolioTrades(realId, undefined, {
        state: { $in: ["1"] }
      });

      if ((allTradesResult as { error: string }).error) {
        throw new Error((allTradesResult as { error: string }).error);
      }

      const allTrades = (allTradesResult as any[]).sort((a, b) => moment(a.tradeTime).diff(moment(b.tradeTime)));

      if (allTrades.length === 0) {
        // No trades, create empty baseline record
        const baselineRecord = {
          portfolioId: realId,
          date: moment().format('YYYY-MM-DD'),
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

      // Determine date range
      const firstTradeDate = allTrades[0].tradeTime.split("T")[0];
      const startDateMoment = moment.utc(firstTradeDate, formatYMD);
      const endDateMoment = moment.utc();

      // Fetch price data for all symbols/currencies
      const { uniqueSymbols, uniqueCurrencies, withoutPrices } =
        await checkPortfolioPricesCurrencies(allTrades, portfolio.currency);

      if (portfolio.baseInstrument && !uniqueSymbols.includes(portfolio.baseInstrument)) {
        uniqueSymbols.push(portfolio.baseInstrument);
      }

      const priceCheckStartDate = startDateMoment.clone().subtract(10, 'days').format(formatYMD);
      await checkPrices(uniqueSymbols, priceCheckStartDate);
      for (const currency of uniqueCurrencies) {
        await checkPriceCurrency(currency, portfolio.currency, priceCheckStartDate);
      }
      if (withoutPrices.length > 0) {
        await fillDateHistoryFromTrades(allTrades, withoutPrices, endDateMoment.format(formatYMD));
      }

      // Initialize state variables
      let cash = 0;
      let shares = 0;
      let currentHoldings: Record<string, { volume: number; currency: string }> = {};
      const toNumLocal = (n: number) => toNum({ n: n ?? 0, precision: 2 });

      // Process all trades to build holdings state
      for (const trade of allTrades) {
        const rate = getRate(trade.currency, portfolio.currency, trade.tradeTime);
        if (rate == null) continue;

        switch (trade.tradeType) {
          case 'Trade':
            const { symbol } = trade;
            if (!currentHoldings[symbol]) {
              currentHoldings[symbol] = { volume: 0, currency: trade.currency };
            }
            const dir = trade.side === "B" ? 1 : -1;
            const cashChange = -dir * (trade.price * rate * trade.volume) - (trade.fee * rate);
            currentHoldings[symbol].volume += dir * trade.volume;
            cash += cashChange;
            break;
          case 'Cash':
          case 'Dividends':
          case 'Investment':
            const dividendMultiplier = (trade.tradeType === 'Dividends' ? (currentHoldings[trade.symbol]?.volume || 1) : 1);
            const cashPut = (trade.price * rate * dividendMultiplier) + (trade.fee * rate);
            cash += cashPut;
            if (trade.shares) {
              shares += trade.shares;
            } else if (trade.tradeType === 'Investment') {
              shares += 1;
            }
            break;
        }
      }

      // Clean up zero holdings
      Object.keys(currentHoldings).forEach(symbol => {
        if (currentHoldings[symbol].volume === 0) {
          delete currentHoldings[symbol];
        }
      });

      // Calculate initial values
      const dayBeforeStartStr = startDateMoment.clone().subtract(1, 'day').format(formatYMD);
      let initialInv = 0;
      for (const symbol in currentHoldings) {
        const holding = currentHoldings[symbol];
        const price = getDateSymbolPrice(dayBeforeStartStr, symbol);
        const rate = getRate(holding.currency, portfolio.currency, dayBeforeStartStr);
        if (price != null && rate != null) {
          initialInv += price * rate * holding.volume;
        }
      }

      let lastKnownNav = initialInv + cash;
      let lastKnownInvested = initialInv;
      let lastKnownCash = cash;
      let lastKnownShares = shares > 0 ? shares : 1;
      let baseIndexValue = getDateSymbolPrice(startDateMoment.format(formatYMD), portfolio.baseInstrument) || 100000;

      // Generate daily history
      const historyDays = [];
      let loopMoment = startDateMoment.clone();

      while (loopMoment.isSameOrBefore(endDateMoment)) {
        const currentDayString = loopMoment.format(formatYMD);
        let dayInvestedValue = 0;
        let dayNav = 0;

        // Calculate end-of-day values
        for (const symbol in currentHoldings) {
          const holding = currentHoldings[symbol];
          const price = getDateSymbolPrice(currentDayString, symbol);
          const rate = getRate(holding.currency, portfolio.currency, currentDayString);

          if (price != null && rate != null) {
            dayInvestedValue += price * rate * holding.volume;
          }
        }

        dayNav = dayInvestedValue + cash;

        // Update last known values
        lastKnownNav = dayNav;
        lastKnownInvested = dayInvestedValue;
        lastKnownCash = cash;
        lastKnownShares = shares > 0 ? shares : 1;

        const finalShares = shares > 0 ? shares : 1;
        const navShare = finalShares > 0 ? dayNav / finalShares : 0;
        const firstNavShare: number = historyDays[0]?.navShare ?? (navShare || 1);

        const currentIndexValue = getDateSymbolPrice(currentDayString, portfolio.baseInstrument) || baseIndexValue;
        if (currentIndexValue !== baseIndexValue && historyDays.length === 0) {
          baseIndexValue = currentIndexValue;
        }

        historyDays.push({
          portfolioId: realId,
          date: currentDayString,
          invested: toNumLocal(dayInvestedValue),
          investedWithoutTrades: toNumLocal(dayInvestedValue),
          cash: toNumLocal(cash),
          nav: toNumLocal(dayNav),
          index: toNumLocal(currentIndexValue),
          perfomance: 0,
          shares: finalShares,
          navShare: toNumLocal(navShare),
          perfShare: toNumLocal(100 * navShare / (firstNavShare !== 0 ? firstNavShare : 1)),
          lastUpdated: new Date(),
          isCalculated: true
        });

        loopMoment.add(1, 'day');
      }

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
   */
  private static validateCachedData(historyData: PortfolioHistoryDay[]): boolean {
    if (!historyData || historyData.length === 0) {
      return true; // Empty data is valid (no trades case)
    }

    // Check for data corruption indicators:
    // 1. All records have identical values (indicates calculation loop error)
    const firstDay = historyData[0];
    const identicalRecords = historyData.filter(day =>
      day.invested === firstDay.invested &&
      day.cash === firstDay.cash &&
      day.nav === firstDay.nav &&
      day.index === firstDay.index &&
      day.shares === firstDay.shares
    );

    // If more than 95% of records are identical, likely corrupted
    if (identicalRecords.length > historyData.length * 0.95 && historyData.length > 5) {
      console.warn(`Cached data appears corrupted: ${identicalRecords.length}/${historyData.length} identical records`);
      return false;
    }

    // 2. Check for negative NAV values (should never happen in valid calculations)
    const negativeNavRecords = historyData.filter(day => day.nav < 0);
    if (negativeNavRecords.length > 0) {
      console.warn(`Cached data contains ${negativeNavRecords.length} records with negative NAV values`);
      return false;
    }

    // 3. Check for NaN or Infinity values
    const invalidRecords = historyData.filter(day =>
      !isFinite(day.invested) || !isFinite(day.cash) || !isFinite(day.nav) ||
      !isFinite(day.index) || !isFinite(day.shares)
    );
    if (invalidRecords.length > 0) {
      console.warn(`Cached data contains ${invalidRecords.length} records with invalid numeric values`);
      return false;
    }

    // 4. Basic sanity check - NAV should roughly equal invested + cash
    const navMismatchedRecords = historyData.filter(day => {
      const expectedNav = day.invested + day.cash;
      // Allow for small rounding errors (±1)
      return Math.abs(day.nav - expectedNav) > 1;
    });
    if (navMismatchedRecords.length > historyData.length * 0.1) {
      console.warn(`Cached data has NAV/invested+cash mismatch in ${navMismatchedRecords.length}/${historyData.length} records`);
      return false;
    }

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
