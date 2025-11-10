/**
 * Test dividend system for a single specific portfolio
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { connect } from 'mongoose';
import { dbConnection } from './src/db';
import { checkPortfolioDividends } from './src/services/dividends/checker';
import { autobookDividends } from './src/services/dividends/autoBooker';
import logger from './src/utils/logger';

async function testSinglePortfolio() {
  const portfolioId = '690207ef49a013b6016e75a6'; // S&P500 portfolio

  try {
    // Connect to database first
    console.log('Connecting to database...');
    await connect(dbConnection.url);
    console.log('✅ Database connected');

    console.log(`Testing dividend system for portfolio: ${portfolioId}`);

    // Step 1: Check for dividends
    console.log('Step 1: Checking for dividends...');
    const checkResult = await checkPortfolioDividends(portfolioId);

    if (!checkResult.success) {
      console.error('❌ Dividend check failed:', checkResult.error);
      return;
    }

    console.log(`✅ Found ${checkResult.dividends.length} dividends to book`);

    if (checkResult.dividends.length === 0) {
      console.log('ℹ️ No new dividends found');
      return;
    }

    // Step 2: Auto-book the dividends
    console.log('Step 2: Auto-booking dividends...');
    const bookingResult = await autobookDividends(portfolioId, checkResult.dividends);

    console.log(`✅ Booked ${bookingResult.bookedCount} dividends`);
    if (bookingResult.errors.length > 0) {
      console.log(`⚠️ ${bookingResult.errors.length} errors occurred:`);
      bookingResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testSinglePortfolio();
