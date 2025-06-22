/**
 * 非同期タスクキューシステム
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Task<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: number;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: Error;
  scheduledFor?: Date;
}

export interface TaskResult<R = any> {
  taskId: string;
  result?: R;
  error?: Error;
  completedAt: Date;
  duration: number;
}

export interface QueueOptions {
  concurrency: number;
  defaultPriority?: number;
  defaultMaxAttempts?: number;
  pollInterval?: number;
  storeResults?: boolean;
  resultTTL?: number;
}

export abstract class TaskQueue<T = any, R = any> extends EventEmitter {
  protected running = 0;
  protected paused = false;
  protected results = new Map<string, TaskResult<R>>();
  private pollTimer?: NodeJS.Timeout;

  constructor(protected options: QueueOptions) {
    super();
    this.startPolling();
  }

  /**
   * タスクをキューに追加
   */
  async enqueue(
    type: string,
    payload: T,
    options?: {
      priority?: number;
      maxAttempts?: number;
      delay?: number;
    }
  ): Promise<string> {
    const task: Task<T> = {
      id: uuidv4(),
      type,
      payload,
      priority: options?.priority ?? this.options.defaultPriority ?? 0,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? this.options.defaultMaxAttempts ?? 3,
      scheduledFor: options?.delay 
        ? new Date(Date.now() + options.delay)
        : undefined
    };

    await this.saveTask(task);
    this.emit('task-enqueued', task);
    
    // 即座に処理を試みる
    setImmediate(() => this.processNext());
    
    return task.id;
  }

  /**
   * 複数のタスクを一括追加
   */
  async enqueueBatch(
    tasks: Array<{
      type: string;
      payload: T;
      priority?: number;
      maxAttempts?: number;
      delay?: number;
    }>
  ): Promise<string[]> {
    const ids: string[] = [];
    
    for (const taskData of tasks) {
      const id = await this.enqueue(
        taskData.type,
        taskData.payload,
        {
          priority: taskData.priority,
          maxAttempts: taskData.maxAttempts,
          delay: taskData.delay
        }
      );
      ids.push(id);
    }
    
    return ids;
  }

  /**
   * タスクの結果を取得
   */
  async getResult(taskId: string, timeout?: number): Promise<TaskResult<R> | null> {
    // 既存の結果をチェック
    if (this.results.has(taskId)) {
      return this.results.get(taskId)!;
    }

    if (!timeout) {
      return null;
    }

    // タイムアウト付きで結果を待つ
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.off('task-completed', handler);
        this.off('task-failed', handler);
        resolve(null);
      }, timeout);

      const handler = (result: TaskResult<R>) => {
        if (result.taskId === taskId) {
          clearTimeout(timeoutId);
          this.off('task-completed', handler);
          this.off('task-failed', handler);
          resolve(result);
        }
      };

      this.on('task-completed', handler);
      this.on('task-failed', handler);
    });
  }

  /**
   * キューを一時停止
   */
  pause(): void {
    this.paused = true;
    this.emit('queue-paused');
  }

  /**
   * キューを再開
   */
  resume(): void {
    this.paused = false;
    this.emit('queue-resumed');
    this.processNext();
  }

  /**
   * キューをクリア
   */
  abstract clear(): Promise<void>;

  /**
   * 統計情報を取得
   */
  abstract getStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }>;

  protected abstract saveTask(task: Task<T>): Promise<void>;
  protected abstract getNextTask(): Promise<Task<T> | null>;
  protected abstract updateTask(task: Task<T>): Promise<void>;
  protected abstract deleteTask(taskId: string): Promise<void>;
  protected abstract processTask(task: Task<T>): Promise<R>;

  private async processNext(): Promise<void> {
    if (this.paused || this.running >= this.options.concurrency) {
      return;
    }

    const task = await this.getNextTask();
    if (!task) {
      return;
    }

    this.running++;
    this.emit('task-started', task);

    try {
      const startTime = Date.now();
      const result = await this.processTask(task);
      const duration = Date.now() - startTime;

      const taskResult: TaskResult<R> = {
        taskId: task.id,
        result,
        completedAt: new Date(),
        duration
      };

      if (this.options.storeResults) {
        this.storeResult(taskResult);
      }

      await this.deleteTask(task.id);
      this.emit('task-completed', taskResult);
    } catch (error) {
      task.attempts++;
      task.lastError = error as Error;

      const taskResult: TaskResult<R> = {
        taskId: task.id,
        error: error as Error,
        completedAt: new Date(),
        duration: 0
      };

      if (task.attempts >= task.maxAttempts) {
        await this.deleteTask(task.id);
        
        if (this.options.storeResults) {
          this.storeResult(taskResult);
        }
        
        this.emit('task-failed', taskResult);
      } else {
        // リトライのためにタスクを更新
        task.scheduledFor = new Date(Date.now() + Math.pow(2, task.attempts) * 1000);
        await this.updateTask(task);
        this.emit('task-retry', task);
      }
    } finally {
      this.running--;
      // 次のタスクを処理
      setImmediate(() => this.processNext());
    }
  }

  private storeResult(result: TaskResult<R>): void {
    this.results.set(result.taskId, result);

    // TTLが設定されている場合は自動削除
    if (this.options.resultTTL) {
      setTimeout(() => {
        this.results.delete(result.taskId);
      }, this.options.resultTTL);
    }
  }

  private startPolling(): void {
    if (!this.options.pollInterval) {
      return;
    }

    this.pollTimer = setInterval(() => {
      if (!this.paused && this.running < this.options.concurrency) {
        this.processNext();
      }
    }, this.options.pollInterval);
  }

  /**
   * キューを停止
   */
  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.paused = true;

    // 実行中のタスクが完了するのを待つ
    while (this.running > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('queue-stopped');
  }
}

/**
 * メモリベースのタスクキュー実装
 */
export class InMemoryTaskQueue<T = any, R = any> extends TaskQueue<T, R> {
  private tasks: Task<T>[] = [];
  private processors = new Map<string, (payload: T) => Promise<R>>();

  /**
   * タスクプロセッサーを登録
   */
  registerProcessor(type: string, processor: (payload: T) => Promise<R>): void {
    this.processors.set(type, processor);
  }

  protected async saveTask(task: Task<T>): Promise<void> {
    this.tasks.push(task);
    this.sortTasks();
  }

  protected async getNextTask(): Promise<Task<T> | null> {
    const now = new Date();
    
    const task = this.tasks.find(t => 
      !t.scheduledFor || t.scheduledFor <= now
    );
    
    if (task) {
      const index = this.tasks.indexOf(task);
      this.tasks.splice(index, 1);
    }
    
    return task || null;
  }

  protected async updateTask(task: Task<T>): Promise<void> {
    const index = this.tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      this.tasks[index] = task;
      this.sortTasks();
    } else {
      this.tasks.push(task);
      this.sortTasks();
    }
  }

  protected async deleteTask(taskId: string): Promise<void> {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
    }
  }

  protected async processTask(task: Task<T>): Promise<R> {
    const processor = this.processors.get(task.type);
    if (!processor) {
      throw new Error(`No processor registered for task type: ${task.type}`);
    }
    
    return processor(task.payload);
  }

  async clear(): Promise<void> {
    this.tasks = [];
    this.emit('queue-cleared');
  }

  async getStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    return {
      pending: this.tasks.length,
      running: this.running,
      completed: 0, // メモリ実装では追跡しない
      failed: 0
    };
  }

  private sortTasks(): void {
    this.tasks.sort((a, b) => {
      // 優先度が高い順（降順）
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // 作成日時が古い順（昇順）
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
}