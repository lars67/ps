import { UserData } from "@/services/websocket";
import { PortfolioModel } from "../../models/portfolio";
import { TradeModel } from "../../models/trade";

const description = {
  ping: {
    label: "Ping (Health Check)",
    value: '{"command": "ping"}',
    access: "public",
  },
};

interface PingResponse {
  pong: boolean;
  timestamp: string;
  uptime_seconds: number;
  performance: {
    memory: {
      heap_used_mb: number;
      heap_total_mb: number;
      rss_mb: number;
      external_mb: number;
    };
    database: {
      connected: boolean;
      latency_ms?: number;
    };
    system: {
      active_handles: number;
      active_requests: number;
    };
  };
  capacity: {
    memory_usage_percent: number;
    recommendation?: string;
  };
  timestamp_ms: number;
}

const startTime = Date.now();

export async function ping(
  _params: any,
  sendResponse: (data: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<PingResponse> {
  console.log(`📍 PING received (msgId: ${msgId})`);
  const now = Date.now();
  const mem = process.memoryUsage();

  // Database connectivity check
  let dbConnected = false;
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await PortfolioModel.findOne({}).lean().exec();
    dbLatency = Date.now() - dbStart;
    dbConnected = true;
  } catch (err) {
    // Database not connected
  }

  // Memory metrics (in MB)
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const externalMb = Math.round(mem.external / 1024 / 1024);

  // Calculate memory usage percentage
  const memoryUsagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  // Get system info
  const handles = (process as any).getActiveHandles?.().length ?? 0;
  const requests = (process as any).getActiveRequests?.().length ?? 0;

  // Scaling recommendation
  let recommendation: string | undefined;
  if (memoryUsagePercent > 85) {
    recommendation = "CRITICAL: Memory usage >85%, consider vertical scaling";
  } else if (memoryUsagePercent > 75) {
    recommendation = "WARNING: Memory usage >75%, monitor closely";
  } else if (memoryUsagePercent > 60) {
    recommendation = "INFO: Memory usage >60%, plan upgrade within 2 weeks";
  }

  const response = {
    pong: true,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((now - startTime) / 1000),
    performance: {
      memory: {
        heap_used_mb: heapUsedMb,
        heap_total_mb: heapTotalMb,
        rss_mb: rssMb,
        external_mb: externalMb,
      },
      database: {
        connected: dbConnected,
        ...(dbConnected && { latency_ms: dbLatency }),
      },
      system: {
        active_handles: handles,
        active_requests: requests,
      },
    },
    capacity: {
      memory_usage_percent: memoryUsagePercent,
      ...(recommendation && { recommendation }),
    },
    timestamp_ms: now,
  };

  console.log(`✅ PONG response (msgId: ${msgId}, memory: ${memoryUsagePercent}%)`);
  return response;
}

export default ping;
