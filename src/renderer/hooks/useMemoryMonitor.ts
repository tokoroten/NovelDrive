import { useEffect, useRef } from 'react';
import { getMemoryUsage } from '../utils/performance';

interface MemoryMonitorOptions {
  interval?: number;
  threshold?: number;
  onThresholdExceeded?: (usage: number) => void;
}

/**
 * メモリ使用量を監視するフック
 */
export function useMemoryMonitor(options: MemoryMonitorOptions = {}) {
  const { interval = 30000, threshold = 0.8, onThresholdExceeded } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkMemory = () => {
      const memory = getMemoryUsage();
      if (!memory) return;

      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usageRatio > threshold) {
        console.warn(`Memory usage high: ${(usageRatio * 100).toFixed(1)}%`);
        onThresholdExceeded?.(usageRatio);
      }
    };

    // 初回チェック
    checkMemory();

    // 定期的なチェック
    intervalRef.current = setInterval(checkMemory, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, threshold, onThresholdExceeded]);
}

/**
 * コンポーネントのアンマウント時のクリーンアップを確実に行うフック
 */
export function useCleanup(cleanup: () => void) {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);
}