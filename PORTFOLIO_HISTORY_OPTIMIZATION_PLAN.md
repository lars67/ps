# Portfolio History Performance Optimization Plan

## Executive Summary

The `portfolios.history` command currently suffers from severe performance issues where it recalculates entire portfolio histories on-demand, causing unacceptable delays (5-30 seconds) for portfolios with extensive trading history. This document outlines a comprehensive optimization strategy to achieve sub-100ms response times through pre-calculated data storage and intelligent caching.

## Current Performance Issues

- **Full Recalculation**: Every request processes all historical trades from scratch
- **Complex Computations**: Day-by-day portfolio valuation with price lookups
- **No Persistence**: Results not cached or stored
- **Poor Scalability**: O(n×days) complexity where n = number of trades

## Solution Overview: Hybrid Pre-calculated + Real-time System

### Architecture Components

1. **Database Storage**: MongoDB collection for historical snapshots
2. **Event-Driven Updates**: Real-time history updates when trades occur
3. **Background Maintenance**: Cron jobs for data consistency
4. **Smart Caching**: Immediate response with background refresh
5. **Migration System**: Seamless transition from on-demand calculation

## Implementation Phases

### Phase 1: Database Foundation
**Create PortfolioHistory Model & Storage**
- New `portfolio_histories` collection
- Daily snapshot storage with indexed queries
- Data retention policies (5+ years)

### Phase 2: Daily Batch Processing
**Scheduled History Updates**
- Daily cron job for history calculation
- Batch processing for all portfolios
- Maintain data consistency through daily updates

### Phase 3: Background Processing
**Cron Job Maintenance System**
- Daily data validation and gap filling
- Batch processing for large portfolios
- Error recovery and data integrity checks

### Phase 4: Query Optimization
**Enhanced History Command**
- Immediate cache/database responses
- Background refresh triggers
- New parameters for refresh control

### Phase 5: Migration & Monitoring
**Production Deployment**
- Gradual data migration
- Performance monitoring
- Admin tools for maintenance

## Technical Implementation

### Database Schema
```typescript
interface PortfolioHistoryDay {
  portfolioId: string;
  date: string; // YYYY-MM-DD
  invested: number;
  investedWithoutTrades: number;
  cash: number;
  nav: number;
  index: number;
  perfomance: number;
  shares: number;
  navShare: number;
  perfShare: number;
  lastUpdated: Date;
  isCalculated: boolean;
}
```

### Service Architecture
```typescript
class PortfolioHistoryCache {
  async getHistory(portfolioId: string, from: string, till: string): Promise<DayType[]>
  async updateHistory(portfolioId: string, fromDate: string): Promise<void>
  async invalidateHistory(portfolioId: string): Promise<void>
}
```

### Enhanced Command Parameters
```typescript
interface HistoryParams {
  _id: string;
  from?: string;
  till?: string;
  detail?: string;
  sample?: string;
  precision?: number;
  forceRefresh?: boolean;    // NEW: Force recalculation
  maxAge?: number;          // NEW: Max acceptable data age (minutes)
  streamUpdates?: boolean;  // NEW: Enable real-time updates
}
```

## Performance Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Response Time | 5-30s | <100ms | 99%+ faster |
| CPU Usage | High per request | Minimal | Pre-calculated |
| Memory Usage | High during calc | Low | Database queries |
| Scalability | Poor | Excellent | O(1) queries |

## Migration Strategy

### Week 1: Foundation
- Implement database model and basic caching layer
- Create PortfolioHistoryCache service
- Add basic cache checking to history command

### Week 2: Real-time Updates
- Implement event hooks for trade operations
- Add incremental update logic
- Test real-time data consistency

### Week 3: Background Processing
- Create PortfolioHistoryCronJob class
- Implement daily maintenance routines
- Add data validation and gap filling

### Week 4: Enhanced Querying
- Update history command with new parameters
- Implement hybrid response logic
- Add streaming updates capability

### Week 5: Production Deployment
- Migrate existing portfolio data
- Deploy monitoring and alerting
- Optimize based on production metrics

## Risk Mitigation

