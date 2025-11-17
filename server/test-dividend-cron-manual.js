/**
 * Manual Test for Dividend Booking Cron Job
 * Run the dividend booking cron job immediately for testing
 */

require('dotenv').config({ path: './.env' });
const { dividendCronJob } = require('./dist/jobs/dividendCronJob');

async function testDividendCronManually() {
  console.log('🧪 Testing Dividend Booking Cron Job Manually');
  console.log('='.repeat(60));

  try {
    console.log('📊 Cron job status before running:');
    const statusBefore = dividendCronJob.getStatus();
    console.log(`   Running: ${statusBefore.isRunning}`);
    console.log(`   Scheduled: ${statusBefore.isScheduled}`);
    console.log(`   Next run: ${statusBefore.nextRun || 'Not scheduled'}`);

    console.log('\n🏃 Running dividend booking cron job manually...');
    const stats = await dividendCronJob.runNow();

    console.log('\n📈 Dividend Booking Cron Job Results:');
    console.log('='.repeat(40));
    console.log(`Portfolios processed: ${stats.portfoliosProcessed}`);
    console.log(`Portfolios skipped: ${stats.portfoliosSkipped}`);
    console.log(`Total dividends found: ${stats.totalDividendsFound}`);
    console.log(`Total dividends booked: ${stats.totalDividendsBooked}`);
    console.log(`Total errors: ${stats.totalErrors}`);
    console.log(`Duration: ${stats.duration}ms`);

    if (stats.totalDividendsFound > 0 || stats.totalDividendsBooked > 0) {
      console.log('\n✅ Dividend booking executed successfully!');
      console.log(`   ${stats.totalDividendsFound} dividends found, ${stats.totalDividendsBooked} booked.`);
    } else {
      console.log('\nℹ️  Dividend booking completed - no new dividends to book');
    }

    console.log('\n📊 Cron job status after running:');
    const statusAfter = dividendCronJob.getStatus();
    console.log(`   Running: ${statusAfter.isRunning}`);
    console.log(`   Scheduled: ${statusAfter.isScheduled}`);
    console.log(`   Next run: ${statusAfter.nextRun || 'Not scheduled'}`);

  } catch (error) {
    console.error('❌ Dividend booking cron job test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testDividendCronManually();
