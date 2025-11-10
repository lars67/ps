/**
 * Dividend Cron Job Manager
 * Schedules and executes automatic dividend checking and booking
 */

import * as cron from 'node-cron';
import { PortfolioModel } from '../models/portfolio';
import { checkPortfolioDividends } from '../services/dividends/checker';
import { autobookDividends } from '../services/dividends/autoBooker';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';

interface CronJobStats {
  portfoliosProcessed: number;
  portfoliosSkipped: number;
  totalDividendsFound: number;
  totalDividendsBooked: number;
  totalErrors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class DividendCronJobManager {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private logsDir = path.join(process.cwd(), 'logs', 'dividend-bookings');

  constructor() {
    this.ensureLogsDirectory();
  }

  /**
   * Start the daily dividend cron job
   */
  start(schedule: string = '0 9 * * *'): void {
    if (this.cronJob) {
      logger.log('Dividend cron job is already running');
      return;
    }

    logger.log(`Starting dividend cron job with schedule: ${schedule}`);

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.log('Dividend cron job is already running, skipping this execution');
        return;
      }

      try {
        this.isRunning = true;
        await this.runDividendCheck();
      } catch (error) {
        logger.error(`Critical error in dividend cron job: ${error}`);
      } finally {
        this.isRunning = false;
      }
    });

    // Start the cron job
    this.cronJob.start();
    logger.log('Dividend cron job started successfully');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.log('Dividend cron job stopped');
    }
  }

  /**
   * Run dividend check immediately (for testing/manual execution)
   */
  async runNow(): Promise<CronJobStats> {
    if (this.isRunning) {
      throw new Error('Dividend check is already running');
    }

    this.isRunning = true;
    try {
      return await this.runDividendCheck();
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
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: !!this.cronJob,
      nextRun: this.cronJob ? this.getNextRunTime() : undefined
    };
  }

  /**
   * Main dividend checking logic
   */
  private async runDividendCheck(): Promise<CronJobStats> {
    const stats: CronJobStats = {
      portfoliosProcessed: 0,
      portfoliosSkipped: 0,
      totalDividendsFound: 0,
      totalDividendsBooked: 0,
      totalErrors: 0,
      startTime: new Date()
    };

    logger.log('Starting automated dividend check for all portfolios');

    try {
      // Get all portfolios with auto-booking enabled
      const portfolios = await PortfolioModel.find({ bookDividends: true });

      if (portfolios.length === 0) {
        logger.log('No portfolios have automatic dividend booking enabled');
        stats.endTime = new Date();
        stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
        this.writeLogFile(stats, []);
        return stats;
      }

      logger.log(`Found ${portfolios.length} portfolios with auto dividend booking enabled`);

      const portfolioResults: Array<{
        portfolioId: string;
        portfolioName: string;
        dividendsFound: number;
        dividendsBooked: number;
        errors: string[];
        duration: number;
      }> = [];

      // Process each portfolio
      for (const portfolio of portfolios) {
        const portfolioStartTime = Date.now();

        try {
          logger.log(`Processing portfolio: ${portfolio.name} (${portfolio._id})`);

          // Check for new dividends
          const checkResult = await checkPortfolioDividends(portfolio._id.toString());

          if (!checkResult.success) {
            logger.error(`Failed to check dividends for ${portfolio.name}: ${checkResult.error}`);
            stats.totalErrors++;
            portfolioResults.push({
              portfolioId: portfolio._id.toString(),
              portfolioName: portfolio.name,
              dividendsFound: 0,
              dividendsBooked: 0,
              errors: [checkResult.error || 'Unknown error'],
              duration: Date.now() - portfolioStartTime
            });
            continue;
          }

          const dividendsFound = checkResult.dividends.length;
          stats.totalDividendsFound += dividendsFound;

          if (dividendsFound === 0) {
            logger.log(`No new dividends found for ${portfolio.name}`);
            portfolioResults.push({
              portfolioId: portfolio._id.toString(),
              portfolioName: portfolio.name,
              dividendsFound: 0,
              dividendsBooked: 0,
              errors: [],
              duration: Date.now() - portfolioStartTime
            });
            continue;
          }

          // Auto-book the dividends
          const bookingResult = await autobookDividends(portfolio._id.toString(), checkResult.dividends);

          const dividendsBooked = bookingResult.bookedCount;
          stats.totalDividendsBooked += dividendsBooked;
          stats.portfoliosProcessed++;

          if (bookingResult.errors.length > 0) {
            stats.totalErrors += bookingResult.errors.length;
          }

          portfolioResults.push({
            portfolioId: portfolio._id.toString(),
            portfolioName: portfolio.name,
            dividendsFound,
            dividendsBooked,
            errors: bookingResult.errors,
            duration: Date.now() - portfolioStartTime
          });

          logger.log(`Portfolio ${portfolio.name}: ${dividendsFound} dividends found, ${dividendsBooked} booked`);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Error processing portfolio ${portfolio.name}: ${errorMsg}`);
          stats.totalErrors++;
          portfolioResults.push({
            portfolioId: portfolio._id.toString(),
            portfolioName: portfolio.name,
            dividendsFound: 0,
            dividendsBooked: 0,
            errors: [errorMsg],
            duration: Date.now() - portfolioStartTime
          });
        }
      }

      // Calculate final stats
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
      stats.portfoliosSkipped = portfolios.length - stats.portfoliosProcessed;

      // Write detailed log file
      this.writeLogFile(stats, portfolioResults);

      logger.log(`Dividend check completed: ${stats.totalDividendsFound} dividends found, ${stats.totalDividendsBooked} booked across ${stats.portfoliosProcessed} portfolios`);

      return stats;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Critical error in dividend check: ${errorMsg}`);
      stats.totalErrors++;
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      this.writeLogFile(stats, []);
      return stats;
    }
  }

  /**
   * Write detailed log file for the cron job execution
   */
  private writeLogFile(stats: CronJobStats, portfolioResults: Array<any>): void {
    try {
      const dateStr = moment(stats.startTime).format('YYYY-MM-DD');
      const timeStr = moment(stats.startTime).format('HH:mm:ss');
      const filename = `${dateStr}-dividend-bookings.log`;
      const filepath = path.join(this.logsDir, filename);

      let logContent = `${dateStr} ${timeStr} - Starting dividend check for ${portfolioResults.length} portfolios\n`;

      for (const result of portfolioResults) {
        logContent += `${moment(stats.startTime).format('YYYY-MM-DD HH:mm:ss')} - Portfolio "${result.portfolioName}" (ID: ${result.portfolioId}): ${result.dividendsFound} dividends found, ${result.dividendsBooked} booked`;

        if (result.errors.length > 0) {
          logContent += `, ${result.errors.length} errors`;
        }

        logContent += ` (${result.duration}ms)\n`;

        // Log individual dividends if any were booked
        if (result.dividendsBooked > 0) {
          // Note: We don't have individual dividend details here, but could enhance this later
          logContent += `  - ${result.dividendsBooked} dividends auto-booked\n`;
        }

        if (result.errors.length > 0) {
          for (const error of result.errors) {
            logContent += `  - Error: ${error}\n`;
          }
        }
      }

      const endTimeStr = stats.endTime ? moment(stats.endTime).format('HH:mm:ss') : 'unknown';
      logContent += `${dateStr} ${endTimeStr} - Completed dividend check. Total: ${stats.totalDividendsFound} dividends found, ${stats.totalDividendsBooked} booked across ${stats.portfoliosProcessed} portfolios`;

      if (stats.totalErrors > 0) {
        logContent += `, ${stats.totalErrors} errors`;
      }

      if (stats.duration) {
        logContent += ` (${Math.round(stats.duration / 1000)}s)`;
      }

      logContent += '\n';

      fs.appendFileSync(filepath, logContent, 'utf8');
      logger.log(`Dividend booking log written to: ${filepath}`);

    } catch (error) {
      logger.error(`Failed to write dividend log file: ${error}`);
    }
  }

  /**
   * Ensure the logs directory exists
   */
  private ensureLogsDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
        logger.log(`Created dividend bookings log directory: ${this.logsDir}`);
      }
    } catch (error) {
      logger.error(`Failed to create dividend logs directory: ${error}`);
    }
  }

  /**
   * Get the next run time for the cron job
   */
  private getNextRunTime(): Date | undefined {
    // This is a simplified implementation
    // In a real scenario, you'd parse the cron expression
    // For now, return approximately 24 hours from now
    if (!this.cronJob) return undefined;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow

    return tomorrow;
  }
}

// Export singleton instance
export const dividendCronJob = new DividendCronJobManager();
export default dividendCronJob;
