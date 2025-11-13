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
   * Runs at 05:00 CET daily (1 hour after dividend cron job)
   */
  start(): void {
    if (this.cronJob) {
      logger.log('Portfolio history cron job is already running');
      return;
    }

    // Cron expression: "0 5 * * *"
    // 0 = minute 0, 5 = hour 5, * = every day, * = every month, * = every day of week
    const schedule = '0 5 * * *';

    logger.log(`Starting portfolio history cron job with schedule: ${schedule} (05:00 CET daily)`);

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
   */
  private async findPortfoliosNeedingUpdates(): Promise<string[]> {
    try {
      // Get portfolios with recent activity (trades in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentPortfolios = await PortfolioModel.distinct('_id', {
        updatedAt: { $gte: sevenDaysAgo }
      });

      // Also include portfolios with stale cache (older than 24 hours)
      const portfoliosWithStaleCache = await PortfolioHistoryService.getPortfoliosNeedingUpdate(24);

      // Combine and deduplicate
      const allPortfolioIds = [...new Set([
        ...recentPortfolios.map((id: any) => id.toString()),
        ...portfoliosWithStaleCache
      ])];

      return allPortfolioIds;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error finding portfolios needing updates: ${errorMsg}`);
      return [];
    }
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
      // Check for gaps in existing history
      const validation = await PortfolioHistoryService.validatePortfolioData(portfolioId);

      if (!validation.isValid && validation.issues.length > 0) {
        result.gapsDetected = validation.issues.filter(issue =>
          issue.includes('Gap detected')
        ).length;
      }

      // Update history cache
      const updateResult = await PortfolioHistoryCache.updateHistory(portfolioId);

      if (updateResult.success) {
        result.recordsUpdated = updateResult.recordsUpdated;
        result.gapsFilled = result.gapsDetected; // Assume gaps are filled if update succeeds
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

    // Calculate next 05:00 CET
    const now = new Date();
    const nextRun = new Date(now);

    // Set to 05:00 today or next valid day
    nextRun.setHours(5, 0, 0, 0);

    // If it's already past 04:00 today and today is Mon-Sat, schedule for tomorrow
    if (now >= nextRun && now.getDay() >= 1 && now.getDay() <= 6) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    // If today is Sunday, schedule for Monday
    if (now.getDay() === 0) {
      nextRun.setDate(nextRun.getDate() + 1); // Monday
    }

    // If calculated day is Sunday, move to Monday
    if (nextRun.getDay() === 0) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }
}

// Export singleton instance
export const portfolioHistoryCronJob = new PortfolioHistoryCronJobManager();
export default portfolioHistoryCronJob;
