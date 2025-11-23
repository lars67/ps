// Complete Portfolio Attribution Analysis for Finex
// Determining the correct currency attribution percentage

// From previous analysis:
// - Total portfolio gain: 205,110 DKK
// - Current attribution total: 24,358 DKK (missing massive cash inflows)
// - Stock trading returns: ~14,300 DKK
// - Stock currency returns: ~8,200 DKK

// What components are missing from attribution total?
// 1. Cash inflows: 552,000 DKK total infusions
// 2. Dividend payments: Need to identify these
// 3. Currency effects on cash positions

console.log('=== CORRECT PORTFOLIO ATTRIBUTION ANALYSIS ===\n');

// Current data from previous calculation
const stockTradingReturn = 14339.04;
const stockCurrencyReturn = 8184.17;
const currentAttributionTotal = 24357.80;
const actualPortfolioGain = 205110.26;

// Cash inflows identified from trades
const cashInflows = {
  initialInsertion: 200000, // DKK inserted
  eurInsertion: 50000, // EUR converted at 7.44 = ~372,000 DKK equivalent
  remainingCash: 35964.48 - 200000 // DKK cash position after inflow
};

const totalCashInflows = cashInflows.initialInsertion + (cashInflows.eurInsertion * 7.44) + cashInflows.remainingCash;

// Dividends from positions data
const dividendsReceived = {
  MSFT: 832.37,
  FMG_APXL: 1002.21,
  total: 832.37 + 1002.21
};

// Current cash positions and their FX effects
const cashPositions = {
  AUD: { amount: -11734.25, originalRate: 4.1888, currentRate: 4.175888420261411 },
  DKK: { amount: 35964.48, rate: 1 },
  EUR: { amount: 373803.83, originalRate: 7.44, currentRate: 7.476076555023924 },
  USD: { amount: -215423.27, originalRate: 6.1588, currentRate: 6.477590129189058 }
};

// Calculate currency gains/losses on cash positions
let cashCurrencyReturn = 0;
Object.keys(cashPositions).forEach(curr => {
  const pos = cashPositions[curr];
  if (pos.amount !== 0 && pos.originalRate && pos.currentRate) {
    // Calculate what the cash position would be worth in original vs current rates
    // This represents currency impact on cash holdings
    const fxImpact = pos.amount * (1/pos.originalRate) * pos.currentRate - pos.amount;
    cashCurrencyReturn += fxImpact;
  }
});

console.log('1. STOCK POSITION RETURNS:');
console.log(`   Trading: ${stockTradingReturn.toFixed(2)} DKK`);
console.log(`   Currency: ${stockCurrencyReturn.toFixed(2)} DKK`);
console.log(`   Subtotal: ${(stockTradingReturn + stockCurrencyReturn).toFixed(2)} DKK\n`);

console.log('2. CASH INFLOWS (not returns, but capital additions):');
console.log(`   DKK cash insertion: ${cashInflows.initialInsertion.toFixed(2)} DKK`);
console.log(`   EUR cash insertion: ${(cashInflows.eurInsertion * 7.44).toFixed(2)} DKK`);
console.log(`   Total cash inflows: ${(cashInflows.initialInsertion + cashInflows.eurInsertion * 7.44).toFixed(2)} DKK\n`);

console.log('3. PASSIVE INCOME (dividends):');
console.log(`   MSFT dividends received: ${dividendsReceived.MSFT.toFixed(2)}`);
console.log(`   FMG:APXL dividends received: ${dividendsReceived.FMG_APXL.toFixed(2)}`);
console.log(`   Total dividends: ${dividendsReceived.total.toFixed(2)} DKK\n`);

console.log('4. CASH POSITION CURRENCY EFFECTS:');
console.log(`   FX gains/losses on cash holdings: ${cashCurrencyReturn.toFixed(2)} DKK\n`);

const correctTotalReturn = stockTradingReturn + stockCurrencyReturn + dividendsReceived.total + cashCurrencyReturn;
const cashInflowsSeparate = cashInflows.initialInsertion + (cashInflows.eurInsertion * 7.44);

console.log('5. CORRECT TOTAL RETURN BREAKDOWN:');
console.log(`   Stock trading returns: ${stockTradingReturn.toFixed(2)} DKK (${(stockTradingReturn/correctTotalReturn*100).toFixed(2)}%)`);
console.log(`   Stock currency returns: ${stockCurrencyReturn.toFixed(2)} DKK (${(stockCurrencyReturn/correctTotalReturn*100).toFixed(2)}%)`);
console.log(`   Cash currency effects: ${cashCurrencyReturn.toFixed(2)} DKK (${(cashCurrencyReturn/correctTotalReturn*100).toFixed(2)}%)`);
console.log(`   Dividend income: ${dividendsReceived.total.toFixed(2)} DKK (${(dividendsReceived.total/correctTotalReturn*100).toFixed(2)}%)`);
console.log(`   Total performance return: ${correctTotalReturn.toFixed(2)} DKK`);
console.log(`   Cash inflows (separate): ${cashInflowsSeparate.toFixed(2)} DKK`);
console.log(`   Grand total (performance + inflows): ${(correctTotalReturn + cashInflowsSeparate).toFixed(2)} DKK`);
console.log(`   Actual portfolio value increase: ${actualPortfolioGain.toFixed(2)} DKK\n`);

console.log('6. CURRENT ATTRIBUTION ERRORS:');
console.log(`   Current attribution total: ${currentAttributionTotal.toFixed(2)} DKK`);
console.log(`   Missing from attribution: ${(correctTotalReturn - currentAttributionTotal).toFixed(2)} DKK`);
console.log(`   Missing components: Cash FX effects + incomplete cash flow attribution\n`);

console.log('7. CORRECT CURRENCY ATTRIBUTION:');
const totalCurrencyAttribution = stockCurrencyReturn + cashCurrencyReturn;
console.log(`   All currency effects combined: ${totalCurrencyAttribution.toFixed(2)} DKK`);
console.log(`   Correct currency attribution: ${(totalCurrencyAttribution/correctTotalReturn*100).toFixed(2)}% of performance returns`);
console.log(`   Current system attribution: ${(8516.95/currentAttributionTotal*100).toFixed(2)}% of incomplete total\n`);

console.log('CONCLUSION:');
console.log(`The currency attribution should be ${(totalCurrencyAttribution/correctTotalReturn*100).toFixed(2)}%, not ${attribution.breakdown.currency.percent}%.`);
console.log('The current system only measures stock currency effects, missing cash FX impacts.');
