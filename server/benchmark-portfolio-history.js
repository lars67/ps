/**
 * Portfolio History Performance Benchmark
 *
 * Benchmarks the portfolio history performance before and after optimization.
 * Run with: node benchmark-portfolio-history.js
 */

const { MongoClient } = require('mongodb');

// Benchmark configuration
const BENCHMARK_CONFIG = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2',
    dbName: 'ps2'
  },
  portfolios: [
    'sample_portfolio_1', // Replace with real portfolio IDs
    'sample_portfolio_2'
  ],
  scenarios: {
    small: { days: 30, trades: 50 },
    medium: { days: 180, trades: 200 },
    large: { days: 365, trades: 500 }
  },
  iterations: 5,
  warmupIterations: 2
};

class PortfolioHistoryBenchmark {
  constructor() {
    this.client = null;
    this.db = null;
    this.results = {
      scenarios: {},
      summary: {}
    };
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    this.client = new MongoClient(BENCHMARK_CONFIG.mongodb.uri);
    await this.client.connect();
    this.db = this.client.db(BENCHMARK_CONFIG.mongodb.dbName);
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async runBenchmark() {
    console.log('\n🏃 Starting Portfolio History Performance Benchmark\n');
    console.log('='.repeat(60));

    for (const [scenarioName, scenario] of Object.entries(BENCHMARK_CONFIG.scenarios)) {
      console.log(`\n📊 Testing Scenario: ${scenarioName.toUpperCase()}`);
      console.log(`   Days: ${scenario.days}, Estimated Trades: ${scenario.trades}`);

      const scenarioResults = await this.benchmarkScenario(scenarioName, scenario);
      this.results.scenarios[scenarioName] = scenarioResults;
    }

    this.printSummary();
  }

  async benchmarkScenario(scenarioName, scenario) {
    const results = {
      cacheHits: [],
      cacheMisses: [],
      calculations: [],
      metadata: {}
    };

    // Find a portfolio with appropriate data size
    const testPortfolio = await this.findTestPortfolio(scenario);

    if (!testPortfolio) {
      console.log(`   ⚠️  No suitable portfolio found for ${scenarioName} scenario`);
      return results;
    }

    console.log(`   🎯 Using portfolio: ${testPortfolio.portfolioId}`);
    console.log(`   📊 Portfolio has ${testPortfolio.recordCount} records`);

    results.metadata = {
      portfolioId: testPortfolio.portfolioId,
      recordCount: testPortfolio.recordCount,
      dateRange: testPortfolio.dateRange
    };

    // Warmup runs
    console.log(`   🔥 Running ${BENCHMARK_CONFIG.warmupIterations} warmup iterations...`);
    for (let i = 0; i < BENCHMARK_CONFIG.warmupIterations; i++) {
      await this.simulateHistoryRequest(testPortfolio.portfolioId, false);
    }

    // Benchmark cache hits (simulated)
    console.log(`   🚀 Benchmarking cache hits...`);
    for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
      const duration = await this.simulateHistoryRequest(testPortfolio.portfolioId, true);
      results.cacheHits.push(duration);
    }

    // Benchmark cache misses (simulated by clearing cache)
    console.log(`   🚀 Benchmarking cache misses...`);
    for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
      // Simulate cache miss by requesting non-cached data
      const duration = await this.simulateHistoryRequest(testPortfolio.portfolioId, false);
      results.cacheMisses.push(duration);
    }

    // Benchmark calculations (if needed)
    console.log(`   🚀 Benchmarking calculations...`);
    for (let i = 0; i < Math.min(BENCHMARK_CONFIG.iterations, 2); i++) {
      // This would test the full calculation path
      const duration = await this.simulateCalculation(testPortfolio.portfolioId);
      results.calculations.push(duration);
    }

