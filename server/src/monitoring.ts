import SSEService from "./services/app/SSEService";

export function startMemoryMonitoring(): void {
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(
      `[MemoryUsage] RSS: ${formatBytes(mem.rss)} | HeapTotal: ${formatBytes(
        mem.heapTotal
      )} | HeapUsed: ${formatBytes(mem.heapUsed)} | External: ${formatBytes(
        mem.external
      )}`
    );
  }, 60000);
}

function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function monitorSSEConnection(sseService: SSEService): void {
  sseService.on("connection", (url: string) => {
    console.log(`[SSE] Connection opened to ${url}`);
  });

  sseService.on("error", (url: string, error: Error) => {
    console.error(`[SSE] Error on connection to ${url}: ${error.message}`);
  });

  sseService.on("close", (url: string) => {
    console.log(`[SSE] Connection closed to ${url}`);
  });
}