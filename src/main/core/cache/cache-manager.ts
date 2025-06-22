/**
 * キャッシュマネージャー
 * LRUキャッシュとTTLサポート
 */

import { EventEmitter } from 'events';

export interface CacheOptions {
  maxSize?: number;
  maxAge?: number;
  updateAgeOnGet?: boolean;
  stale?: boolean;
  dispose?: (key: string, value: any) => void;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
  lastAccess: number;
  size: number;
}

export class CacheManager<T = any> extends EventEmitter {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(private options: CacheOptions = {}) {
    super();
    this.options.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB
    this.options.maxAge = options.maxAge || 3600000; // 1時間
    this.options.updateAgeOnGet = options.updateAgeOnGet !== false;
    
    if (this.options.maxAge && this.options.maxAge > 0) {
      this.startCleanup();
    }
  }

  /**
   * キャッシュに値を設定
   */
  set(key: string, value: T, options?: { maxAge?: number; size?: number }): void {
    const size = options?.size || this.estimateSize(value);
    const maxAge = options?.maxAge || this.options.maxAge || 0;
    const expires = maxAge > 0 ? Date.now() + maxAge : Number.MAX_SAFE_INTEGER;

    // 既存のエントリーを削除
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // サイズチェック
    if (size > (this.options.maxSize || 0)) {
      this.emit('reject', key, value, 'too-large');
      return;
    }

    // 空き容量を確保
    while (this.currentSize + size > (this.options.maxSize || 0) && this.accessOrder.length > 0) {
      const lru = this.accessOrder[0];
      this.delete(lru);
    }

    const entry: CacheEntry<T> = {
      value,
      expires,
      lastAccess: Date.now(),
      size
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.currentSize += size;
    
    this.emit('set', key, value);
  }

  /**
   * キャッシュから値を取得
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.emit('miss', key);
      return undefined;
    }

    // 有効期限チェック
    if (entry.expires < Date.now()) {
      if (!this.options.stale) {
        this.delete(key);
        this.emit('miss', key);
        return undefined;
      }
    }

    // アクセス順を更新
    this.updateAccessOrder(key);
    
    if (this.options.updateAgeOnGet) {
      entry.lastAccess = Date.now();
    }

    this.emit('hit', key, entry.value);
    return entry.value;
  }

  /**
   * 複数の値を一度に取得
   */
  mget(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  /**
   * 複数の値を一度に設定
   */
  mset(entries: Array<[string, T, { maxAge?: number; size?: number }?]>): void {
    for (const [key, value, options] of entries) {
      this.set(key, value, options);
    }
  }

  /**
   * キャッシュから値を削除
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSize -= entry.size;
    
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    if (this.options.dispose) {
      this.options.dispose(key, entry.value);
    }

    this.emit('delete', key, entry.value);
    return true;
  }

  /**
   * 値が存在するかチェック
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expires < Date.now()) {
      if (!this.options.stale) {
        this.delete(key);
        return false;
      }
    }
    
    return true;
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    if (this.options.dispose) {
      for (const [key, entry] of this.cache) {
        this.options.dispose(key, entry.value);
      }
    }

    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
    this.emit('clear');
  }

  /**
   * キャッシュのサイズを取得
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 使用中のメモリサイズを取得
   */
  memoryUsage(): number {
    return this.currentSize;
  }

  /**
   * キャッシュの統計情報を取得
   */
  getStats(): {
    size: number;
    memoryUsage: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
  } {
    const hits = this.listenerCount('hit');
    const misses = this.listenerCount('miss');
    const total = hits + misses;

    return {
      size: this.cache.size,
      memoryUsage: this.currentSize,
      maxSize: this.options.maxSize || 0,
      hitRate: total > 0 ? hits / total : 0,
      missRate: total > 0 ? misses / total : 0
    };
  }

  /**
   * キャッシュを停止
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  /**
   * 値を取得、存在しない場合は生成
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options?: { maxAge?: number; size?: number }
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, options);
    return value;
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // 基本型のサイズ
    }
  }

  private startCleanup(): void {
    const interval = Math.min(this.options.maxAge || 3600000, 60000); // 最大1分
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.cache) {
        if (entry.expires < now) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.delete(key);
      }
    }, interval);
  }
}

/**
 * 多層キャッシュ
 */
export class MultiLevelCache<T = any> {
  private levels: CacheManager<T>[];

  constructor(levels: CacheOptions[]) {
    this.levels = levels.map(options => new CacheManager<T>(options));
  }

  async get(key: string): Promise<T | undefined> {
    for (let i = 0; i < this.levels.length; i++) {
      const value = this.levels[i].get(key);
      if (value !== undefined) {
        // 上位レベルにも保存
        for (let j = 0; j < i; j++) {
          this.levels[j].set(key, value);
        }
        return value;
      }
    }
    return undefined;
  }

  set(key: string, value: T, options?: { maxAge?: number; size?: number }): void {
    for (const level of this.levels) {
      level.set(key, value, options);
    }
  }

  delete(key: string): void {
    for (const level of this.levels) {
      level.delete(key);
    }
  }

  clear(): void {
    for (const level of this.levels) {
      level.clear();
    }
  }

  stop(): void {
    for (const level of this.levels) {
      level.stop();
    }
  }
}

/**
 * キャッシュデコレーター
 */
export function cached(options?: CacheOptions & { key?: (...args: any[]) => string }) {
  const cache = new CacheManager(options);

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = options?.key 
        ? options.key(...args)
        : `${propertyKey}:${JSON.stringify(args)}`;

      return cache.getOrSet(cacheKey, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}