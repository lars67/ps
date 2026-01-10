import { Worker } from 'worker_threads';
import path from 'path';

interface WorkerTask {
  id: string;
  type: 'portfolio_history';
  data: any;
}

interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  progress?: {
    completed: number;
    total: number;
    message: string;
  };
}

interface WorkerReadyMessage {
  type: 'ready';
  workerId?: number;
}

interface QueuedJob {
  task: WorkerTask;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout?: NodeJS.Timeout;
}

/**
 * Portfolio Worker Pool - Manages a pool of worker threads for CPU-intensive portfolio calculations
 *
 * This prevents blocking the main event loop during heavy calculations like portfolio history generation.
 */
export class PortfolioWorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private jobQueue: QueuedJob[] = [];
  private activeJobs = new Map<string, QueuedJob>();
  private isShuttingDown = false;
  private workerFailureCount = 0;
  private readonly maxWorkerFailures = 10; // Prevent infinite worker replacement

  constructor(private poolSize = 4) { // Set to 4 workers for optimal performance on 8-core system
    console.log(`🚀 Initializing Portfolio Worker Pool with ${poolSize} workers`);
    this.initializeWorkers();
  }

  /**
   * Execute portfolio history calculation in a worker thread
   */
  async executePortfolioHistory(
    portfolioId: string,
    from?: string,
    till?: string,
    precision = 2,
    forceRefresh = false
  ): Promise<any> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const taskId = this.generateTaskId();
    const task: WorkerTask = {
      id: taskId,
      type: 'portfolio_history',
      data: {
        portfolioId,
        from,
        till,
        precision,
        forceRefresh
      }
    };

    return new Promise((resolve, reject) => {
      const job: QueuedJob = {
        task,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.activeJobs.delete(taskId);
          reject(new Error(`Portfolio history calculation timeout for ${portfolioId}`));
        }, 5 * 60 * 1000) // 5 minute timeout
      };

      this.activeJobs.set(taskId, job);
      this.jobQueue.push(job);
      this.processQueue();
    });
  }

  /**
   * Cancel a running job
   */
  cancelJob(taskId: string): boolean {
    const job = this.activeJobs.get(taskId);
    if (job) {
      if (job.timeout) {
        clearTimeout(job.timeout);
      }
      job.reject(new Error('Job cancelled'));
      this.activeJobs.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.poolSize,
      activeWorkers: this.workers.length - this.availableWorkers.length,
      availableWorkers: this.availableWorkers.length,
      queuedJobs: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Gracefully shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Portfolio Worker Pool...');
    this.isShuttingDown = true;

    // Cancel all queued jobs
    this.jobQueue.forEach(job => {
      if (job.timeout) {
        clearTimeout(job.timeout);
      }
      job.reject(new Error('Worker pool shutting down'));
    });
    this.jobQueue = [];

    // Wait for active jobs to complete or timeout
    const shutdownPromises = this.workers.map(worker => {
      return new Promise<void>((resolve) => {
        worker.once('exit', () => resolve());
        worker.postMessage({ type: 'shutdown' });

        // Force terminate after 10 seconds
        setTimeout(() => {
          worker.terminate().then(() => resolve());
        }, 10000);
      });
    });

    await Promise.all(shutdownPromises);
    console.log('✅ Portfolio Worker Pool shutdown complete');
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }
  }

  private createWorker(): void {
    const workerPath = path.join(__dirname, 'portfolioWorker.js');

    const worker = new Worker(workerPath, {
      workerData: { workerId: this.workers.length }
    });

    worker.on('message', (message: WorkerResult | WorkerReadyMessage) => {
      this.handleWorkerMessage(worker, message);
    });

    worker.on('error', (error) => {
      console.error('❌ Worker thread error:', error);
      this.handleWorkerError(worker, error);
    });

    worker.on('exit', (code) => {
      console.log(`👋 Worker thread exited with code ${code}`);
      this.handleWorkerExit(worker);
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);
  }

  private handleWorkerMessage(worker: Worker, message: WorkerResult | WorkerReadyMessage): void {
    // Check if this is a worker ready message
    if ('type' in message && message.type === 'ready') {
      console.log(`✅ Worker ${message.workerId || 'unknown'} is ready`);
      this.makeWorkerAvailable(worker);
      this.processQueue();
      return;
    }

    // Handle worker result messages
    const resultMessage = message as WorkerResult;

    // Handle undefined taskId (worker startup/initialization messages)
    if (!resultMessage.taskId || resultMessage.taskId === 'unknown') {
      console.warn(`⚠️ Received message with undefined taskId:`, resultMessage);
      return;
    }

    const job = this.activeJobs.get(resultMessage.taskId);
    if (!job) {
      console.warn(`⚠️ Received result for unknown task ${resultMessage.taskId}`);
      return;
    }

    // Clear timeout
    if (job.timeout) {
      clearTimeout(job.timeout);
    }

    // Handle result
    if (resultMessage.success) {
      job.resolve(resultMessage.result);
    } else {
      job.reject(new Error(resultMessage.error || 'Worker calculation failed'));
    }

    // Clean up
    this.activeJobs.delete(resultMessage.taskId);
    this.makeWorkerAvailable(worker);
    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: Error): void {
    console.error('💥 Worker thread encountered error:', error);
    this.workerFailureCount++;

    // Find and fail any active job on this worker
    for (const [taskId, job] of this.activeJobs) {
      if (job.timeout) {
        clearTimeout(job.timeout);
      }
      job.reject(new Error(`Worker thread error: ${error.message}`));
      this.activeJobs.delete(taskId);
    }

    // Remove failed worker
    this.removeWorker(worker);

    // Only create replacement if we haven't exceeded failure threshold
    if (!this.isShuttingDown && this.workerFailureCount < this.maxWorkerFailures) {
      console.log(`🔄 Creating replacement worker... (${this.workerFailureCount}/${this.maxWorkerFailures} failures)`);
      this.createWorker();
    } else if (this.workerFailureCount >= this.maxWorkerFailures) {
      console.error(`🚨 Too many worker failures (${this.workerFailureCount}). Stopping automatic worker replacement.`);
      console.error('Manual intervention required - check MongoDB connection and worker code.');
    }
  }

  private handleWorkerExit(worker: Worker): void {
    this.removeWorker(worker);
    if (!this.isShuttingDown) {
      this.workerFailureCount++;
      if (this.workerFailureCount < this.maxWorkerFailures) {
        console.log(`🔄 Creating replacement worker after exit... (${this.workerFailureCount}/${this.maxWorkerFailures} failures)`);
        this.createWorker();
      } else {
        console.error(`🚨 Too many worker failures (${this.workerFailureCount}). Stopping automatic worker replacement.`);
        console.error('Manual intervention required - check MongoDB connection and worker code.');
      }
    }
  }

  private removeWorker(worker: Worker): void {
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex > -1) {
      this.workers.splice(workerIndex, 1);
    }

    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex > -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }
  }

  private makeWorkerAvailable(worker: Worker): void {
    if (!this.availableWorkers.includes(worker)) {
      this.availableWorkers.push(worker);
    }
  }

  private processQueue(): void {
    if (this.jobQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const worker = this.availableWorkers.shift()!;
    const job = this.jobQueue.shift()!;

    // Remove from available list while working
    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex > -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    // Send task to worker
    worker.postMessage(job.task);
  }

  private generateTaskId(): string {
    return `portfolio_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let workerPoolInstance: PortfolioWorkerPool | null = null;

export function getPortfolioWorkerPool(): PortfolioWorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new PortfolioWorkerPool();
  }
  return workerPoolInstance;
}

export function shutdownWorkerPool(): Promise<void> {
  if (workerPoolInstance) {
    const pool = workerPoolInstance;
    workerPoolInstance = null;
    return pool.shutdown();
  }
  return Promise.resolve();
}

// Graceful shutdown on process exit
process.on('SIGINT', async () => {
  await shutdownWorkerPool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownWorkerPool();
  process.exit(0);
});
