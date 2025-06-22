/**
 * 非同期バッチ処理プロセッサー
 */

import { EventEmitter } from 'events';

export interface BatchProcessorOptions<T> {
  batchSize: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  concurrency?: number;
}

interface BatchItem<T, R> {
  item: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  retries: number;
}

export class BatchProcessor<T, R> extends EventEmitter {
  private queue: BatchItem<T, R>[] = [];
  private processing = false;
  private flushTimer?: NodeJS.Timeout;
  private closed = false;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: BatchProcessorOptions<T>
  ) {
    super();
    this.startFlushTimer();
  }

  /**
   * アイテムを処理キューに追加
   */
  async add(item: T): Promise<R> {
    if (this.closed) {
      throw new Error('Batch processor is closed');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        item,
        resolve,
        reject,
        retries: 0
      });

      this.emit('item-queued', item);

      // バッチサイズに達したら即座に処理
      if (this.queue.length >= this.options.batchSize) {
        this.flush();
      }
    });
  }

  /**
   * 複数のアイテムを一度に追加
   */
  async addMany(items: T[]): Promise<R[]> {
    const promises = items.map(item => this.add(item));
    return Promise.all(promises);
  }

  /**
   * キューをフラッシュして処理
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.resetFlushTimer();

    const concurrency = this.options.concurrency || 1;
    const batches: BatchItem<T, R>[][] = [];

    // キューをバッチに分割
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.options.batchSize);
      if (batch.length > 0) {
        batches.push(batch);
      }
    }

    // 並行処理
    const processingPromises: Promise<void>[] = [];
    for (let i = 0; i < batches.length; i += concurrency) {
      const concurrentBatches = batches.slice(i, i + concurrency);
      const promise = Promise.all(
        concurrentBatches.map(batch => this.processBatch(batch))
      ).then(() => {});
      processingPromises.push(promise);
    }

    await Promise.all(processingPromises);
    this.processing = false;

    // 処理中に新しいアイテムが追加された場合は再度フラッシュ
    if (this.queue.length >= this.options.batchSize) {
      this.flush();
    }
  }

  private async processBatch(batch: BatchItem<T, R>[]): Promise<void> {
    const items = batch.map(b => b.item);
    
    try {
      this.emit('batch-processing', items);
      const results = await this.processor(items);
      
      if (results.length !== items.length) {
        throw new Error(`Processor returned ${results.length} results for ${items.length} items`);
      }

      // 成功した結果を返す
      batch.forEach((batchItem, index) => {
        batchItem.resolve(results[index]);
      });

      this.emit('batch-processed', items, results);
    } catch (error) {
      this.emit('batch-error', items, error);
      
      // リトライ処理
      const retryItems: BatchItem<T, R>[] = [];
      
      for (const batchItem of batch) {
        if (this.shouldRetry(batchItem)) {
          batchItem.retries++;
          retryItems.push(batchItem);
        } else {
          batchItem.reject(error as Error);
        }
      }

      // リトライアイテムをキューに戻す
      if (retryItems.length > 0) {
        await this.scheduleRetry(retryItems);
      }
    }
  }

  private shouldRetry(item: BatchItem<T, R>): boolean {
    return (
      this.options.maxRetries !== undefined &&
      item.retries < this.options.maxRetries
    );
  }

  private async scheduleRetry(items: BatchItem<T, R>[]): Promise<void> {
    if (this.options.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
    }
    
    // リトライアイテムをキューの先頭に追加
    this.queue.unshift(...items);
    this.emit('items-retrying', items.map(i => i.item));
  }

  private startFlushTimer(): void {
    if (!this.options.flushInterval) {
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.options.flushInterval);
  }

  private resetFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.startFlushTimer();
    }
  }

  /**
   * プロセッサーを閉じる
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 残りのアイテムを処理
    if (this.queue.length > 0) {
      await this.flush();
    }

    this.emit('closed');
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    queueLength: number;
    processing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing
    };
  }
}

/**
 * 汎用的なバッチ処理ヘルパー関数
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { concurrency?: number } = {}
): Promise<R[]> {
  const concurrency = options.concurrency || 10;
  const results: R[] = new Array(items.length);
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item))
    );
    
    batchResults.forEach((result, index) => {
      results[i + index] = result;
    });
  }
  
  return results;
}