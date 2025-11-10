/**
 * Test script for the automatic dividend booking system
 * Tests the specific portfolio: "Agressive Tech" (6901d6ab7225611b61d36e0c)
 */

import * as dotenv from "dotenv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
dotenv.config();

import { connect } from "mongoose";
import { dbConnection } from './src/db';
import { checkPortfolioDividends } from './src/services/dividends/checker';
import { autobookDividends } from './src/services/dividends/autoBooker';
import { PortfolioModel } from './src/models/portfolio';
import logger from './src/utils/logger';

const TEST_PORTFOLIO_ID = '6901d6ab7225611b61d36e0c';

async function testDividendSystem() {
  let mongooseConnection = null;

  try {
    console.log('='.repeat(80));
    console.log('🧪 TESTING AUTOMATIC DIVIDEND BOOKING SYSTEM');
    console.log('='.repeat(80));

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ps2';
    mongooseConnection = await connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');

    // Get portfolio details
    console.log(`\n📊 Getting portfolio details for ID: ${TEST_PORTFOLIO_ID}`);
    const portfolio = await PortfolioModel.findById(TEST_PORTFOLIO_ID);

    if (!portfolio) {
      console.error('❌ Portfolio not found!');
      return;
    }

    console.log('📋 Portfolio Details:');
    console.log(`   Name: ${portfolio.name}`);
    console.log(`   Currency: ${portfolio.currency}`);
    console.log(`   bookDividends: ${portfolio.bookDividends}`);
    console.log(`   lastDividendCheck: ${portfolio.lastDividendCheck}`);
    console.log(`   User ID: ${portfolio.userId}`);

    // Check if auto-booking is enabled
    if (portfolio.bookDividends !== true) {
      console.log('⚠️  Auto-booking is disabled for this portfolio');
      console.log('   Skipping dividend check...');
      return;
    }

    console.log('\n🔍 PHASE 1: CHECKING FOR DIVIDENDS');
    console.log('-'.repeat(50));

    // Test dividend checking
    console.log(`🔎 Calling checkPortfolioDividends('${TEST_PORTFOLIO_ID}')...`);
    console.log('   This will check positions and call getDividends() for each symbol...');
    const checkStartTime = Date.now();

    const checkResult = await checkPortfolioDividends(TEST_PORTFOLIO_ID);

    const checkDuration = Date.now() - checkStartTime;
    console.log(`⏱️  Check completed in ${checkDuration}ms`);

    console.log('\n📊 Check Result:');
    console.log(`   Success: ${checkResult.success}`);
    console.log(`   Dividends Found: ${checkResult.dividends.length}`);

    if (checkResult.error) {
      console.log(`   Error: ${checkResult.error}`);
    }

    // Add debug info about what was checked
    console.log('\n🔧 DEBUG INFO:');
    console.log('   Expected symbols to check: META:XNAS, NFLX:XNAS, PLTR:XNAS, APP:XNAS, INTU:XNAS');
    console.log('   These are the current positions in the portfolio');
    console.log('   If no dividends found, it could mean:');
    console.log('   - No recent dividends for these stocks');
    console.log('   - getDividends() API not returning data');
    console.log('   - Dividend data format different than expected');
    console.log('   - API endpoint issues');

    if (checkResult.dividends.length > 0) {
      console.log('\n💰 Found Dividends:');
      checkResult.dividends.forEach((dividend, index) => {
        console.log(`   ${index + 1}. ${dividend.symbol}: ${dividend.amount} ${dividend.currency} (${dividend.paymentDate}) - Volume: ${dividend.volume}`);
      });

      console.log('\n💸 PHASE 2: AUTO-BOOKING DIVIDENDS');
      console.log('-'.repeat(50));

      // Test auto-booking
      console.log(`📝 Calling autobookDividends('${TEST_PORTFOLIO_ID}', dividends)...`);
      const bookStartTime = Date.now();

      const bookingResult = await autobookDividends(TEST_PORTFOLIO_ID, checkResult.dividends);

      const bookDuration = Date.now() - bookStartTime;
      console.log(`⏱️  Booking completed in ${bookDuration}ms`);

      console.log('\n📊 Booking Result:');
      console.log(`   Success: ${bookingResult.success}`);
      console.log(`   Dividends Booked: ${bookingResult.bookedCount}`);
      console.log(`   Failed: ${bookingResult.failedCount}`);

      if (bookingResult.bookedDividends.length > 0) {
        console.log('\n✅ Successfully Booked:');
        bookingResult.bookedDividends.forEach((booked, index) => {
          console.log(`   ${index + 1}. ${booked.symbol}: ${booked.amount} ${booked.currency} (${booked.paymentDate}) - Trade ID: ${booked.tradeId}`);
        });
      }

      if (bookingResult.errors.length > 0) {
        console.log('\n❌ Booking Errors:');
        bookingResult.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      // Verify the portfolio was updated
      console.log('\n🔄 PHASE 3: VERIFYING PORTFOLIO UPDATE');
      console.log('-'.repeat(50));

      const updatedPortfolio = await PortfolioModel.findById(TEST_PORTFOLIO_ID);
      console.log('📋 Updated Portfolio Details:');
      console.log(`   lastDividendCheck: ${updatedPortfolio?.lastDividendCheck}`);

    } else {
      console.log('\n📭 No new dividends found for this portfolio');
    }

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n💥 TEST FAILED WITH ERROR:');
    console.error(error);
    console.log('='.repeat(80));
  } finally {
    // Close the connection
    if (mongooseConnection) {
      await mongooseConnection.disconnect();
      console.log('📡 Disconnected from MongoDB');
    }
  }
}

// Run the test
if (require.main === module) {
  testDividendSystem()
    .then(() => {
      console.log('\n🏁 Test script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test script failed:', error);
      process.exit(1);
    });
}
