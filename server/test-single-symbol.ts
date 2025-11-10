/**
 * Test script for a single symbol to see dividend API response format
 */

import * as dotenv from "dotenv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
dotenv.config();

import { getDividends } from './src/utils/fetchData';

async function testSingleSymbol() {
  const symbol = 'YOU:XNYS'; // This one returned 12 items

  console.log(`Testing getDividends('${symbol}')...`);

  try {
    const rawData = await getDividends(symbol);
    console.log('Raw response type:', typeof rawData);
    console.log('Is array:', Array.isArray(rawData));
    console.log('Length:', Array.isArray(rawData) ? rawData.length : 'N/A');

    if (Array.isArray(rawData) && rawData.length > 0) {
      console.log('\nFirst item:');
      console.log(JSON.stringify(rawData[0], null, 2));

      if (rawData.length > 1) {
        console.log('\nSecond item:');
        console.log(JSON.stringify(rawData[1], null, 2));
      }
    } else if (typeof rawData === 'object') {
      console.log('Object response:');
      console.log(JSON.stringify(rawData, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testSingleSymbol();
