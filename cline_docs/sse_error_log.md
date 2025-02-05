# SSE Error Pattern Documentation

## Error Messages

The following error pattern was observed repeatedly in the logs:

```
SSEServicee onerror Event { type: 'error', message: 'read ECONNRESET' } https://top.softcapital.com/scproxy/quotes?symbols=DAB:XCSE,AQP:XCSE,AT1:XETR,FTK:XETR,NFLX,ED,MRO,OHI,EDR,EQC,EURDKK:FX,USDDKK:FX,DKKEUR:FX,DKKUSD:FX

SSEServicee onerror Event { type: 'error', message: 'read ECONNRESET' } https://top.softcapital.com/scproxy/quotes?symbols=DAB:XCSE,AQP:XCSE,AT1:XETR,FTK:XETR,NFLX,ED,MRO,OHI,EDR,EQC,EURDKK:FX,USDDKK:FX,DKKEUR:FX,DKKUSD:FX

SSEServicee onerror Event { type: 'error', message: 'read ECONNRESET' } https://top.softcapital.com/scproxy/quotes?symbols=DAB:XCSE,AQP:XCSE,AT1:XETR,FTK:XETR,NFLX,ED,MRO,OHI,EDR,EQC,EURDKK:FX,USDDKK:FX,DKKEUR:FX,DKKUSD:FX

SSEServicee onerror Event { type: 'error', message: 'read ECONNRESET' } https://top.softcapital.com/scproxy/quotes?symbols=PEXIP:XOSL,BHG:XSTO,FTK:XETR,NVDA,PG,NFLX,NET,IP,EDR,HCP,NOKDKK:FX,SEKDKK:FX,EURDKK:FX,USDDKK:FX,DKKNOK:FX,DKKSEK:FX,DKKEUR:FX,DKKUSD:FX

SSEServicee onerror Event { type: 'error', message: 'read ECONNRESET' } https://top.softcapital.com/scproxy/quotes?symbols=DAB:XCSE,AQP:XCSE,AT1:XETR,FTK:XETR,NFLX,ED,MRO,OHI,EDR,EQC,EURDKK:FX,USDDKK:FX,DKKEUR:FX,DKKUSD:FX
```

## Error Analysis

1. Error Type: ECONNRESET (Connection Reset)
- This indicates that the connection was forcibly closed by the remote server

2. Affected Endpoints:
- All errors occur on the quotes endpoint: https://top.softcapital.com/scproxy/quotes
- Multiple symbol groups are affected:
  * Nordic exchanges (XCSE, XOSL, XSTO)
  * German exchange (XETR)
  * US stocks (NFLX, NVDA, etc.)
  * Currency pairs (EURDKK:FX, USDDKK:FX, etc.)

3. Pattern:
- Errors occur in rapid succession
- Same error message repeats multiple times
- Multiple different symbol groups experience the error simultaneously

4. Impact:
- Users lose connection to market data feed
- Multiple reconnection attempts fail
- Service becomes unavailable until manual intervention

## Additional Context

- The errors appear suddenly after 1-3 days of normal operation
- The issue affects multiple different symbol subscriptions simultaneously
- The error pattern suggests a systemic failure rather than individual connection issues