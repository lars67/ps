const axios = require('axios');

// EODHD API Configuration
const EODHD_API_KEY = '694cf60f519de1.38210953'; // Same key from iex-proxy
const BASE_URL = 'https://eodhd.com/api';

/**
 * Test EODHD API - Get real-time quotes
 */
async function testRealtimeQuotes(symbols) {
  console.log('\n=== Testing EODHD Real-time Quotes ===');

  if (!Array.isArray(symbols)) {
    symbols = [symbols];
  }

  try {
    // Build API URL for multiple symbols
    const primarySymbol = symbols[0];
    const additionalSymbols = symbols.slice(1);

    let url = `${BASE_URL}/real-time/${primarySymbol}?api_token=${EODHD_API_KEY}&fmt=json`;

    if (additionalSymbols.length > 0) {
      url += `&s=${additionalSymbols.join(',')}`;
    }

    console.log(`Requesting quotes for: ${symbols.join(', ')}`);
    console.log(`URL: ${url}`);

    const response = await axios.get(url);
    const data = response.data;

    console.log('Response status:', response.status);
    console.log('Raw response:', JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error('Error fetching real-time quotes:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Test EODHD API - Get historical prices
 */
async function testHistoricalPrices(symbol, period = 'd', from = null, to = null) {
  console.log('\n=== Testing EODHD Historical Prices ===');

  try {
    let url = `${BASE_URL}/eod/${symbol}?api_token=${EODHD_API_KEY}&period=${period}&fmt=json`;

    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;

    console.log(`Requesting historical data for: ${symbol}`);
    console.log(`Period: ${period}, From: ${from}, To: ${to}`);
    console.log(`URL: ${url}`);

    const response = await axios.get(url);
    const data = response.data;

    console.log('Response status:', response.status);
    console.log(`Data points: ${data.length}`);

    if (data.length > 0) {
      console.log('First data point:', data[0]);
      console.log('Last data point:', data[data.length - 1]);
    } else {
      console.log('No data returned');
    }

    return data;
  } catch (error) {
    console.error('Error fetching historical prices:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Test EODHD API - Search for symbols
 */
async function testSymbolSearch(query, limit = 10) {
  console.log('\n=== Testing EODHD Symbol Search ===');

  try {
    const url = `${BASE_URL}/search/${query}?api_token=${EODHD_API_KEY}&limit=${limit}&fmt=json`;

    console.log(`Searching for: ${query}`);
    console.log(`URL: ${url}`);

    const response = await axios.get(url);
    const data = response.data;

    console.log('Response status:', response.status);
    console.log(`Results found: ${data.length}`);

    if (data.length > 0) {
      console.log('First few results:');
      data.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.Code} (${item.Exchange}) - ${item.Name}`);
      });
    }

    return data;
  } catch (error) {
    console.error('Error searching symbols:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Test EODHD API - Get exchange information
 */
async function testExchanges() {
  console.log('\n=== Testing EODHD Exchanges ===');

  try {
    const url = `${BASE_URL}/exchanges-list/?api_token=${EODHD_API_KEY}&fmt=json`;

    console.log(`URL: ${url}`);

    const response = await axios.get(url);
    const data = response.data;

    console.log('Response status:', response.status);
    console.log(`Total exchanges: ${data.length}`);

    // Show first few exchanges
    console.log('First 5 exchanges:');
    data.slice(0, 5).forEach((exchange, index) => {
      console.log(`${index + 1}. ${exchange.Name} (${exchange.Code}) - ${exchange.Country}`);
    });

    // Check for FOREX and CC (Cryptocurrencies)
    const forexExchange = data.find(ex => ex.Code === 'FOREX');
    const cryptoExchange = data.find(ex => ex.Code === 'CC');

    console.log('\nSpecial exchanges:');
    if (forexExchange) {
      console.log(`✓ FOREX: ${forexExchange.Name} (${forexExchange.Code})`);
    } else {
      console.log('✗ FOREX exchange not found');
    }

    if (cryptoExchange) {
      console.log(`✓ Cryptocurrencies: ${cryptoExchange.Name} (${cryptoExchange.Code})`);
    } else {
      console.log('✗ Cryptocurrencies exchange not found');
    }

    return data;
  } catch (error) {
    console.error('Error fetching exchanges:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting EODHD API Tests');
  console.log('API Key:', EODHD_API_KEY.substring(0, 10) + '...');

  try {
    // Test 1: Get exchange information
    await testExchanges();

    // Test 2: Search for symbols
    console.log('\n' + '='.repeat(50));
    await testSymbolSearch('AAPL');
    await testSymbolSearch('USDDKK');

    // Test 3: Real-time quotes for stocks
    console.log('\n' + '='.repeat(50));
    await testRealtimeQuotes(['AAPL.US', 'MSFT.US']);
    await testRealtimeQuotes(['AAPL.US']); // Single symbol

    // Test 4: Real-time quotes for forex (if available)
    console.log('\n' + '='.repeat(50));
    await testRealtimeQuotes(['USDDKK']); // Try forex
    await testRealtimeQuotes(['EURUSD']); // Try another forex pair

    // Test 5: Historical prices for stocks
    console.log('\n' + '='.repeat(50));
    await testHistoricalPrices('AAPL.US', 'd', '2024-01-01', '2024-01-05');
    await testHistoricalPrices('MSFT.US', 'w'); // Weekly data

    // Test 6: Historical prices for forex
    console.log('\n' + '='.repeat(50));
    await testHistoricalPrices('USDDKK', 'd', '2024-01-01', '2024-01-05');
    await testHistoricalPrices('EURUSD', 'd', '2024-01-01', '2024-01-05');

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

// Export functions for individual testing
module.exports = {
  testRealtimeQuotes,
  testHistoricalPrices,
  testSymbolSearch,
  testExchanges,
  runTests
};

// Run tests if called directly
if (require.main === module) {
  runTests();
}
