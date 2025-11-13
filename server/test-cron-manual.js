/**
 * Manual Test for Portfolio History Cron Job
 * Run the cron job immediately for testing
 */

require('dotenv').config({ path: './.env' });
const { portfolioHistoryCronJob } = require('./dist/jobs/portfolioHistoryCronJob');

async function testCronManually() {
  console.log('🧪 Testing Portfolio History Cron Job Manually');
  console.log('='.repeat(60));

  try {
    console.log('📊 Cron job status before running:');
    const statusBefore = portfolioHistoryCronJob.getStatus();
    console.log(`   Running: ${statusBefore.isRunning}`);
    console.log(`   Scheduled: ${statusBefore.isScheduled}`);
    console.log(`   Schedule: ${statusBefore.schedule}`);
    console.log(`   Next run: ${statusBefore.nextRun || 'Not scheduled'}`);

    console.log('\n🏃 Running cron job manually...');
    const stats = await portfolioHistoryCronJob.runNow();

    console.log('\n📈 Cron Job Results:');
    console.log('='.repeat(30));
    console.log(`Portfolios processed: ${stats.portfoliosProcessed}`);
    console.log(`Portfolios skipped: ${stats.portfoliosSkipped}`);
    console.log(`Portfolios with errors: ${stats.portfoliosWithErrors}`);
    console.log(`Records updated: ${stats.totalRecordsUpdated}`);
    console.log(`Gaps detected: ${stats.gapsDetected}`);
    console.log(`Gaps filled: ${stats.gapsFilled}`);
    console.log(`Old records cleaned: ${stats.oldRecordsCleaned}`);
    console.log(`Duration: ${Math.round(stats.duration / 1000 / 60)} minutes`);

    if (stats.portfoliosProcessed > 0 || stats.totalRecordsUpdated > 0) {
      console.log('\n✅ Cron job executed successfully!');
      console.log('   Portfolio history cache has been updated.');
    } else {
      console.log('\nℹ️  Cron job completed - no updates needed (data is fresh)');
    }

    console.log('\n📊 Cron job status after running:');
    const statusAfter = portfolioHistoryCronJob.getStatus();
    console.log(`   Running: ${statusAfter.isRunning}`);
    console.log(`   Scheduled: ${statusAfter.isScheduled}`);
    console.log(`   Next run: ${statusAfter.nextRun || 'Not scheduled'}`);

  } catch (error) {
    console.error('❌ Cron job test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testCronManually();
