/**
 * Manual Dividend Booking Script for Single Portfolio
 * Run dividend booking for one specific portfolio (equivalent to the daily cron job but for one portfolio)
 */

require('dotenv').config({ path: './.env' });
const { connect } = require('mongoose');
const { checkPortfolioDividends } = require('./dist/services/dividends/checker');
const { autobookDividends } = require('./dist/services/dividends/autoBooker');
const { PortfolioModel } = require('./dist/models/portfolio');
const logger = require('./dist/utils/logger');

const dbConnection = {
  url: process.env.MONGODB_URI,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
};

async function processPortfolioDividends(portfolioId) {
  console.log('💰 Manual Dividend Booking for Single Portfolio');
  console.log('='.repeat(60));
  console.log(`Portfolio ID: ${portfolioId}`);

  try {
    // Check if portfolio exists and has auto-booking enabled
    console.log('\n📊 Checking portfolio...');
    const portfolio = await PortfolioModel.findById(portfolioId);

    if (!portfolio) {
      throw new Error(`Portfolio with ID ${portfolioId} not found`);
    }

    console.log(`Portfolio Name: ${portfolio.name}`);
    console.log(`Auto-booking enabled: ${portfolio.bookDividends || false}`);

    if (!portfolio.bookDividends) {
      console.log('⚠️  Portfolio does not have automatic dividend booking enabled');
      console.log('   Set bookDividends: true in the portfolio to enable auto-booking');
      return;
    }

    console.log('\n🏃 Checking for new dividends...');

    // Run the normal dividend check process (same as the daily cron job)
    const checkResult = await checkPortfolioDividends(portfolioId);

    if (!checkResult.success) {
      console.log('❌ Failed to check dividends:');
      console.log(`   Error: ${checkResult.error}`);
      return;
    }

    const dividendsFound = checkResult.dividends.length;
    console.log(`📈 Dividends found: ${dividendsFound}`);

    if (dividendsFound === 0) {
      console.log('ℹ️  No dividends found for this portfolio');
      return;
    }

    // Show dividend details
    console.log('\n📋 Dividend Details:');
    checkResult.dividends.forEach((dividend, index) => {
      console.log(`   ${index + 1}. ${dividend.symbol}: ${dividend.amount} ${dividend.currency} (Ex-date: ${dividend.exDate})`);
    });

    // Auto-book the dividends
    console.log('\n💰 Auto-booking dividends...');
    const bookingResult = await autobookDividends(portfolioId, checkResult.dividends);

    const dividendsBooked = bookingResult.bookedCount;
    console.log(`📈 Dividends booked: ${dividendsBooked}`);

    if (bookingResult.errors.length > 0) {
      console.log('\n⚠️  Booking Errors:');
      bookingResult.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (dividendsBooked > 0) {
      console.log('\n✅ Dividend booking completed successfully!');
      console.log(`   ${dividendsBooked} dividends were booked for portfolio "${portfolio.name}"`);
    } else {
      console.log('\nℹ️  No dividends were booked');
    }

  } catch (error) {
    console.error('❌ Backtesting failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Get portfolio ID from command line argument
const portfolioId = process.argv[2];

if (!portfolioId) {
  console.log('❌ Usage: node test-dividend-portfolio.js <portfolioId>');
  console.log('📝 Example: node test-dividend-portfolio.js 691ab9c6ec4b06ab7fc55e08');
  process.exit(1);
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  try {
    await connect(dbConnection.url, dbConnection.options);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  await processPortfolioDividends(portfolioId);

  console.log('\n🔌 Disconnecting from MongoDB...');
  process.exit(0);
}

main();