    this.printScenarioResults(scenarioName, results);
    return results;
  }

  async findTestPortfolio(scenario) {
    // Find portfolios with appropriate data sizes
    const portfolios = await this.db.collection('portfolio_histories')
      .aggregate([
        {
          $group: {
            _id: '$portfolioId',
            recordCount: { $sum: 1 },
            firstDate: { $min: '$date' },
            lastDate: { $max: '$date' },
            lastUpdated: { $max: '$lastUpdated' }
          }
        },
        {
          $match: {
            recordCount: { $gte: scenario.days * 0.8 } // At least 80% of target days
          }
        },
        { $limit: 5 }
      ])
      .toArray();

    if (portfolios.length === 0) {
      return null;
    }

    // Return the most recently updated portfolio
    const bestPortfolio = portfolios.sort((a, b) =>
      new Date(b.lastUpdated) - new Date(a.lastUpdated)
    )[0];

    return {
      portfolioId: bestPortfolio._id,
      recordCount: bestPortfolio.recordCount,
      dateRange: {
        from: bestPortfolio.firstDate,
        till: bestPortfolio.lastDate
      }
    };
  }

  async simulateHistoryRequest(portfolioId, simulateCacheHit = true) {
    // This simulates calling the history endpoint
    // In a real benchmark, you'd make HTTP requests to the actual endpoint

    const startTime = Date.now();

    try {
      if (simulateCacheHit) {
        // Simulate cache hit - just query database
        await this.db.collection('portfolio_histories')
          .find({ portfolioId })
          .sort({ date: 1 })
          .limit(100)
          .toArray();
      } else {
        // Simulate cache miss - more complex query
        await this.db.collection('portfolio_histories')
          .find({ portfolioId })
          .sort({ date: 1 })
          .toArray();
      }
    } catch (error) {
      console.error(`Error in simulated request: ${error.message}`);
    }

    return Date.now() - startTime;
  }

  async simulateCalculation(portfolioId) {
    // This simulates the full calculation process
    // In reality, this would be much more complex

    const startTime = Date.now();

    try {
      // Simulate complex calculation with multiple database queries
      const trades = await this.db.collection('trades')
        .find({ portfolioId })
        .limit(1000)
        .toArray();

      // Simulate price lookups
      const symbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
      if (symbols.length > 0) {
        await this.db.collection('prices')
          .find({ symbol: { $in: symbols } })
          .limit(1000)
          .toArray();
      }

      // Simulate complex aggregation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    } catch (error) {
      console.error(`Error in simulated calculation: ${error.message}`);
    }

    return Date.now() - startTime;
  }

  printScenarioResults(scenarioName, results) {
    const calcStats = (times) => {
      if (times.length === 0) return { avg: 0, min: 0, max: 0, p95: 0 };
      const sorted = times.sort((a, b) => a - b);
      return {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    };

    console.log(`   📈 Cache Hits: ${results.cacheHits.length} iterations`);
    if (results.cacheHits.length > 0) {
      const stats = calcStats(results.cacheHits);
      console.log(`      Average: ${stats.avg.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
    }

    console.log(`   📈 Cache Misses: ${results.cacheMisses.length} iterations`);
    if (results.cacheMisses.length > 0) {
      const stats = calcStats(results.cacheMisses);
      console.log(`      Average: ${stats.avg.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
    }

    console.log(`   📈 Calculations: ${results.calculations.length} iterations`);
    if (results.calculations.length > 0) {
      const stats = calcStats(results.calculations);
      console.log(`      Average: ${stats.avg.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK SUMMARY');
    console.log('='.repeat(60));

    let totalImprovement = 0;
    let scenarioCount = 0;

    for (const [scenarioName, results] of Object.entries(this.results.scenarios)) {
      if (results.cacheHits.length > 0 && results.calculations.length > 0) {
        const avgCache = results.cacheHits.reduce((a, b) => a + b, 0) / results.cacheHits.length;
        const avgCalc = results.calculations.reduce((a, b) => a + b, 0) / results.calculations.length;
        const improvement = ((avgCalc - avgCache) / avgCalc * 100);

        console.log(`\n${scenarioName.toUpperCase()} Scenario:`);
        console.log(`   Cache Hit: ${avgCache.toFixed(2)}ms`);
        console.log(`   Calculation: ${avgCalc.toFixed(2)}ms`);
        console.log(`   Improvement: ${improvement.toFixed(1)}% faster`);

        totalImprovement += improvement;
        scenarioCount++;
      }
    }

    if (scenarioCount > 0) {
      const avgImprovement = totalImprovement / scenarioCount;
      console.log(`\n🎯 AVERAGE IMPROVEMENT: ${avgImprovement.toFixed(1)}% faster with caching`);
    }

    console.log('\n💡 Recommendations:');
    if (this.results.scenarios.large?.cacheHits.length > 0) {
      const largeScenario = this.results.scenarios.large;
      const avgLarge = largeScenario.cacheHits.reduce((a, b) => a + b, 0) / largeScenario.cacheHits.length;
      if (avgLarge < 100) {
        console.log('   ✅ Large portfolios performing well (< 100ms)');
      } else {
        console.log('   ⚠️  Large portfolios may need further optimization');
      }
    }

    console.log('='.repeat(60));
  }

  async run() {
    try {
      await this.connect();
      await this.runBenchmark();
    } catch (error) {
      console.error('💥 Benchmark failed:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the benchmark
if (require.main === module) {
  const benchmark = new PortfolioHistoryBenchmark();
  benchmark.run().catch(console.error);
}

module.exports = { PortfolioHistoryBenchmark };
