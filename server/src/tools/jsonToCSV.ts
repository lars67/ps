
const positions =[
    {
        "symbol": "SAN:XPAR",
        "volume": 80,
        "price": 100,
        "rate": 1,
        "currency": "EUR",
        "fee": 8.70776,
        "invested": 8000,
        "tradeTime": "2023-06-26T00:02:10",
        "name": "SANOFI",
        "investedFull": 8000,
        "investedFullSymbol": 8000,
        "marketRate": 1,
        "marketValue": 7329.6,
        "marketValueSymbol": 7329.6,
        "avgPremium": 100.108847,
        "bprice": 91.62,
        "marketClose": 91.62,
        "marketPrice": 91.62,
        "result": -679.1077599999996,
        "resultSymbol": -679.1077599999996,
        "todayResult": 0,
        "todayResultPercent": 0,
        "weight": 84.05
    },
    {
        "symbol": "BEI:XETR",
        "currentDay": "2023-06-26",
        "currency": "EUR",
        "price": 119.699997,
        "rate": 1,
        "volume": 10,
        "invested": 1196.9999699999998,
        "fee": 13.509,
        "name": "BEIERSDORF AG O.N.",
        "investedFull": 1180,
        "investedFullSymbol": 1180,
        "marketRate": 1,
        "marketValue": 1390.5,
        "marketValueSymbol": 1390.5,
        "avgPremium": 119.3509,
        "bprice": 139.05,
        "marketClose": 139.05,
        "marketPrice": 139.05,
        "result": 196.99099999999999,
        "resultSymbol": 196.99099999999999,
        "todayResult": 0,
        "todayResultPercent": 0,
        "weight": 15.95
    },
    {
        "symbol": "TOTAL",
        "marketValue": 8720.1,
        "result": -482.11675999999966,
        "todayResult": 0
    },
    {
        "symbol": "SAN:XPAR",
        "volume": 80,
        "price": 100,
        "rate": 1.0907,
        "currency": "EUR",
        "fee": 9.497553832000001,
        "invested": 8725.6,
        "tradeTime": "2023-06-26T00:02:10",
        "name": "SANOFI",
        "investedFull": 8725.6,
        "investedFullSymbol": 8000,
        "marketRate": 1.0733069,
        "marketValue": 7866.9102542400005,
        "marketValueSymbol": 7866.9102542400005,
        "avgPremium": 109.19948727455703,
        "bprice": 91.62,
        "marketClose": 91.62,
        "marketPrice": 91.62,
        "result": -869.0487277245622,
        "resultSymbol": -143.44872772456185,
        "todayResult": 0,
        "todayResultPercent": 0,
        "weight": 84.05
    },
    {
        "symbol": "BEI:XETR",
        "currentDay": "2023-06-26",
        "currency": "EUR",
        "price": 119.699997,
        "rate": 1.0907,
        "volume": 10,
        "invested": 1305.567867279,
        "fee": 14.5721583,
        "name": "BEIERSDORF AG O.N.",
        "investedFull": 1272.866,
        "investedFullSymbol": 1180,
        "marketRate": 1.0733069,
        "marketValue": 1492.43324445,
        "marketValueSymbol": 1492.43324445,
        "avgPremium": 128.85849871582099,
        "bprice": 139.05,
        "marketClose": 139.05,
        "marketPrice": 139.05,
        "result": 203.84825729179008,
        "resultSymbol": 296.7142572917901,
        "todayResult": 0,
        "todayResultPercent": 0,
        "weight": 15.95
    },
    {
        "symbol": "TOTAL",
        "marketValue": 9359.343498690001,
        "result": -665.2004704327721,
        "todayResult": 0
    }
]
function jsonArrayToCSV(jsonArray: any[]): string {
    // Get the keys (column names) from the first object in the array
    const keys = Object.keys(jsonArray[0]);

    // Create an array to hold the CSV rows
    const csvRows: string[] = [];

    // Add the header row
    csvRows.push(keys.join(','));

    // Loop through the JSON array and add each object as a row
    for (const obj of jsonArray) {
        const values = keys.map(key => obj[key]);
        csvRows.push(values.join(','));
    }

    // Join the rows into a single CSV string
    return csvRows.join('\n');
}

console.log(jsonArrayToCSV(positions))
