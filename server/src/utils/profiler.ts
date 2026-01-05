import fs from 'fs';
import path from 'path';

interface ProfilerEntry {
  timestamp: string;
  sessionId: string;
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  metadata: Record<string, any>;
}

interface ActiveTimer {
  startTime: number;
  startMemory: NodeJS.MemoryUsage;
}

class PortfolioProfiler {
  private static instance: PortfolioProfiler;
  private profilesFolder: string;
  private activeTimers: Map<string, ActiveTimer> = new Map();
  private sessionId: string;
  
  private constructor() {
    this.profilesFolder = path.join(__dirname, '../../logs/profiling');
    this.sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.ensureProfilesFolder();
  }

  public static getInstance(): PortfolioProfiler {
    if (!PortfolioProfiler.instance) {
      PortfolioProfiler.instance = new PortfolioProfiler();
    }
    return PortfolioProfiler.instance;
  }

  private ensureProfilesFolder(): void {
    try {
      if (!fs.existsSync(this.profilesFolder)) {
        fs.mkdirSync(this.profilesFolder, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create profiling folder:', error);
    }
  }

  private getProfileKey(operation: string, userModif: string, msgId: string): string {
    return `${operation}_${userModif}_${msgId}`;
  }

  public startTimer(operation: string, userModif: string, msgId: string, metadata: Record<string, any> = {}): void {
    const key = this.getProfileKey(operation, userModif, msgId);
    
    this.activeTimers.set(key, {
      startTime: performance.now(),
      startMemory: process.memoryUsage()
    });

    // Log start event for immediate visibility
    console.log(`[PROFILER START] ${operation} - ${userModif}|${msgId}`, JSON.stringify(metadata));
  }

  public endTimer(operation: string, userModif: string, msgId: string, metadata: Record<string, any> = {}): number {
    const key = this.getProfileKey(operation, userModif, msgId);
    const timer = this.activeTimers.get(key);
    
    if (!timer) {
      console.warn(`[PROFILER] No timer found for ${operation} - ${userModif}|${msgId}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    const endMemory = process.memoryUsage();

    const entry: ProfilerEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      operation,
      startTime: timer.startTime,
      endTime,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memory: {
        heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external - timer.startMemory.external
      },
      metadata: {
        userModif,
        msgId,
        ...metadata
      }
    };

    this.writeProfileEntry(entry);
    this.activeTimers.delete(key);

    // Log completion for immediate visibility
    console.log(`[PROFILER END] ${operation} - ${duration.toFixed(1)}ms - ${userModif}|${msgId}`, JSON.stringify(metadata));

    return duration;
  }

  public logPoint(operation: string, userModif: string, msgId: string, point: string, metadata: Record<string, any> = {}): void {
    const entry: ProfilerEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      operation: `${operation}.${point}`,
      startTime: performance.now(),
      endTime: performance.now(),
      duration: 0,
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      metadata: {
        userModif,
        msgId,
        point,
        ...metadata
      }
    };

    this.writeProfileEntry(entry);
    console.log(`[PROFILER POINT] ${operation}.${point} - ${userModif}|${msgId}`, JSON.stringify(metadata));
  }

  private writeProfileEntry(entry: ProfilerEntry): void {
    try {
      const filename = `portfolio_positions_${new Date().toISOString().split('T')[0]}.jsonl`;
      const filepath = path.join(this.profilesFolder, filename);
      
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filepath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write profile entry:', error);
    }
  }

  public generateReport(userModif: string, msgId: string): string {
    try {
      const today = new Date().toISOString().split('T')[0];
      const filename = `portfolio_positions_${today}.jsonl`;
      const filepath = path.join(this.profilesFolder, filename);
      
      if (!fs.existsSync(filepath)) {
        return `No profiling data found for ${today}`;
      }

      const content = fs.readFileSync(filepath, 'utf8');
      const entries = content.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .filter(entry => entry.metadata.userModif === userModif && entry.metadata.msgId === msgId);

      if (entries.length === 0) {
        return `No profiling data found for ${userModif}|${msgId}`;
      }

      const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const report = entries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10) // Top 10 longest operations
        .map(entry => `${entry.operation}: ${entry.duration.toFixed(1)}ms`)
        .join('\n');

      return `Performance Report for ${userModif}|${msgId}:\nTotal Duration: ${totalDuration.toFixed(1)}ms\n\nTop Operations:\n${report}`;
    } catch (error) {
      return `Error generating report: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

export default PortfolioProfiler.getInstance();
