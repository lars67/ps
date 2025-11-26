/**
 * Manual Portfolio History Cron Job Test
 * Forces the portfolio history cron job to run immediately for testing
 * Run with: node test-run-cron.js
 */

const { portfolioHistoryCronJob } = require('./dist/jobs/portfolioHistoryCronJob');

async function runCronTest() {
  console.log('🔧 Testing Portfolio History Cron Job\n');
  console.log('=' .repeat(50));

  try {
    console.log('📅 Forcing portfolio history maintenance...');
    const stats = await portfolioHistoryCronJob.runNow();

    console.log('\n✅ Cron job completed!');
    console.log('📊 Results:');
    console.log(`   Portfolios processed: ${stats.portfoliosProcessed}`);
    console.log(`   Records updated: ${stats.totalRecordsUpdated}`);
    console.log(`   Gaps detected: ${stats.gapsDetected}`);
    console.log(`   Gaps filled: ${stats.gapsFilled}`);
    console.log(`   Old records cleaned: ${stats.oldRecordsCleaned}`);
    console.log(`   Duration: ${Math.round(stats.duration / 1000)} seconds`);

    if (stats.totalRecordsUpdated > 0) {
      console.log('\n🎯 SUCCESS: Incremental updates working!');
      console.log(`   Updated ${stats.totalRecordsUpdated} records incrementally`);
    } else {
      console.log('\n📌 No updates needed (data already fresh)');
    }

  } catch (error) {
    console.error('❌ Cron job failed:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Manual cron test complete');
}

if (require.main === module) {
  runCronTest();
}
