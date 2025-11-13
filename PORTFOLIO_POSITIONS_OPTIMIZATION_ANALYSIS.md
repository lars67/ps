# Portfolio Positions Performance Analysis & Optimization Plan

## Current Implementation Analysis

### 🔍 **Performance Bottlenecks Identified**

#### **1. Multiple Database Queries (N+1 Problem)**
```javascript
// Current: Individual queries for each symbol
for (const trade of allTrades) {
  const { sector, industry } = await getGICS(symbol);  // ❌ N+1 queries
  const country = symbolCountries[symbol];             // ❌ Lookup in large object
  const companyName = await getCompanyField(symbol);   // ❌ N+1 queries
}
```

#### **2. Inefficient Data Fetching**
- **`getPortfolioTrades()`**: Fetches ALL trades at once (can be 1000s of records)
- **`getSymbolsCountries()`**: Single bulk query (good)
- **`getGICS()`**: Individual queries for each symbol (bad)
- **`getCompanyField()`**: Individual queries for each symbol (bad)

#### **3. Memory-Intensive Processing**
- All trades loaded into memory simultaneously
- Complex nested object transformations
- Multiple array operations and filtering

#### **4. No Caching Strategy**
- Company metadata fetched fresh on every request
- No Redis/memory caching for frequently accessed data
- No database query result caching

## 📊 **MongoDB Query Analysis**

### **Current Query Patterns**

#### **Trades Query** (Major Bottleneck)
```javascript
await TradeModel.find({
  portfolioId: realId,
  state: { $in: [1] }
}).sort({ tradeTime: 1 }).lean();
```
- **Index Usage**: Should use compound index on `(portfolioId, state, tradeTime)`
- **Data Volume**: Can return 1000s of trades per portfolio
- **Memory Impact**: All trades loaded into memory

#### **Company Data Queries** (N+1 Problem)
```javascript
// Called for each unique symbol (potentially 100s of symbols)
await getGICS(symbol);        // Individual DB query
await getCompanyField(symbol); // Individual DB query
```

## 🚀 **Optimization Strategies**

### **Phase 1: Database-Level Optimizations**

#### **1. Add Strategic Indexes**
```javascript
// Compound index for trades query
db.trades.createIndex({
  portfolioId: 1,
  state: 1,
  tradeTime: 1
});

// Index for company data queries
db.companies.createIndex({
  symbol: 1,
  sector: 1,
  industry: 1,
  country: 1
});
```

#### **2. Implement Bulk Data Fetching**
```javascript
// Replace N individual queries with 2 bulk queries
const symbols = [...new Set(allTrades.map(t => t.symbol))];

// Single bulk query for GICS data
const gicsData = await db.companies.find({
  symbol: { $in: symbols }
}).project({
  symbol: 1,
  sector: 1,
  industry: 1,
  country: 1,
  companyName: 1
}).toArray();

// Create lookup maps
const gicsMap = new Map(gicsData.map(item => [item.symbol, item]));
const companyMap = new Map(gicsData.map(item => [item.symbol, {
  name: item.companyName,
  country: item.country
}]));
```

### **Phase 2: Caching Strategy**

#### **1. Redis/Memory Caching for Company Data**
```javascript
// Cache company metadata for 24 hours
const COMPANY_CACHE_TTL = 24 * 60 * 60; // 24 hours

async function getCompanyDataBulk(symbols: string[]) {
  const cached = await redis.mget(symbols.map(s => `company:${s}`));
  const missing = symbols.filter((_, i) => !cached[i]);

  if (missing.length > 0) {
    const dbData = await db.companies.find({
      symbol: { $in: missing }
    }).toArray();

    // Cache the results
    const pipeline = redis.pipeline();
    dbData.forEach(item => {
      pipeline.setex(`company:${item.symbol}`, COMPANY_CACHE_TTL, JSON.stringify(item));
    });
    await pipeline.exec();
  }

  // Return all data (cached + fresh)
  return await redis.mget(symbols.map(s => `company:${s}`));
}
```

