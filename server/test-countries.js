/**
 * Test script to check countries endpoint
 * Run with: node test-countries.js
 */

require('dotenv').config({ path: './.env' });

const fetch = require('node-fetch');

async function testCountriesEndpoint() {
  const baseUrl = process.env.APP_PORT || 'http://localhost:3002';
  const url = `${baseUrl}/countries`;

  console.log(`Testing countries endpoint: ${url}`);

  try {
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Retrieved countries:');
      console.log(`   Total countries: ${data.length}`);
      console.log('   Sample:', data.slice(0, 3));
      return true;
    } else {
      console.log('❌ Failed! Response status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Error fetching countries:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCountriesEndpoint().then(success => {
    if (success) {
      console.log('\nTest passed!');
      process.exit(0);
    } else {
      console.log('\nTest failed!');
      process.exit(1);
    }
  });
}

module.exports = { testCountriesEndpoint };
