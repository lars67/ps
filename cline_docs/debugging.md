# Updated Server Debugging Guide
**Revised: 2/11/2025**

## Overview
This guide addresses two critical areas affecting server stability:
1. WebSocket command handling race condition due to missing early returns on error.
2. SSE connection instability resulting in ECONNRESET errors and eventual server crashes after prolonged runtime.

## Critical Issue 1: WebSocket Command Handling
- **Problem**: When an incoming WebSocket message lacks the "command" field, the error response is sent but processing continues, leading to a call to command.split() on undefined. This can cause runtime exceptions and race conditions under high load.
- **Immediate Debugging Step**: Add an immediate return after sending the error response when a command is missing.
- **Instrumentation**: Enhance logging to capture instances of missing commands with context (user, timestamp, etc.) to validate improvements.

## Critical Issue 2: SSE Connection Instability
- **Problem**: Extended operation (1-3 days) leads to repeated ECONNRESET errors in SSE connections on the quotes endpoint, likely due to inadequate reconnection logic, lack of resource cleanup, and absence of connection pooling metrics.
- **Immediate Debugging Step**:
  - Detailed logging for SSE connections has been implemented. The following events are now logged:
    - Connection opened
    - Connection error (including the error message)
    - Connection closed
  - These logs can be found in the server console.
- **Long-Term Plan**: Reference the SSE Connection Management Improvement Plan for a comprehensive resolution including reconnection logic, resource cleanup, and connection pooling.

## Enhanced Debugging Capabilities
1. **Advanced Logging**:
   - Log full stack traces and request contexts on error.
   - Capture key metrics: active connection count, connection age, retry attempts, and error rates.
2. **Resource Monitoring**:
   - Add memory profiling and monitoring of CPU/network usage to identify resource leaks.
   - Audit and record file descriptor usage and network I/O statistics.
3. **Integrated Alerting**:
   - Set up automated alerts for abnormal patterns in connection failures or memory spikes.
   - Correlate errors with system state and usage metrics for rapid diagnosis.

## Next Steps
- Patch the WebSocket controller to return early when missing commands.
- Deploy updated logging on SSE connections to capture detailed telemetry.
- Analyze logs for patterns correlating with server instability.
- Iteratively update connection management infrastructure as per the SSE Improvement Plan.

## Summary
This updated debugging guide consolidates critical insights and introduces enhanced monitoring and instrumentation steps. It is intended to provide practical, actionable steps to diagnose and resolve the server stability issues identified during recent analysis.