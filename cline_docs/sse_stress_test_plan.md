# SSE Stress Test Plan

## Objective
Create a stress test script that can reliably reproduce the ECONNRESET issues seen in production after 1-3 days of operation.

## Test Scenarios

### 1. Connection Flood Test
- Create multiple SSE connections rapidly
- Simulate different symbol groups like in production
- Monitor for ECONNRESET errors
- Test Parameters:
  * Number of connections: 10-50
  * Connection rate: 1-5 per second
  * Duration: 1 hour initially

### 2. Long-Running Connection Test
- Maintain steady SSE connections
- Monitor memory usage and connection health
- Run for extended period
- Test Parameters:
  * Number of connections: 20
  * Duration: 72 hours
  * Monitor interval: 5 minutes

### 3. Connection Churn Test
- Constantly create and close connections
- Simulate client disconnects/reconnects
- Test Parameters:
  * Base connections: 10
  * Churn rate: 1 connection per minute
  * Duration: 24 hours

### 4. Mixed Load Test
- Combine multiple test scenarios
- Simulate production-like behavior
- Test Parameters:
  * Steady connections: 15
  * Variable connections: 5-10
  * Message rate: 100-1000 per minute
  * Duration: 48 hours

## Implementation Plan

```typescript
// Proposed stress test structure
interface TestConfig {
  connections: number;
  duration: number;
  symbolGroups: string[][];
  churnRate?: number;
  messageRate?: number;
  monitorInterval: number;
}

interface TestMetrics {
  activeConnections: number;
  errorCount: number;
  messageCount: number;
  memoryUsage: number;
  uptime: number;
}

class SSEStressTest {
  // Test configuration
  private config: TestConfig;
  
  // Active connections
  private connections: Map<string, EventSource>;
  
  // Metrics collection
  private metrics: TestMetrics;
  
  // Test scenarios
  async runConnectionFloodTest() {
    // Rapidly create multiple connections
  }
  
  async runLongRunningTest() {
    // Maintain steady connections for days
  }
  
  async runChurnTest() {
    // Create/close connections regularly
  }
  
  async runMixedLoadTest() {
    // Combine different patterns
  }
  
  // Monitoring and metrics
  private collectMetrics() {
    // Track connection health and resources
  }
  
  private generateReport() {
    // Create detailed test results
  }
}
```

## Success Criteria

1. Reproduction
- Successfully reproduce ECONNRESET errors
- Match production error patterns
- Consistent reproduction rate

2. Metrics
- Memory usage tracking
- Connection state monitoring
- Error pattern analysis
- Performance metrics

3. Reporting
- Detailed error logs
- Resource usage graphs
- Connection statistics
- Test scenario results

## Usage Instructions

1. Basic Test:
```bash
npm run stress-test -- --scenario=flood --connections=20 --duration=1h
```

2. Extended Test:
```bash
npm run stress-test -- --scenario=long-running --connections=15 --duration=72h
```

3. Custom Test:
```bash
npm run stress-test -- --config=custom-test.json
```

## Next Steps

1. Implement basic stress test framework
2. Add connection monitoring
3. Implement test scenarios
4. Add metrics collection
5. Create reporting system

Once we have this stress test in place, we can:
1. Verify the ECONNRESET issue reproduction
2. Test connection management improvements
3. Measure the effectiveness of fixes
4. Ensure long-term stability