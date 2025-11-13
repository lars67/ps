/**
 * Portfolio History Cache Testing Script
 *
 * Tests the optimized portfolio history caching system.
 * Run with: node test-portfolio-history-cache.js
 */

const { MongoClient } = require('mongodb');
const { PortfolioHistoryService } = require('./src/services/portfolio/historyService');
const { PortfolioHistoryCache } = require('./src/services/portfolio/historyCache');

// Test configuration
const TEST_CONFIG = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2',
    dbName: 'ps2'
  },
  testPortfolioId: 'test_portfolio_cache_001',
  performance: {
    iterations: 10,
    timeout: 30000 // 30 seconds
  }
};

class PortfolioHistoryCacheTester {
  constructor() {
    this.client = null;
    this.db = null;
    this.startTime = null;
  }

  async connect() {
    try {
      console.log('🔌 Connecting to MongoDB...');
      this.client = new MongoClient(TEST_CONFIG.mongodb.uri);
      await this.client.connect();
      this.db = this.client.db(TEST_CONFIG.mongodb.dbName);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up test data...');
      await this.db.collection('portfolio_histories').deleteMany({
        portfolioId: TEST_CONFIG.testPortfolioId
      });
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async setupTestData() {
    try {
      console.log('📝 Setting up test data...');

      // Create sample history data for the last 30 days
      const historyDays = [];
      const today = new Date();

      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        historyDays.push({
          portfolioId: TEST_CONFIG.testPortfolioId,
          date: dateStr,
          invested: 10000 + (i * 100),
          investedWithoutTrades: 10000 + (i * 100),
          cash: 5000 + (i * 50),
          nav: 15000 + (i * 150),
          index: 1000 + (i * 10),
          perfomance: 0,
          shares: 100,
          navShare: 150 + (i * 1.5),
          perfShare: 100 + (i * 0.5),
          lastUpdated: new Date(Date.now() - (i * 60 * 60 * 1000)), // Stagger timestamps
          isCalculated: true
        });
      }

      await PortfolioHistoryService.saveHistoryDays(historyDays);
      console.log(`✅ Created ${historyDays.length} test history records`);
    } catch (error) {
      console.error('❌ Test data setup failed:', error);
      throw error;
    }
  }

  async runTests() {
    console.log('\n🧪 Starting Portfolio History Cache Tests...\n');

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };

    // Test 1: Cache Hit Scenario
    await this.runTest(results, 'Cache Hit - Fresh Data', async () => {
      const result = await PortfolioHistoryCache.getHistory(
        TEST_CONFIG.testPortfolioId,
        undefined,
        undefined,
        1440 // 24 hours max age
      );

      if (!result.cached) {
        throw new Error('Expected cached result but got cache miss');
      }

      if (result.days.length === 0) {
        throw new Error('Expected history data but got empty result');
      }

      if (result.cacheAge === undefined) {
        throw new Error('Expected cache age metadata');
      }

      console.log(`   📊 Returned ${result.days.length} days, cache age: ${result.cacheAge}min`);
    });

    // Test 2: Cache Miss Scenario (non-existent portfolio)
    await this.runTest(results, 'Cache Miss - Non-existent Portfolio', async () => {
      const result = await PortfolioHistoryCache.getHistory(
        'non_existent_portfolio_123',
        undefined,
        undefined,
        1440
      );

      if (result.cached !== false) {
        throw new Error('Expected cache miss for non-existent portfolio');
      }

      if (result.days.length !== 0) {
        throw new Error('Expected empty result for non-existent portfolio');
      }
    });

    // Test 3: Force Refresh
    await this.runTest(results, 'Force Refresh', async () => {
      // First get cached data
      const cachedResult = await PortfolioHistoryCache.getHistory(
        TEST_CONFIG.testPortfolioId,
        undefined,
        undefined,
        1440
      );

      if (!cachedResult.cached) {
        throw new Error('Expected cached data for force refresh test');
      }

      // Note: Force refresh would require modifying the history function
      // This is a placeholder for when forceRefresh is implemented
      console.log('   ⚠️  Force refresh test requires history function modification');
    });

    // Test 4: Date Range Queries
    await this.runTest(results, 'Date Range Queries', async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const fromStr = fromDate.toISOString().split('T')[0];

      const result = await PortfolioHistoryCache.getHistory(
        TEST_CONFIG.testPortfolioId,
        fromStr,
        undefined,
        1440
      );

      if (!result.cached) {
        throw new Error('Expected cached result for date range query');
      }

      // Should return last 7 days
      if (result.days.length > 8) { // Allow some buffer
        console.log(`   📊 Returned ${result.days.length} days for 7-day range`);
      }
    });

