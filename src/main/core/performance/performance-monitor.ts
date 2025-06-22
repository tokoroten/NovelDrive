/**
 * パフォーマンスモニタリングシステム
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

export interface AggregatedMetrics {
  name: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, number>();
  private retentionPeriod: number = 3600000; // 1時間
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.startCleanup();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 操作の開始をマーク
   */
  startOperation(operationId: string): void {
    this.activeOperations.set(operationId, performance.now());
  }

  /**
   * 操作の終了をマークし、メトリクスを記録
   */
  endOperation(operationId: string, name: string, metadata?: Record<string, any>): void {
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetrics = {
      name,
      duration,
      startTime,
      endTime,
      metadata
    };

    this.metrics.push(metric);
    this.activeOperations.delete(operationId);
    this.emit('metric-recorded', metric);
  }

  /**
   * 関数の実行時間を計測
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const operationId = `${name}-${Date.now()}-${Math.random()}`;
    this.startOperation(operationId);

    try {
      const result = await fn();
      this.endOperation(operationId, name, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.endOperation(operationId, name, { 
        ...metadata, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * 同期関数の実行時間を計測
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const operationId = `${name}-${Date.now()}-${Math.random()}`;
    this.startOperation(operationId);

    try {
      const result = fn();
      this.endOperation(operationId, name, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.endOperation(operationId, name, { 
        ...metadata, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * 指定期間のメトリクスを取得
   */
  getMetrics(
    name?: string,
    since?: Date,
    until?: Date
  ): PerformanceMetrics[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (since) {
      const sinceTime = since.getTime();
      filtered = filtered.filter(m => m.startTime >= sinceTime);
    }

    if (until) {
      const untilTime = until.getTime();
      filtered = filtered.filter(m => m.endTime <= untilTime);
    }

    return filtered;
  }

  /**
   * メトリクスを集計
   */
  getAggregatedMetrics(
    name?: string,
    since?: Date,
    until?: Date
  ): AggregatedMetrics[] {
    const metrics = this.getMetrics(name, since, until);
    const grouped = new Map<string, PerformanceMetrics[]>();

    // 名前でグループ化
    for (const metric of metrics) {
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric);
    }

    const aggregated: AggregatedMetrics[] = [];

    for (const [name, group] of grouped) {
      const durations = group.map(m => m.duration).sort((a, b) => a - b);
      const count = durations.length;

      if (count === 0) continue;

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = totalDuration / count;
      const minDuration = durations[0];
      const maxDuration = durations[count - 1];

      aggregated.push({
        name,
        count,
        totalDuration,
        avgDuration,
        minDuration,
        maxDuration,
        p50: this.percentile(durations, 50),
        p90: this.percentile(durations, 90),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      });
    }

    return aggregated;
  }

  /**
   * メモリ使用状況を取得
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * 遅い操作を検出
   */
  getSlowOperations(threshold: number = 1000): PerformanceMetrics[] {
    return this.metrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * メトリクスをクリア
   */
  clear(): void {
    this.metrics = [];
    this.activeOperations.clear();
  }

  /**
   * モニターを停止
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = performance.now() - this.retentionPeriod;
      this.metrics = this.metrics.filter(m => m.startTime > cutoff);
    }, 60000); // 1分ごとにクリーンアップ
  }
}

/**
 * デコレーター: メソッドの実行時間を自動計測
 */
export function measurePerformance(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = PerformanceMonitor.getInstance();
      return monitor.measure(metricName, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * パフォーマンスレポートの生成
 */
export function generatePerformanceReport(
  monitor: PerformanceMonitor,
  since?: Date,
  until?: Date
): string {
  const aggregated = monitor.getAggregatedMetrics(undefined, since, until);
  const memory = monitor.getMemoryUsage();
  const slowOps = monitor.getSlowOperations();

  let report = '# Performance Report\n\n';
  
  report += '## Summary\n';
  report += `- Period: ${since || 'Start'} to ${until || 'Now'}\n`;
  report += `- Total operations: ${aggregated.reduce((sum, a) => sum + a.count, 0)}\n`;
  report += `- Total time: ${aggregated.reduce((sum, a) => sum + a.totalDuration, 0).toFixed(2)}ms\n\n`;

  report += '## Memory Usage\n';
  report += `- RSS: ${(memory.rss / 1024 / 1024).toFixed(2)}MB\n`;
  report += `- Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB\n`;
  report += `- Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB\n`;
  report += `- External: ${(memory.external / 1024 / 1024).toFixed(2)}MB\n\n`;

  report += '## Operation Metrics\n';
  report += '| Operation | Count | Avg (ms) | Min (ms) | Max (ms) | P50 | P90 | P95 | P99 |\n';
  report += '|-----------|-------|----------|----------|----------|-----|-----|-----|-----|\n';

  for (const metric of aggregated) {
    report += `| ${metric.name} | ${metric.count} | ${metric.avgDuration.toFixed(2)} | `;
    report += `${metric.minDuration.toFixed(2)} | ${metric.maxDuration.toFixed(2)} | `;
    report += `${metric.p50.toFixed(2)} | ${metric.p90.toFixed(2)} | `;
    report += `${metric.p95.toFixed(2)} | ${metric.p99.toFixed(2)} |\n`;
  }

  if (slowOps.length > 0) {
    report += '\n## Slow Operations (>1s)\n';
    report += '| Operation | Duration (ms) | Time |\n';
    report += '|-----------|---------------|------|\n';
    
    for (const op of slowOps.slice(0, 10)) {
      const time = new Date(op.startTime).toISOString();
      report += `| ${op.name} | ${op.duration.toFixed(2)} | ${time} |\n`;
    }
  }

  return report;
}

// シングルトンインスタンス
export const performanceMonitor = PerformanceMonitor.getInstance();