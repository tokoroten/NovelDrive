/**
 * リトライメカニズム
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, nextDelay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {}
};

/**
 * 指数バックオフでリトライ
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
        throw error;
      }
      
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      opts.onRetry(error, attempt, delay);
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * 条件付きリトライ
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options?: RetryOptions & { maxWaitTime?: number }
): Promise<T> {
  const startTime = Date.now();
  const maxWaitTime = options?.maxWaitTime || 60000;
  
  return retry(async () => {
    const result = await fn();
    
    if (!condition(result)) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Condition not met within timeout');
      }
      throw new Error('Retry condition not met');
    }
    
    return result;
  }, options);
}

/**
 * 複数の操作を並行してリトライ
 */
export async function retryAll<T>(
  operations: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T[]> {
  return Promise.all(
    operations.map(op => retry(op, options))
  );
}

/**
 * Circuit Breaker パターンの実装
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private options: {
      failureThreshold: number;
      resetTimeout: number;
      onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
    }
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.setState('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.reset();
    }
    this.failures = 0;
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.options.failureThreshold) {
      this.setState('open');
    }
  }
  
  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime.getTime() > this.options.resetTimeout
    );
  }
  
  private setState(state: 'closed' | 'open' | 'half-open'): void {
    if (this.state !== state) {
      this.state = state;
      this.options.onStateChange?.(state);
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = undefined;
    this.setState('closed');
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

/**
 * デバウンス関数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * スロットル関数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 非同期デバウンス
 */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    clearTimeout(timeoutId);
    
    if (!pendingPromise) {
      pendingPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            pendingPromise = null;
          }
        }, delay);
      });
    }
    
    return pendingPromise;
  };
}

/**
 * スリープユーティリティ
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}