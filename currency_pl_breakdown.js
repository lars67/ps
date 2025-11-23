// Script to calculate currency P/L breakdown per stock
// Based on the attribution formula: currency_PL = sum(local_value * (current_rate - invested_rate))

const positions = [
  { symbol: "FMG:APXL", investedFull: 12775.839999999998, investedFullSymbol: 3050, marketValueSymbol: 4244, currency: "AUD" },
  { symbol: "MSFT", investedFull: 150890.6, investedFullSymbol: 24500, marketValueSymbol: 23921.5, currency: "USD" },
  { symbol: "DANSKE:XCSE", investedFull: 130050, investedFullSymbol: 130050, marketValueSymbol: 144150, currency: "DKK" },
  { symbol: "ORSTED:XCSE", investedFull: 33930, investedFullSymbol: 33930, marketValueSymbol: 39030, currency: "DKK" },
  { symbol: "TSLA:XNAS", investedFull: 56865.280000000006, investedFullSymbol: 8885.2, marketValueSymbol: 7900.900000000001, currency: "USD" }
];

// Note: This is the code fix calculation, so I have the invested_rates calculated
// For demo, I'll need to calculate them

console.log("Currency P/L Breakdown per Stock:");
console.log("=" .repeat(60));

let totalCurrencyPL = 0;

// For each position:
positions.forEach(pos => {
  // invested_rate = investedFull / investedFullSymbol
  const investedRate = pos.investedFull / pos.investedFullSymbol;

  // current rate is the marketRate from data
  let currentRate;
  if (pos.currency === 'AUD') currentRate = 4.175888420261411;
  else if (pos.currency === 'USD') currentRate = 6.477590129189058;
  else if (pos.currency === 'DKK') currentRate = 1;
  else currentRate = 1; // fallback

  // currency_PL = marketValueSymbol * (currentRate - investedRate)
  const currencyPL = pos.marketValueSymbol * (currentRate - investedRate);

  console.log(`${pos.symbol.padEnd(15)} | Rate Change: ${(currentRate - investedRate).toFixed(6)} | Currency P/L: ${currencyPL.toFixed(2)} DKK`);
  totalCurrencyPL += currencyPL;
});

console.log("=" .repeat(60));
console.log(`TOTAL CURRENCY P/L: ${totalCurrencyPL.toFixed(2)} DKK`);

// Let's check if this matches the 8240
console.log(`Expected from attribution: ~8240 DKK`);
console.log(`Match: ${(Math.abs(totalCurrencyPL - 8240) < 1 ? 'YES' : 'NO - Difference: ' + (totalCurrencyPL - 8240).toFixed(2))}`);
