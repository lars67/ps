/**
 * Dividend Checker Service
 * Checks portfolios for new dividends and returns them for auto-booking
 */

import { getDividends } from '../../utils/fetchData';
import { getPortfolioTrades } from '../../utils/portfolio';
import { PortfolioModel } from '../../models/portfolio';
import logger from '../../utils/logger';
import moment from 'moment';

export interface DividendData {
  symbol: string;
  amount: number; // dividend per share
  currency: string;
  paymentDate: string; // when dividend was paid
  exDividendDate?: string; // ex-dividend date
  recordDate?: string; // record date
}

export interface DividendToBook {
  symbol: string;
  amount: number;
  currency: string;
  paymentDate: string;
  volume: number; // shares held at payment time
}

/**
 * Check a portfolio for new dividends since last check
 */
export async function checkPortfolioDividends(portfolioId: string): Promise<{
  success: boolean;
  dividends: DividendToBook[];
  error?: string;
  lastCheck?: Date;
}> {
  try {
    // Get portfolio
    const portfolio = await PortfolioModel.findById(portfolioId);
    if (!portfolio) {
      return { success: false, dividends: [], error: `Portfolio ${portfolioId} not found` };
    }

    // Check if auto-booking is enabled
    if (portfolio.bookDividends === false) {
      logger.log(`Dividend auto-booking disabled for portfolio ${portfolio.name} (${portfolioId})`);
      return { success: true, dividends: [] };
    }

    // Get all trades for portfolio to determine current positions
    const tradesResult = await getPortfolioTrades(portfolioId);
    if (!tradesResult || (tradesResult as any).error || !Array.isArray(tradesResult) || tradesResult.length === 0) {
      return { success: true, dividends: [] };
    }

    const trades = tradesResult as any[]; // Type assertion after validation

    // Calculate current positions (simplified - we need symbols with positive volume)
    const positions = calculateCurrentPositions(trades);
    const activeSymbols = Object.keys(positions).filter(symbol => positions[symbol] > 0);

    if (activeSymbols.length === 0) {
      return { success: true, dividends: [] };
    }

    // Get last dividend check timestamp
    const lastCheck = portfolio.lastDividendCheck || new Date('2020-01-01'); // Default to old date if never checked

    logger.log(`Checking dividends for portfolio ${portfolio.name} (${portfolioId}): ${activeSymbols.length} symbols since ${lastCheck.toISOString()}`);
    console.log(`🔍 DEBUG: Active symbols to check: ${activeSymbols.join(', ')}`);

    // Check dividends for each active symbol
    const allDividends: DividendToBook[] = [];

    for (const symbol of activeSymbols) {
      try {
        console.log(`🔍 DEBUG: Checking dividends for ${symbol} (volume: ${positions[symbol]})`);
        const symbolDividends = await checkSymbolDividends(symbol, positions[symbol], lastCheck);
        console.log(`🔍 DEBUG: Found ${symbolDividends.length} dividends for ${symbol}`);
        allDividends.push(...symbolDividends);
      } catch (error) {
        logger.error(`Error checking dividends for ${symbol}: ${error}`);
        console.log(`❌ DEBUG: Error checking ${symbol}: ${error}`);
        // Continue with other symbols
      }
    }

    logger.log(`Found ${allDividends.length} new dividends for portfolio ${portfolio.name}`);

    return {
      success: true,
      dividends: allDividends,
      lastCheck
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error checking portfolio dividends for ${portfolioId}: ${errorMessage}`);
    return {
      success: false,
      dividends: [],
      error: errorMessage
    };
  }
}

/**
 * Check dividends for a specific symbol
 */
async function checkSymbolDividends(
  symbol: string,
  volume: number,
  lastCheck: Date
): Promise<DividendToBook[]> {
  console.log(`🔍 DEBUG: Calling getDividends('${symbol}')...`);
  const rawData = await getDividends(symbol);
  console.log(`🔍 DEBUG: getDividends('${symbol}') returned:`, typeof rawData, Array.isArray(rawData) ? `Array(${rawData.length})` : 'Object');

  if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
    console.log(`🔍 DEBUG: No dividend data for ${symbol}`);
    return [];
  }

  // Show sample of raw data to understand format
  if (Array.isArray(rawData) && rawData.length > 0) {
    console.log(`🔍 DEBUG: Sample raw data for ${symbol}:`, JSON.stringify(rawData[0], null, 2));
  } else if (typeof rawData === 'object') {
    console.log(`🔍 DEBUG: Raw data object for ${symbol}:`, JSON.stringify(rawData, null, 2));
  }

  // Parse dividend data - handle different possible formats
  const dividends = parseDividendData(rawData);
  console.log(`🔍 DEBUG: Parsed ${dividends.length} dividends from raw data for ${symbol}`);

  // Filter for dividends after last check
  const newDividends = dividends.filter(dividend => {
    const paymentDate = moment(dividend.paymentDate);
    const isAfter = paymentDate.isAfter(lastCheck);
    console.log(`🔍 DEBUG: Dividend ${dividend.symbol} ${dividend.paymentDate} isAfter(${lastCheck.toISOString()}): ${isAfter}`);
    return isAfter;
  });

  console.log(`🔍 DEBUG: After filtering, ${newDividends.length} new dividends for ${symbol}`);

  // Convert to DividendToBook format
  return newDividends.map(dividend => ({
    symbol,
    amount: dividend.amount,
    currency: dividend.currency,
    paymentDate: dividend.paymentDate,
    volume
  }));
}

/**
 * Parse dividend data from external API
 * This function handles different possible response formats
 */
function parseDividendData(rawData: any): DividendData[] {
  if (!rawData) return [];

  // Handle array format
  if (Array.isArray(rawData)) {
    return rawData.map(item => parseSingleDividend(item)).filter(isValidDividend);
  }

  // Handle object format (single dividend)
  if (typeof rawData === 'object' && rawData.symbol) {
    const parsed = parseSingleDividend(rawData);
    return parsed ? [parsed] : [];
  }

  // Handle nested object format
  if (typeof rawData === 'object' && rawData.dividends && Array.isArray(rawData.dividends)) {
    return rawData.dividends.map((item: any) => parseSingleDividend(item)).filter(isValidDividend);
  }

  return [];
}

/**
 * Type guard to check if dividend data is valid
 */
function isValidDividend(dividend: DividendData | null): dividend is DividendData {
  return dividend !== null;
}

/**
 * Parse a single dividend entry
 */
function parseSingleDividend(item: any): DividendData | null {
  try {
    // Common field mappings - try different possible field names
    const amount = item.amount || item.dividend || item.value || item.price || 0;
    const currency = item.currency || item.currencyCode || 'USD';
    const paymentDate = item.paymentDate || item.payDate || item.date || item.exDate;
    const symbol = item.symbol || item.ticker;

    // Debug logging for first few items
    console.log(`🔍 DEBUG: Parsing item: amount=${amount}, paymentDate=${paymentDate}, symbol=${symbol}`);

    if (!amount || !paymentDate) {
      console.log(`🔍 DEBUG: Missing required fields - amount: ${!!amount}, paymentDate: ${!!paymentDate}`);
      return null;
    }

    // For API responses that don't include symbol, we'll set it later from the request
    const finalSymbol = symbol || 'UNKNOWN';

    const result = {
      symbol: finalSymbol,
      amount: parseFloat(amount),
      currency: String(currency),
      paymentDate: String(paymentDate),
      exDividendDate: item.exDividendDate || item.exDate,
      recordDate: item.recordDate
    };

    console.log(`🔍 DEBUG: Parsed dividend: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(`Error parsing dividend data: ${error}`);
    return null;
  }
}

/**
 * Calculate current positions from trades
 * Simplified version - returns symbol -> volume mapping
 */
function calculateCurrentPositions(trades: any[]): Record<string, number> {
  const positions: Record<string, number> = {};

  for (const trade of trades) {
    if (trade.tradeType === '1' && trade.symbol && !trade.symbol.endsWith(':FX')) { // Regular trades only
      const symbol = trade.symbol;
      const volume = parseFloat(trade.volume) || 0;
      const side = trade.side === 'B' ? 1 : -1; // Buy = +1, Sell = -1

      positions[symbol] = (positions[symbol] || 0) + (side * volume);
    }
  }

  // Remove positions with zero or negative volume
  Object.keys(positions).forEach(symbol => {
    if (positions[symbol] <= 0) {
      delete positions[symbol];
    }
  });

  return positions;
}
