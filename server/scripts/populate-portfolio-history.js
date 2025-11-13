/**
 * Portfolio History Population Script
 *
 * One-time script to populate cached history for all existing portfolios.
 * Run with: node scripts/populate-portfolio-history.js
 */

require('dotenv').config({ path: './.env' });
const { connect } = require('mongoose');
const { dbConnection } = require('../dist/db');
const { PortfolioModel } = require('../dist/models/portfolio');
const { PortfolioHistoryCache } = require('../dist/services/portfolio/historyCache');
const { PortfolioHistoryService } = require('../dist/services/portfolio/historyService');

class PortfolioHistoryPopulator {
  constructor() {
    this.stats = {
      totalPortfolios: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      totalRecords: 0,
      startTime: new Date()
    };
  }

  async connect() {
    console.log('🔌 Connecting to MongoDB...');
    await connect(dbConnection.url, dbConnection.options);
    console.log('✅ Connected to MongoDB');
  }

  async getPortfoliosToProcess() {
    console.log('📊 Finding portfolios to process...');

    // Get all portfolios, prioritizing recently active ones
    const portfolios = await PortfolioModel.find({})
      .sort({ updatedAt: -1 }) // Process recently updated portfolios first
      .lean();

    console.log(`📊 Found ${portfolios.length} portfolios to process`);
    return portfolios;
  }

  async processPortfolio(portfolio) {
    const portfolioId = portfolio._id.toString();
    console.log(`\n📈 Processing portfolio: ${portfolio.name} (${portfolioId})`);

    try {
      // Check if portfolio already has fresh cached history
      const hasFreshData = await PortfolioHistoryService.hasRecentData(portfolioId, 24); // 24 hours

      if (hasFreshData) {
        console.log(`   ⏭️  Skipping - already has fresh cached data`);
        this.stats.skipped++;
        return;
      }

      // Calculate and cache history
      const startTime = Date.now();
      const result = await PortfolioHistoryCache.updateHistory(portfolioId);

      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`   ✅ Success - ${result.recordsUpdated} records in ${duration}ms`);
        this.stats.processed++;
        this.stats.totalRecords += result.recordsUpdated;
      } else {
        console.log(`   ❌ Failed - ${result.error}`);
        this.stats.errors++;
      }

    } catch (error) {
      console.error(`   💥 Error processing portfolio ${portfolioId}:`, error.message);
      this.stats.errors++;
    }
  }

  async processInBatches(portfolios, batchSize = 5) {
    console.log(`\n🏃 Starting batch processing (${batchSize} portfolios per batch)...`);

    for (let i = 0; i < portfolios.length; i += batchSize) {
      const batch = portfolios.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(portfolios.length / batchSize);

      console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} portfolios)`);

      // Process batch concurrently
      await Promise.allSettled(
        batch.map(portfolio => this.processPortfolio(portfolio))
      );

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < portfolios.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  printSummary() {
    const duration = Date.now() - this.stats.startTime.getTime();
    const durationMinutes = Math.round(duration / 1000 / 60);

    console.log('\n' + '='.repeat(60));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total portfolios found: ${this.stats.totalPortfolios}`);
    console.log(`Successfully processed: ${this.stats.processed}`);
    console.log(`Skipped (fresh data): ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Total records created: ${this.stats.totalRecords}`);
    console.log(`Total time: ${durationMinutes} minutes`);
    console.log(`Average time per portfolio: ${Math.round(duration / this.stats.totalPortfolios)}ms`);

    const successRate = ((this.stats.processed + this.stats.skipped) / this.stats.totalPortfolios * 100).toFixed(1);
    console.log(`Success rate: ${successRate}%`);

    if (this.stats.errors > 0) {
      console.log(`\n⚠️  ${this.stats.errors} portfolios had errors. Check logs above for details.`);
    }

    console.log('\n✅ Portfolio history population complete!');
    console.log('   All portfolios now have cached history data.');
    console.log('   Future requests will be served instantly from cache.');
    console.log('='.repeat(60));
  }

  async run() {
    try {
      await this.connect();

      const portfolios = await this.getPortfoliosToProcess();
      this.stats.totalPortfolios = portfolios.length;

      if (portfolios.length === 0) {
        console.log('❌ No portfolios found to process');
        return;
      }

      await this.processInBatches(portfolios);

      this.printSummary();

    } catch (error) {
      console.error('💥 Population script failed:', error);
      process.exit(1);
    }
  }
}

// Run the population script
if (require.main === module) {
  const populator = new PortfolioHistoryPopulator();
  populator.run().catch(console.error);
}

module.exports = { PortfolioHistoryPopulator };
