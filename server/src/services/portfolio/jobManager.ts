import { getPortfolioWorkerPool } from './workerPool';

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  portfolioId: string;
  startTime: number;
  endTime?: number;
  progress?: {
    completed: number;
    total: number;
    message: string;
  };
  result?: any;
  error?: string;
  msgId?: string; // WebSocket message ID for client updates
}

interface JobCallbacks {
  onProgress?: (progress: { completed: number; total: number; message: string }) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

/**
 * Job Manager for tracking async portfolio calculations
 * Provides job status tracking and client notifications
 */
export class PortfolioJobManager {
  private jobs = new Map<string, JobStatus>();
  private callbacks = new Map<string, JobCallbacks>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old jobs every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 5 * 60 * 1000);

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Submit a portfolio history calculation job
   */
  async submitPortfolioHistoryJob(
    portfolioId: string,
    from?: string,
    till?: string,
    precision = 2,
    forceRefresh = false,
    msgId?: string,
    callbacks?: JobCallbacks
  ): Promise<string> {
    const jobId = this.generateJobId();

    const job: JobStatus = {
      id: jobId,
      status: 'pending',
      portfolioId,
      startTime: Date.now(),
      msgId
    };

    this.jobs.set(jobId, job);
    if (callbacks) {
      this.callbacks.set(jobId, callbacks);
    }

    console.log(`📋 Created job ${jobId} for portfolio ${portfolioId}`);

    // Execute job asynchronously
    this.executeJob(jobId, portfolioId, from, till, precision, forceRefresh);

    return jobId;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): JobStatus | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = Date.now();

    // Try to cancel in worker pool
    const workerPool = getPortfolioWorkerPool();
    const cancelled = workerPool.cancelJob(jobId);

    if (cancelled) {
      console.log(`🛑 Cancelled job ${jobId}`);
      this.notifyCallbacks(jobId, 'error', 'Job cancelled by user');
    }

    return cancelled;
  }

  /**
   * Get all active jobs for a user/portfolio
   */
  getActiveJobs(portfolioId?: string): JobStatus[] {
    const activeJobs: JobStatus[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' || job.status === 'running') {
        if (!portfolioId || job.portfolioId === portfolioId) {
          activeJobs.push(job);
        }
      }
    }
    return activeJobs;
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: { completed: number; total: number; message: string }): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      this.notifyCallbacks(jobId, 'progress', progress);
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }

  private async executeJob(
    jobId: string,
    portfolioId: string,
    from?: string,
    till?: string,
    precision = 2,
    forceRefresh = false
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'running';
      console.log(`🚀 Starting job ${jobId} for portfolio ${portfolioId}`);

      const workerPool = getPortfolioWorkerPool();
      const result = await workerPool.executePortfolioHistory(
        portfolioId,
        from,
        till,
        precision,
        forceRefresh
      );

      // Job completed successfully
      job.status = 'completed';
      job.endTime = Date.now();
      job.result = result;

      console.log(`✅ Completed job ${jobId} in ${(job.endTime - job.startTime)}ms`);
      this.notifyCallbacks(jobId, 'complete', result);

    } catch (error) {
      // Job failed
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error instanceof Error ? error.message : String(error);

      console.error(`❌ Failed job ${jobId}:`, job.error);
      this.notifyCallbacks(jobId, 'error', job.error);
    }
  }

  private notifyCallbacks(jobId: string, type: 'progress' | 'complete' | 'error', data: any): void {
    const callbacks = this.callbacks.get(jobId);
    if (!callbacks) return;

    try {
      switch (type) {
        case 'progress':
          callbacks.onProgress?.(data);
          break;
        case 'complete':
          callbacks.onComplete?.(data);
          break;
        case 'error':
          callbacks.onError?.(data);
          break;
      }
    } catch (error) {
      console.error(`Error in job callback for ${jobId}:`, error);
    }
  }

  private cleanupOldJobs(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    const toDelete: string[] = [];

    for (const [jobId, job] of this.jobs) {
      if (job.endTime && job.endTime < cutoffTime) {
        toDelete.push(jobId);
      }
    }

    for (const jobId of toDelete) {
      this.jobs.delete(jobId);
      this.callbacks.delete(jobId);
    }

    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} old jobs`);
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('🛑 Job manager shutdown');
  }
}

// Singleton instance
let jobManagerInstance: PortfolioJobManager | null = null;

export function getPortfolioJobManager(): PortfolioJobManager {
  if (!jobManagerInstance) {
    jobManagerInstance = new PortfolioJobManager();
  }
  return jobManagerInstance;
}

export function createPortfolioHistoryJob(
  portfolioId: string,
  from?: string,
  till?: string,
  precision = 2,
  forceRefresh = false,
  msgId?: string,
  callbacks?: JobCallbacks
): Promise<string> {
  const jobManager = getPortfolioJobManager();
  return jobManager.submitPortfolioHistoryJob(
    portfolioId,
    from,
    till,
    precision,
    forceRefresh,
    msgId,
    callbacks
  );
}
