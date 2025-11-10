/**
 * Dividend Auto-Booker Service
 * Automatically books dividends found by the checker service
 */

import { PortfolioModel } from '../../models/portfolio';
import { putDividends } from '../portfolio';
import { DividendToBook } from './checker';
import logger from '../../utils/logger';
import moment from 'moment';

export interface DividendBookingResult {
  success: boolean;
  bookedCount: number;
  failedCount: number;
  errors: string[];
  bookedDividends: Array<{
    symbol: string;
    amount: number;
    currency: string;
    paymentDate: string;
    tradeId?: string;
  }>;
}

/**
 * Automatically book dividends for a portfolio
 */
export async function autobookDividends(
  portfolioId: string,
  dividends: DividendToBook[],
  userId?: string
): Promise<DividendBookingResult> {
  const result: DividendBookingResult = {
    success: true,
    bookedCount: 0,
    failedCount: 0,
    errors: [],
    bookedDividends: []
  };

  if (!dividends || dividends.length === 0) {
    logger.log(`No dividends to book for portfolio ${portfolioId}`);
    return result;
  }

  try {
    // Get portfolio for validation
    const portfolio = await PortfolioModel.findById(portfolioId);
    if (!portfolio) {
      result.success = false;
      result.errors.push(`Portfolio ${portfolioId} not found`);
      return result;
    }

    logger.log(`Auto-booking ${dividends.length} dividends for portfolio ${portfolio.name} (${portfolioId})`);

    // Process each dividend
    for (const dividend of dividends) {
      try {
        // Check if dividend already exists (duplicate prevention)
        const existingDividend = await checkExistingDividend(portfolioId, dividend);
        if (existingDividend) {
          logger.log(`Dividend already booked for ${dividend.symbol} on ${dividend.paymentDate}, skipping`);
          continue;
        }

        // Calculate total dividend amount (per share × volume)
        const totalAmount = dividend.amount * dividend.volume;

        // Prepare dividend booking parameters
        // Format paymentDate as ISO string without timezone for tradeTime
        // The system expects: YYYY-MM-DDTHH:mm:ss.sss (no Z)
        const paymentDate = moment(dividend.paymentDate).format('YYYY-MM-DDTHH:mm:ss.SSS');

        const dividendParams = {
          portfolioId,
          symbol: dividend.symbol,
          amount: totalAmount.toString(),
          currency: dividend.currency,
          rate: 1, // Will be auto-calculated based on currency
          tradeTime: paymentDate,
          tradeType: 'dividends', // Required by PutCash type
          description: `Auto-booked dividend: ${dividend.symbol} (${dividend.amount} × ${dividend.volume} shares)`,
          fee: 0,
          userId: userId || portfolio.userId
        };

        // Book the dividend using existing putDividends function
        const bookingResult = await putDividends(
          dividendParams,
          (data: any) => {
            // Response handler - could be used for real-time updates
            logger.log(`Dividend booked successfully: ${JSON.stringify(data)}`);
          },
          'auto-booking', // msgId
          'system', // userModif
          {
            userId: userId || portfolio.userId,
            login: 'system', // System user for auto-booking
            role: 'admin' // Admin role for auto-booking
          } // userData
        );

        // Check if booking was successful (bookingResult is a Trade object on success, ErrorType on failure)
        if (bookingResult && typeof bookingResult === 'object' && 'error' in bookingResult) {
          // ErrorType case
          const errorMsg = (bookingResult as any).error || 'Unknown booking error';
          result.failedCount++;
          result.errors.push(`Failed to book ${dividend.symbol}: ${errorMsg}`);
          logger.error(`Failed to book dividend for ${dividend.symbol}: ${errorMsg}`);
        } else if (bookingResult && typeof bookingResult === 'object' && '_id' in bookingResult) {
          // Success case - Trade object
          result.bookedCount++;
          result.bookedDividends.push({
            symbol: dividend.symbol,
            amount: totalAmount,
            currency: dividend.currency,
            paymentDate: dividend.paymentDate,
            tradeId: (bookingResult as any).tradeId || (bookingResult as any)._id
          });

          logger.log(`Successfully booked dividend: ${dividend.symbol} - ${totalAmount} ${dividend.currency} (${dividend.paymentDate})`);
        } else {
          // Unexpected result
          result.failedCount++;
          result.errors.push(`Unexpected result booking ${dividend.symbol}`);
          logger.error(`Unexpected result booking dividend for ${dividend.symbol}: ${JSON.stringify(bookingResult)}`);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.failedCount++;
        result.errors.push(`Error booking ${dividend.symbol}: ${errorMsg}`);
        logger.error(`Error booking dividend for ${dividend.symbol}: ${errorMsg}`);
      }
    }

    // Update last dividend check timestamp
    try {
      await PortfolioModel.findByIdAndUpdate(portfolioId, {
        lastDividendCheck: new Date()
      });
      logger.log(`Updated lastDividendCheck for portfolio ${portfolio.name} (${portfolioId})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to update lastDividendCheck for portfolio ${portfolioId}: ${errorMsg}`);
      // Don't fail the entire operation for this
    }

    // Log summary
    logger.log(`Dividend auto-booking completed for ${portfolio.name}: ${result.bookedCount} booked, ${result.failedCount} failed`);

    // Mark as failed if any bookings failed
    if (result.failedCount > 0) {
      result.success = false;
    }

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors.push(`Critical error in auto-booking: ${errorMsg}`);
    logger.error(`Critical error in dividend auto-booking for portfolio ${portfolioId}: ${errorMsg}`);
    return result;
  }
}

/**
 * Check if a dividend has already been booked to prevent duplicates
 */
async function checkExistingDividend(portfolioId: string, dividend: DividendToBook): Promise<boolean> {
  try {
    // Import TradeModel here to avoid circular dependencies
    const { TradeModel } = await import('../../models/trade');

    // Look for existing dividend trades with same symbol and date
    const existingTrade = await TradeModel.findOne({
      portfolioId,
      symbol: dividend.symbol,
      tradeType: '20', // Dividends
      tradeTime: {
        $gte: moment(dividend.paymentDate).startOf('day').toDate(),
        $lt: moment(dividend.paymentDate).endOf('day').toDate()
      }
    });

    return !!existingTrade;
  } catch (error) {
    logger.error(`Error checking for existing dividend: ${error}`);
    // If we can't check, assume it doesn't exist to avoid blocking bookings
    return false;
  }
}

/**
 * Validate dividend data before booking
 */
export function validateDividend(dividend: DividendToBook): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!dividend.symbol || dividend.symbol.trim() === '') {
    errors.push('Symbol is required');
  }

  if (!dividend.amount || dividend.amount <= 0) {
    errors.push('Amount must be positive');
  }

  if (!dividend.currency || dividend.currency.trim() === '') {
    errors.push('Currency is required');
  }

  if (!dividend.paymentDate) {
    errors.push('Payment date is required');
  } else {
    // Validate date format
    const date = moment(dividend.paymentDate);
    if (!date.isValid()) {
      errors.push('Invalid payment date format');
    }
  }

  if (!dividend.volume || dividend.volume <= 0) {
    errors.push('Volume must be positive');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
