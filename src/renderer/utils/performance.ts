/**
 * パフォーマンス監視・最適化ユーティリティ
 */

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private enabled: boolean = process.env.NODE_ENV === 'development';

  /**
   * コンポーネントのレンダリング時間を計測
   */
  measureRender(componentName: string, callback: () => void): void {
    if (!this.enabled) {
      callback();
      return;
    }

    const startTime = performance.now();
    callback();
    const endTime = performance.now();

    this.metrics.push({
      componentName,
      renderTime: endTime - startTime,
      timestamp: Date.now(),
    });

    // 閾値を超えた場合は警告
    if (endTime - startTime > 16.67) { // 60fps = 16.67ms per frame
      console.warn(`Slow render detected in ${componentName}: ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  /**
   * 非同期処理の実行時間を計測
   */
  async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const startTime = performance.now();
    try {
      const result = await operation();
      const endTime = performance.now();
      
      console.log(`${operationName} completed in ${(endTime - startTime).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(`${operationName} failed after ${(endTime - startTime).toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * メトリクスのサマリーを取得
   */
  getSummary(): Record<string, { count: number; avgTime: number; maxTime: number }> {
    const summary: Record<string, { times: number[]; }> = {};

    this.metrics.forEach(metric => {
      if (!summary[metric.componentName]) {
        summary[metric.componentName] = { times: [] };
      }
      summary[metric.componentName].times.push(metric.renderTime);
    });

    const result: Record<string, { count: number; avgTime: number; maxTime: number }> = {};
    
    Object.entries(summary).forEach(([component, data]) => {
      const times = data.times;
      result[component] = {
        count: times.length,
        avgTime: times.reduce((a, b) => a + b, 0) / times.length,
        maxTime: Math.max(...times),
      };
    });

    return result;
  }

  /**
   * メトリクスをクリア
   */
  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * React.memoのカスタム比較関数
 * 深い比較を避けて参照の比較のみ行う
 */
export function shallowEqual(prevProps: any, nextProps: any): boolean {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
}

/**
 * 重い計算をWeb Workerで実行するユーティリティ
 */
export function runInWorker<T, R>(
  workerFunction: (data: T) => R,
  data: T
): Promise<R> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = function(e) {
        try {
          const fn = ${workerFunction.toString()};
          const result = fn(e.data);
          self.postMessage({ success: true, result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };

    worker.postMessage(data);
  });
}

/**
 * 仮想スクロール用のアイテム可視性判定
 */
export function getVisibleItems<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  overscan: number = 3
): { visibleItems: T[]; startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return {
    visibleItems: items.slice(startIndex, endIndex + 1),
    startIndex,
    endIndex,
  };
}

/**
 * メモリ使用量の監視
 */
export function getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * リクエストのバッチング
 */
export class RequestBatcher<T, R> {
  private queue: Array<{ data: T; resolve: (result: R) => void; reject: (error: any) => void }> = [];
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    private batchProcessor: (items: T[]) => Promise<R[]>,
    private maxBatchSize: number = 10,
    private maxWaitTime: number = 50
  ) {}

  async add(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.maxWaitTime);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxBatchSize);
    const items = batch.map(item => item.data);

    try {
      const results = await this.batchProcessor(items);
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }

    // 残りがあれば次のバッチを処理
    if (this.queue.length > 0) {
      this.timeoutId = setTimeout(() => this.flush(), 0);
    }
  }
}