#### **2. Portfolio Positions Result Caching**
```javascript
// Cache computed positions for 5-15 minutes
const POSITIONS_CACHE_TTL = 15 * 60; // 15 minutes

async function getCachedPositions(portfolioId: string) {
  const cacheKey = `positions:${portfolioId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Compute positions
  const positions = await computePositions(portfolioId);

  // Cache result
  await redis.setex(cacheKey, POSITIONS_CACHE_TTL, JSON.stringify(positions));

  return positions;
}
```

### **Phase 3: Query Optimization**

#### **1. Projection Optimization**
```javascript
// Only fetch required fields from trades
const trades = await TradeModel.find({
  portfolioId: realId,
  state: { $in: [1] }
}, {
  symbol: 1,
  side: 1,
  volume: 1,
  price: 1,
  currency: 1,
  tradeTime: 1,
  tradeType: 1,
  fee: 1,
  rate: 1
}).sort({ tradeTime: 1 }).lean();
```

#### **2. Streaming/Aggregation Pipeline**
```javascript
// Use MongoDB aggregation for initial processing
const positions = await TradeModel.aggregate([
  {
    $match: {
      portfolioId: realId,
      state: { $in: [1] }
    }
  },
  {
    $group: {
      _id: '$symbol',
      totalVolume: { $sum: { $multiply: ['$volume', { $cond: { if: { $eq: ['$side', 'B'] }, then: 1, else: -1 } }] } },
      totalInvested: { $sum: { $multiply: ['$price', '$volume', '$rate'] } },
      lastTradeTime: { $max: '$tradeTime' }
    }
  }
]);
```

### **Phase 4: Memory & Processing Optimizations**

#### **1. Streaming Trade Processing**
```javascript
// Process trades in batches instead of loading all into memory
const BATCH_SIZE = 500;

async function processTradesInBatches(portfolioId: string) {
  let skip = 0;
  let hasMore = true;
  const positions = new Map();

  while (hasMore) {
    const batch = await TradeModel.find({
      portfolioId,
      state: { $in: [1] }
    })
    .sort({ tradeTime: 1 })
    .skip(skip)
    .limit(BATCH_SIZE)
    .lean();

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch
    for (const trade of batch) {
      updatePositions(positions, trade);
    }

    skip += BATCH_SIZE;
  }

  return positions;
}
```

#### **2. Lazy Loading for Details**
```javascript
// Only compute detailed breakdowns when requested
async function getPositionsWithDetails(portfolioId: string, includeDetails: boolean = false) {
  const basicPositions = await getBasicPositions(portfolioId);

  if (!includeDetails) {
    return basicPositions;
  }

  // Compute expensive breakdowns only when needed
  const detailedPositions = await addDetailedBreakdowns(basicPositions);
  return detailedPositions;
}
```

## 📈 **Expected Performance Improvements**

### **Current Performance** (Estimated)
- **Database Queries**: 200-500 individual queries
- **Memory Usage**: 50-200MB for large portfolios
- **Response Time**: 3-15 seconds
- **CPU Usage**: High during computation

### **Optimized Performance** (Target)
- **Database Queries**: 3-5 bulk queries
- **Memory Usage**: 10-50MB for large portfolios
- **Response Time**: 0.5-2 seconds
- **CPU Usage**: 70-80% reduction

## 🎯 **Implementation Priority**

### **High Impact, Low Effort**
1. ✅ **Add database indexes** (immediate 50-70% improvement)
2. ✅ **Bulk company data queries** (eliminates N+1 problem)
3. ✅ **Redis caching for company data** (caches repeated requests)

### **High Impact, Medium Effort**
4. 🔄 **Positions result caching** (5-15 minute cache)
5. 🔄 **Streaming trade processing** (reduces memory usage)
6. 🔄 **Aggregation pipeline optimization** (MongoDB server-side processing)

### **Future Optimizations**
7. 📋 **Real-time position updates** (WebSocket optimizations)
8. 📋 **Database sharding** (for scale)
9. 📋 **Read replicas** (for high availability)

## 🛠️ **Quick Wins to Implement Now**

### **Immediate Actions** (Can implement today)

#### **1. Add Critical Indexes**
```bash
# Connect to MongoDB and run:
db.trades.createIndex({ portfolioId: 1, state: 1, tradeTime: 1 });
db.companies.createIndex({ symbol: 1 });
db.companies.createIndex({ symbol: 1, sector: 1, industry: 1, country: 1 });
```

#### **2. Bulk Company Data Queries**
Replace individual `getGICS()` and `getCompanyField()` calls with bulk queries.

#### **3. Add Basic Caching**
Implement Redis caching for company metadata.

## 📊 **Monitoring & Metrics**

### **Key Metrics to Track**
- Response time percentiles (P50, P95, P99)
- Database query count per request
- Memory usage during position calculations
- Cache hit/miss ratios
- Error rates

### **Performance Baselines**
- **Target P95**: <2 seconds
- **Target Query Count**: <10 queries per request
- **Target Cache Hit Rate**: >80%

## 🎉 **Impact Summary**

**Before Optimization:**
- 3-15 second response times
- 200-500 database queries per request
- High memory usage
- Poor user experience

**After Optimization:**
- 0.5-2 second response times
- 3-5 database queries per request
- 70-80% less memory usage
- Excellent user experience

**The portfolio positions performance can be improved by 5-10x with these optimizations!** 🚀
