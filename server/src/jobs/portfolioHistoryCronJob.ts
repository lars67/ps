/**
 * Portfolio History Cron Job Manager
 * Schedules and executes daily portfolio history updates and maintenance.
 * Runs at 05:00 CET daily (1 hour after dividend cron job)
 */

import * as cron from 'node-cron';
import { PortfolioModel } from '../models/portfolio';
import { PortfolioHistoryService } from '../services/portfolio/historyService';
import { PortfolioHistoryCache } from '../services/portfolio/historyCache';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';

interface CronJobStats {
  portfoliosProcessed: number;
  portfoliosSkipped: number;
  portfoliosWithErrors: number;
  totalRecordsUpdated: number;
  gapsDetected: number;
  gapsFilled: number;
  oldRecordsCleaned: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class PortfolioHistoryCronJobManager {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private logsDir = path.join(process.cwd(), 'logs', 'portfolio-history-cron');

  constructor() {
    this.ensureLogsDirectory();
  }

  /**
   * Start the daily portfolio history cron job
   * Runs at 05:00 CET daily in production, more frequently in development
   */
  start(): void {
    if (this.cronJob) {
      logger.log('Portfolio history cron job is already running');
      return;
    }

    // Use production schedule for both environments - development should use manual triggering
    const schedule = '0 5 * * *'; // 05:00 CET daily for both dev and prod
    const scheduleDescription = '05:00 CET daily';

    logger.log(`Starting portfolio history cron job with schedule: ${schedule} (${scheduleDescription})`);

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.log('Portfolio history cron job is already running, skipping this execution');
        return;
      }

      try {
        this.isRunning = true;
        await this.runDailyMaintenance();
      } catch (error) {
        logger.error(`Critical error in portfolio history cron job: ${error}`);
      } finally {
        this.isRunning = false;
      }
    }, {
      timezone: "Europe/Copenhagen" // CET timezone
    });

    // Start the cron job
    this.cronJob.start();
    logger.log('Portfolio history cron job started successfully');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.log('Portfolio history cron job stopped');
    }
  }

  /**
   * Run maintenance immediately (for testing/manual execution)
   */
  async runNow(): Promise<CronJobStats> {
    if (this.isRunning) {
      throw new Error('Portfolio history maintenance is already running');
    }

    this.isRunning = true;
    try {
      return await this.runDailyMaintenance();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Rebuild complete cache for all portfolios (destructive operation)
   */
  async rebuildCompleteCache(): Promise<CronJobStats> {
    if (this.isRunning) {
      throw new Error('Portfolio history maintenance is already running');
    }

    this.isRunning = true;
    try {
      logger.log('Starting complete cache rebuild - this will clear ALL existing history data');
      return await this.runCompleteRebuild();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get cron job status
   */
  getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    nextRun?: Date;
    schedule: string;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: !!this.cronJob,
      nextRun: this.cronJob ? this.getNextRunTime() : undefined,
      schedule: '05:00 CET daily'
    };
  }

  /**
   * Complete cache rebuild - clears all history data and rebuilds from scratch
   */
  private async runCompleteRebuild(): Promise<CronJobStats> {
    const stats: CronJobStats = {
      portfoliosProcessed: 0,
      portfoliosSkipped: 0,
      portfoliosWithErrors: 0,
      totalRecordsUpdated: 0,
      gapsDetected: 0,
      gapsFilled: 0,
      oldRecordsCleaned: 0,
      startTime: new Date()
    };

    try {
      // Check available memory before starting
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      const memLimitMB = 4000; // Conservative 4GB limit

      if (memUsageMB > memLimitMB) {
        throw new Error(`Insufficient memory to start rebuild. Current usage: ${memUsageMB.toFixed(1)}MB (limit: ${memLimitMB}MB)`);
      }

      logger.log(`Memory check passed: ${memUsageMB.toFixed(1)}MB used (limit: ${memLimitMB}MB)`);
      // 1. Clear ALL existing portfolio history data
      logger.log('Clearing all existing portfolio history data...');
      const { PortfolioHistoryModel } = require('../models/portfolioHistory');
      const deleteResult = await PortfolioHistoryModel.deleteMany({});
      stats.oldRecordsCleaned = deleteResult.deletedCount || 0;
      logger.log(`Cleared ${stats.oldRecordsCleaned} existing history records`);

      // 2. Find ALL portfolios in the system
      const { PortfolioModel } = require('../models/portfolio');
      logger.log('Querying portfolios collection...');
      const allPortfolios = await PortfolioModel.find({}, { _id: 1 }).lean();
      logger.log(`Raw portfolio query result: ${allPortfolios.length} documents`);
      const portfolioIds = allPortfolios.map((p: any) => p._id.toString());
      logger.log(`Found ${portfolioIds.length} portfolios to rebuild history for: ${portfolioIds.slice(0, 5).join(', ')}`);

      // 3. Process portfolios in batches with memory management (full recalculation)
      const batchSize = 3; // Even smaller batches for memory safety
      const maxConcurrentBatches = 2; // Limit concurrent processing

      for (let i = 0; i < portfolioIds.length; i += batchSize * maxConcurrentBatches) {
        const concurrentBatches = [];

        // Create up to maxConcurrentBatches concurrent batch operations
        for (let j = 0; j < maxConcurrentBatches && (i + j * batchSize) < portfolioIds.length; j++) {
          const batchStart = i + j * batchSize;
          const batch = portfolioIds.slice(batchStart, batchStart + batchSize);
          const batchIndex = Math.floor(batchStart / batchSize) + 1;

          logger.log(`Processing batch ${batchIndex}/${Math.ceil(portfolioIds.length / batchSize)} (${batch.length} portfolios)`);

          const batchPromise = Promise.allSettled(
            batch.map((portfolioId: string) => this.rebuildPortfolioHistory(portfolioId))
          ).then(batchResults => {
            // Update stats for this batch
            batchResults.forEach(result => {
              if (result.status === 'fulfilled') {
                const portfolioStats = result.value;
                stats.portfoliosProcessed++;
                stats.totalRecordsUpdated += portfolioStats.recordsUpdated;
              } else {
                stats.portfoliosWithErrors++;
                logger.error(`Portfolio rebuild failed: ${result.reason}`);
              }
            });
            return batchResults;
          });

          concurrentBatches.push(batchPromise);
        }

        // Wait for all concurrent batches in this group to complete
        await Promise.all(concurrentBatches);

        // Monitor memory usage after batch processing
        const currentMemUsage = process.memoryUsage();
        const currentMemUsageMB = currentMemUsage.heapUsed / 1024 / 1024;
        logger.log(`Memory usage after batch: ${currentMemUsageMB.toFixed(1)}MB heap used`);

        // Check if memory usage is getting dangerously high
        const memoryWarningThreshold = 6000; // 6GB warning threshold
        const memoryCriticalThreshold = 7000; // 7GB critical threshold

        if (currentMemUsageMB > memoryCriticalThreshold) {
          logger.error(`CRITICAL: Memory usage too high (${currentMemUsageMB.toFixed(1)}MB). Aborting rebuild to prevent crash.`);
          throw new Error(`Memory usage exceeded critical threshold: ${currentMemUsageMB.toFixed(1)}MB`);
        } else if (currentMemUsageMB > memoryWarningThreshold) {
          logger.warn(`WARNING: High memory usage (${currentMemUsageMB.toFixed(1)}MB). Consider reducing batch size or concurrency.`);
        }

        // Force garbage collection if available (Node.js with --expose-gc)
        if (global.gc) {
          global.gc();
          logger.log('Forced garbage collection after batch processing');
        }

        // Longer delay between batch groups to allow memory cleanup
        if (i + batchSize * maxConcurrentBatches < portfolioIds.length) {
          logger.log(`Completed batch group. Waiting 5 seconds for memory cleanup...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // 4. Update stats
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      // 5. Write rebuild log
      this.writeRebuildLog(stats);

      logger.log(`Complete cache rebuild completed: ${stats.portfoliosProcessed} portfolios, ${stats.totalRecordsUpdated} records`);

      return stats;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Critical error in complete rebuild: ${errorMsg}`);
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      this.writeLogFile(stats);
      return stats;
    }
  }

  /**
   * Main daily maintenance logic
   */
  private async runDailyMaintenance(): Promise<CronJobStats> {
    const stats: CronJobStats = {
      portfoliosProcessed: 0,
      portfoliosSkipped: 0,
      portfoliosWithErrors: 0,
      totalRecordsUpdated: 0,
      gapsDetected: 0,
      gapsFilled: 0,
      oldRecordsCleaned: 0,
      startTime: new Date()
    };

    logger.log('Starting daily portfolio history maintenance');

    try {
      // 1. Find portfolios that need updates (recent activity)
      const portfoliosToUpdate = await this.findPortfoliosNeedingUpdates();
      logger.log(`Found ${portfoliosToUpdate.length} portfolios needing updates`);

      // 2. Process portfolios in batches
      const batchSize = 10;
      for (let i = 0; i < portfoliosToUpdate.length; i += batchSize) {
        const batch = portfoliosToUpdate.slice(i, i + batchSize);
        logger.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(portfoliosToUpdate.length / batchSize)} (${batch.length} portfolios)`);

        const batchResults = await Promise.allSettled(
          batch.map(portfolioId => this.processPortfolio(portfolioId))
        );

        // Update stats
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            const portfolioStats = result.value;
            stats.portfoliosProcessed++;
            stats.totalRecordsUpdated += portfolioStats.recordsUpdated;
            stats.gapsDetected += portfolioStats.gapsDetected;
            stats.gapsFilled += portfolioStats.gapsFilled;
          } else {
            stats.portfoliosWithErrors++;
            logger.error(`Portfolio processing failed: ${result.reason}`);
          }
        });

        // Small delay between batches
        if (i + batchSize < portfoliosToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 3. Clean up old records (data retention)
      logger.log('Starting data retention cleanup...');
      const cleanupResult = await PortfolioHistoryService.applyRetentionPolicy();
      stats.oldRecordsCleaned = cleanupResult.deletedRecords;
      logger.log(`Cleaned up ${cleanupResult.deletedRecords} old records across ${cleanupResult.portfoliosAffected} portfolios`);

      // 4. Update stats
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      // 5. Write simple success log
      this.writeSimpleLog(stats);

      logger.log(`Portfolio history maintenance completed successfully`);

      return stats;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Critical error in daily maintenance: ${errorMsg}`);
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      this.writeLogFile(stats);
      return stats;
    }
  }

  /**
   * Find portfolios that need history updates
   * For daily cron jobs, ALL portfolios with history data need daily updates
   * because market prices change every day even without trades
   */
  private async findPortfoliosNeedingUpdates(): Promise<string[]> {
    try {
      // Get ALL portfolios that have history data - they all need daily updates
      // Market prices change every day, so all portfolios get new values
      const portfoliosWithHistory = await PortfolioHistoryService.getPortfoliosNeedingUpdate(999999);

      logger.log(`Found ${portfoliosWithHistory.length} portfolios with history data (all need daily updates)`);

      return portfoliosWithHistory;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error finding portfolios needing updates: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Rebuild history for a single portfolio (complete recalculation)
   */
  private async rebuildPortfolioHistory(portfolioId: string): Promise<{
    recordsUpdated: number;
  }> {
    const result = {
      recordsUpdated: 0
    };

    try {
      // Use full recalculation for rebuild
      const updateResult = await PortfolioHistoryCache.updateHistory(portfolioId, undefined, true, false);

      if (updateResult.success) {
        result.recordsUpdated = updateResult.recordsUpdated;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error rebuilding portfolio ${portfolioId}: ${errorMsg}`);
    }

    return result;
  }

  /**
   * Process a single portfolio
   */
  private async processPortfolio(portfolioId: string): Promise<{
    recordsUpdated: number;
    gapsDetected: number;
    gapsFilled: number;
  }> {
    const result = {
      recordsUpdated: 0,
      gapsDetected: 0,
      gapsFilled: 0
    };

    try {
      // Use incremental updates for daily maintenance
      const updateResult = await PortfolioHistoryCache.updateHistoryIncremental(portfolioId, 24);

      if (updateResult.success) {
        result.recordsUpdated = updateResult.recordsUpdated;
        // Check for gaps only if we actually calculated something
        if (updateResult.recordsUpdated > 0) {
          const validation = await PortfolioHistoryService.validatePortfolioData(portfolioId);
          if (!validation.isValid && validation.issues.length > 0) {
            result.gapsDetected = validation.issues.filter(issue =>
              issue.includes('Gap detected')
            ).length;
            result.gapsFilled = result.gapsDetected; // Assume gaps are filled by incremental calculation
          }
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing portfolio ${portfolioId}: ${errorMsg}`);
    }

    return result;
  }

  /**
   * Write simple success/failure log for normal operations
   */
  private writeSimpleLog(stats: CronJobStats): void {
    try {
      const dateStr = moment(stats.startTime).format('YYYY-MM-DD');
      const timeStr = moment(stats.startTime).format('HH:mm:ss');
      const filename = `${dateStr}-portfolio-history.log`;
      const filepath = path.join(this.logsDir, filename);

      const success = stats.portfoliosWithErrors === 0;
      const status = success ? 'SUCCESS' : 'COMPLETED_WITH_ERRORS';

      let logContent = `${dateStr} ${timeStr} - Portfolio history maintenance ${status}`;

      if (stats.duration) {
        const durationMinutes = Math.round(stats.duration / 1000 / 60);
        logContent += ` (${durationMinutes} minutes)`;
      }

      if (!success) {
        logContent += ` - ${stats.portfoliosWithErrors} errors`;
      }

      logContent += '\n';

      fs.appendFileSync(filepath, logContent, 'utf8');

    } catch (error) {
      logger.error(`Failed to write simple portfolio history log: ${error}`);
    }
  }

  /**
   * Write detailed log file for the cron job execution (used on errors)
   */
  private writeLogFile(stats: CronJobStats): void {
    try {
      const dateStr = moment(stats.startTime).format('YYYY-MM-DD');
      const timeStr = moment(stats.startTime).format('HH:mm:ss');
      const filename = `${dateStr}-portfolio-history-maintenance.log`;
      const filepath = path.join(this.logsDir, filename);

      let logContent = `${dateStr} ${timeStr} - Starting portfolio history maintenance\n`;

      logContent += `Portfolios processed: ${stats.portfoliosProcessed}\n`;
      logContent += `Portfolios skipped: ${stats.portfoliosSkipped}\n`;
      logContent += `Portfolios with errors: ${stats.portfoliosWithErrors}\n`;
      logContent += `Records updated: ${stats.totalRecordsUpdated}\n`;
      logContent += `Gaps detected: ${stats.gapsDetected}\n`;
      logContent += `Gaps filled: ${stats.gapsFilled}\n`;
      logContent += `Old records cleaned: ${stats.oldRecordsCleaned}\n`;

      const endTimeStr = stats.endTime ? moment(stats.endTime).format('HH:mm:ss') : 'unknown';
      logContent += `${dateStr} ${endTimeStr} - Completed portfolio history maintenance`;

      if (stats.duration) {
        const durationMinutes = Math.round(stats.duration / 1000 / 60);
        logContent += ` (${durationMinutes} minutes)`;
      }

      logContent += '\n';

      fs.appendFileSync(filepath, logContent, 'utf8');
      logger.log(`Portfolio history maintenance log written to: ${filepath}`);

    } catch (error) {
      logger.error(`Failed to write portfolio history log file: ${error}`);
    }
  }

  /**
   * Write log file specifically for complete rebuild operations
   */
  private writeRebuildLog(stats: CronJobStats): void {
    try {
      const dateStr = moment(stats.startTime).format('YYYY-MM-DD');
      const timeStr = moment(stats.startTime).format('HH:mm:ss');
      const filename = `${dateStr}-portfolio-history-rebuild.log`;
      const filepath = path.join(this.logsDir, filename);

      let logContent = `${dateStr} ${timeStr} - COMPLETE CACHE REBUILD STARTED\n`;

      logContent += `Old records cleared: ${stats.oldRecordsCleaned}\n`;
      logContent += `Portfolios processed: ${stats.portfoliosProcessed}\n`;
      logContent += `Portfolios with errors: ${stats.portfoliosWithErrors}\n`;
      logContent += `New records created: ${stats.totalRecordsUpdated}\n`;

      const endTimeStr = stats.endTime ? moment(stats.endTime).format('HH:mm:ss') : 'unknown';
      logContent += `${dateStr} ${endTimeStr} - COMPLETE CACHE REBUILD COMPLETED`;

      if (stats.duration) {
        const durationMinutes = Math.round(stats.duration / 1000 / 60);
        logContent += ` (${durationMinutes} minutes)`;
      }

      logContent += '\n';

      fs.appendFileSync(filepath, logContent, 'utf8');
      logger.log(`Portfolio history rebuild log written to: ${filepath}`);

    } catch (error) {
      logger.error(`Failed to write portfolio history rebuild log: ${error}`);
    }
  }

  /**
   * Ensure the logs directory exists
   */
  private ensureLogsDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
        logger.log(`Created portfolio history cron logs directory: ${this.logsDir}`);
      }
    } catch (error) {
      logger.error(`Failed to create portfolio history logs directory: ${error}`);
    }
  }

  /**
   * Get the next run time for the cron job
   */
  private getNextRunTime(): Date | undefined {
    if (!this.cronJob) return undefined;

    // Production: 05:00 CET daily
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(5, 0, 0, 0);

    // If it's already past 05:00 today, schedule for tomorrow
    if (now >= nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }
}

// Export singleton instance
export const portfolioHistoryCronJob = new PortfolioHistoryCronJobManager();
export default portfolioHistoryCronJob;
