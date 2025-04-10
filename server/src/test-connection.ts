import fetch from 'node-fetch';

const dataProxyUrl = process.env.DATA_PROXY || 'http://localhost:5065'; // Use localhost:5065 as default

async function testConnection() {
  try {
    const response = await fetch(`${dataProxyUrl}/historical?symbol=AAPL&date=2025-03-18`);
    const data = await response.json();
    console.log('Data received:', data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

testConnection();