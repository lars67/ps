/**
 * Test Portfolio History Optimization with Real Portfolio
 *
 * Tests the caching system using your real portfolio: 690207ef49a013b6016e75a6
 * Run with: node test-real-portfolio.js
 */

// Load environment variables
require('dotenv').config({ path: './.env' });

// Initialize database connection
const { connect } = require('mongoose');
const { dbConnection } = require('./dist/db');

const { PortfolioHistoryCache } = require('./dist/services/portfolio/historyCache');
const { PortfolioHistoryService } = require('./dist/services/portfolio/historyService');

const REAL_PORTFOLIO_ID = '690207ef49a013b6016e75a6';

async function testRealPortfolio() {
  console.log('🧪 Testing Portfolio History Optimization');
  console.log('📊 Using Real Portfolio ID:', REAL_PORTFOLIO_ID);
  console.log('='.repeat(60));

  // Initialize database connection
  console.log('🔌 Connecting to MongoDB...');
  await connect(dbConnection.url, dbConnection.options);
  console.log('✅ Connected to MongoDB');

  try {
    // Test 1: Check if portfolio has any cached history
    console.log('\n1️⃣ Checking for existing cached history...');
    const existingMetadata = await PortfolioHistoryService.getMetadata(REAL_PORTFOLIO_ID);

    if (existingMetadata && existingMetadata.totalRecords > 0) {
      console.log('✅ Found existing cached history!');
      console.log(`   📊 ${existingMetadata.totalRecords} records`);
      console.log(`   📅 Date range: ${existingMetadata.dateRange?.from} to ${existingMetadata.dateRange?.till}`);
      console.log(`   🕒 Last updated: ${existingMetadata.lastUpdated.toISOString()}`);
    } else {
      console.log('❌ No cached history found - this will be a cache miss test');
    }

    // Test 2: First request (will calculate if no cache exists)
    console.log('\n2️⃣ First history request (cache miss expected)...');
    const startTime1 = Date.now();

    const result1 = await PortfolioHistoryCache.getHistory(
      REAL_PORTFOLIO_ID,
      undefined, // from
      undefined, // till
      1440 // 24 hours max age
    );

    const duration1 = Date.now() - startTime1;

    console.log(`⏱️ First request took: ${duration1}ms`);

    if (result1.cached) {
      console.log('✅ Served from cache (portfolio already had history)');
      console.log(`📊 Returned ${result1.days.length} days`);
    } else {
      console.log('⚡ Cache miss - calculating from scratch (expected for first run)');
      console.log('📝 This creates the portfolio_histories collection!');
    }

    // Test 3: Second request (should be instant cache hit)
    console.log('\n3️⃣ Second history request (cache hit expected)...');
    const startTime2 = Date.now();

    const result2 = await PortfolioHistoryCache.getHistory(
      REAL_PORTFOLIO_ID,
      undefined,
      undefined,
      1440
    );

    const duration2 = Date.now() - startTime2;

    console.log(`⏱️ Second request took: ${duration2}ms`);

    if (result2.cached && duration2 < 100) {
      console.log('✅ INSTANT CACHE HIT! 🚀');
      console.log(`📊 Returned ${result2.days.length} days`);
      console.log(`🕒 Cache age: ${result2.cacheAge} minutes`);
    } else {
      console.log('⚠️ Not a cache hit or took too long');
    }

    // Test 4: Performance comparison
    console.log('\n4️⃣ Performance Analysis');
    console.log('='.repeat(40));

    if (result1.cached && result2.cached) {
      console.log('📊 Both requests served from cache');
      console.log(`   First:  ${duration1}ms`);
      console.log(`   Second: ${duration2}ms`);
    } else if (!result1.cached && result2.cached) {
      console.log('📊 Cache miss → Cache hit scenario');
      console.log(`   Cache miss (calculation): ${duration1}ms`);
      console.log(`   Cache hit (instant):       ${duration2}ms`);
      const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);
      console.log(`   🚀 Improvement: ${improvement}% faster`);
    }

    // Test 5: Data integrity check
    console.log('\n5️⃣ Data Integrity Check');
    const validation = await PortfolioHistoryService.validatePortfolioData(REAL_PORTFOLIO_ID);

    if (validation.isValid) {
      console.log('✅ Data integrity check passed');
      console.log(`📊 Validated ${validation.totalRecords} records`);
    } else {
      console.log('⚠️ Data integrity issues found:');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    // Test 6: MongoDB collection verification
    console.log('\n6️⃣ MongoDB Collection Status');
    const metadata = await PortfolioHistoryService.getMetadata(REAL_PORTFOLIO_ID);

    if (metadata) {
      console.log('✅ portfolio_histories collection created/populated');
      console.log(`📊 Total records: ${metadata.totalRecords}`);
      console.log(`📅 Date range: ${metadata.dateRange?.from} → ${metadata.dateRange?.till}`);
      console.log(`🕒 Last updated: ${metadata.lastUpdated.toISOString()}`);
      console.log(`📈 Status: ${metadata.calculationStatus}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST COMPLETE - Check MongoDB Compass now!');
    console.log('   You should see: portfolio_histories collection');
    console.log('   With documents for portfolio:', REAL_PORTFOLIO_ID);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Test failed:', error);
    console.error('Error details:', error.message);

    if (error.message.includes('Portfolio not found')) {
      console.log('\n💡 Suggestion: Verify the portfolio ID exists in your database');
      console.log('   Check: db.portfolios.findOne({"_id": ObjectId("' + REAL_PORTFOLIO_ID + '")})');
    }
  }
}

// Run the test
if (require.main === module) {
  testRealPortfolio().catch(console.error);
}

module.exports = { testRealPortfolio };