### Data Consistency
- Fallback to on-demand calculation during transition
- Validation checks against known good states
- Admin commands for manual data repair

### Performance Degradation
- Circuit breakers for background jobs
- Queue-based processing to prevent overload
- Monitoring dashboards for system health

### Backwards Compatibility
- Existing API unchanged by default
- Graceful degradation to current behavior
- Feature flags for new functionality

## Success Metrics

- **Response Time**: P95 < 200ms for cached requests
- **Data Freshness**: > 95% of data < 1 hour old
- **Cache Hit Rate**: > 90% for active portfolios
- **Background Processing**: Complete daily updates within 4 hours
- **User Satisfaction**: Eliminate timeout errors

## Future Enhancements

1. **Compression**: Store historical data compressed for large portfolios
2. **Progressive Loading**: Return recent data first, stream older data
3. **Predictive Caching**: Pre-calculate frequently requested date ranges
4. **Machine Learning**: Optimize calculation frequency based on usage patterns
5. **Multi-region**: Distribute historical data across regions

---

This plan provides a comprehensive roadmap to transform the `portfolios.history` command from a performance bottleneck into a highly responsive, scalable service. The hybrid approach ensures immediate user response while maintaining data accuracy and providing a foundation for future enhancements.

## Implementation TODO List

### Phase 1: Database Foundation ✅ COMPLETED
- [x] Create PortfolioHistory MongoDB model (`server/src/models/portfolioHistory.ts`)
- [x] Define TypeScript interfaces for history data structures
- [x] Add database indexes for efficient queries (portfolioId + date)
- [x] Create basic CRUD operations for history data
- [x] Add data retention and cleanup policies

### Phase 2: Caching Service Layer ✅ COMPLETED
- [x] Create PortfolioHistoryCache service class (`server/src/services/portfolio/historyCache.ts`)
- [x] Implement getHistory() method for retrieving cached data
- [x] Implement updateHistory() for incremental updates
- [x] Add cache invalidation methods
- [x] Create cache metadata tracking (lastUpdated, data age)

### Phase 3: Enhanced History Command ✅ COMPLETED
- [x] Update HistoryParams interface with new parameters (forceRefresh, maxAge, streamUpdates)
- [x] Modify history() function to check cache first
- [x] Implement hybrid response logic (cache + fallback)
- [x] Add background refresh triggering
- [x] Update command description in portfolio.ts

### Additional Optimizations ✅ COMPLETED
- [x] Optimize MongoDB indexes for performance (7 strategic indexes added)
- [x] Create comprehensive test scripts (`test-portfolio-history-cache.js`)
- [x] Create performance benchmark script (`benchmark-portfolio-history.js`)
- [x] Create testing documentation and README (`TESTING_README.md`)
- [x] Implement data integrity validation and gap detection
- [x] Add cache statistics and monitoring capabilities
- [x] Create cache warmup functionality for frequently accessed portfolios

### Phase 4: Daily Batch Processing
- [ ] Create PortfolioHistoryBatchProcessor service (`server/src/services/portfolio/historyBatchProcessor.ts`)
- [ ] Implement daily portfolio history calculation logic
- [ ] Add batch processing for multiple portfolios
- [ ] Create queue system for large portfolio processing
- [ ] Add error handling and recovery mechanisms

### Phase 5: Background Processing
- [ ] Create PortfolioHistoryCronJob class (`server/src/jobs/portfolioHistoryCronJob.ts`)
- [ ] Implement daily maintenance routine
- [ ] Add weekly deep validation job
- [ ] Create batch processing for large portfolios
- [ ] Add logging and monitoring

### Phase 6: Migration & Testing
- [ ] Create data migration scripts for existing portfolios
- [ ] Add admin commands for manual history rebuilding
- [ ] Implement gradual migration with fallback
- [ ] Add comprehensive testing for cache consistency
- [ ] Performance testing and optimization

### Phase 7: Monitoring & Production
- [ ] Add performance metrics and monitoring
- [ ] Create health checks for cache status
- [ ] Implement alerting for data inconsistencies
- [ ] Add admin dashboard for cache management
- [ ] Production deployment and monitoring