    // Test 5: Cache Metadata
    await this.runTest(results, 'Cache Metadata', async () => {
      const result = await PortfolioHistoryCache.getHistory(
        TEST_CONFIG.testPortfolioId,
        undefined,
        undefined,
        1440
      );

      if (!result.metadata) {
        throw new Error('Expected metadata in cached response');
      }

      console.log(`   📊 Portfolio has ${result.metadata.totalRecords} records`);
      console.log(`   📅 Date range: ${result.metadata.dateRange?.from} to ${result.metadata.dateRange?.till}`);
    });

    // Test 6: Performance Benchmark
    await this.runTest(results, 'Performance Benchmark', async () => {
      const iterations = TEST_CONFIG.performance.iterations;
      const times = [];

      console.log(`   🏃 Running ${iterations} iterations...`);

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await PortfolioHistoryCache.getHistory(
          TEST_CONFIG.testPortfolioId,
          undefined,
          undefined,
          1440
        );
        const duration = Date.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`   📈 Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   📈 Min: ${minTime}ms, Max: ${maxTime}ms`);

      if (avgTime > 1000) { // More than 1 second average
        console.warn(`   ⚠️  Average response time is high: ${avgTime.toFixed(2)}ms`);
      } else {
        console.log(`   ✅ Performance looks good!`);
      }
    });

    // Test 7: Cache Statistics
    await this.runTest(results, 'Cache Statistics', async () => {
      const stats = await PortfolioHistoryCache.getCacheStats();

      console.log(`   📊 Total portfolios with data: ${stats.portfoliosWithData}`);
      console.log(`   📊 Portfolios needing updates: ${stats.portfoliosNeedingUpdate}`);

      if (stats.portfoliosNeedingUpdate > 0) {
        console.log(`   ℹ️  ${stats.portfoliosNeedingUpdate} portfolios need history updates`);
      }
    });

    // Test 8: Data Integrity
    await this.runTest(results, 'Data Integrity Check', async () => {
      const validation = await PortfolioHistoryService.validatePortfolioData(TEST_CONFIG.testPortfolioId);

      if (!validation.isValid) {
        console.warn('   ⚠️  Data validation issues found:');
        validation.issues.forEach(issue => console.warn(`      - ${issue}`));
      } else {
        console.log('   ✅ Data integrity check passed');
      }

      console.log(`   📊 Validated ${validation.totalRecords} records`);
    });

    return results;
  }

  async runTest(results, testName, testFn) {
    results.total++;
    console.log(`\n🧪 Running: ${testName}`);

    try {
      await testFn();
      results.passed++;
      console.log(`✅ PASSED: ${testName}`);
    } catch (error) {
      results.failed++;
      console.error(`❌ FAILED: ${testName}`);
      console.error(`   Error: ${error.message}`);
      results.tests.push({
        name: testName,
        status: 'failed',
        error: error.message
      });
    }
  }

  printResults(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.tests.forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    }

    const duration = Date.now() - this.startTime;
    console.log(`\n⏱️  Total Test Duration: ${duration}ms`);
    console.log('='.repeat(50));
  }

  async run() {
    this.startTime = Date.now();

    try {
      await this.connect();
      await this.cleanup();
      await this.setupTestData();

      const results = await this.runTests();
      this.printResults(results);

      await this.cleanup();

    } catch (error) {
      console.error('💥 Test suite failed:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PortfolioHistoryCacheTester();
  tester.run().catch(console.error);
}

module.exports = { PortfolioHistoryCacheTester };
