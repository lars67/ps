export function startMemoryMonitoring(): void {
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MemoryUsage] RSS: ${mem.rss} | HeapTotal: ${mem.heapTotal} | HeapUsed: ${mem.heapUsed} | External: ${mem.external}`);
  }, 60000);
}