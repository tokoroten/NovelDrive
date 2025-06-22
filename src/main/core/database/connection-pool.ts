/**
 * DuckDB接続プール管理
 */

import * as duckdb from 'duckdb';
import { EventEmitter } from 'events';

export interface PoolOptions {
  min: number;
  max: number;
  idleTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
}

interface PooledConnection {
  connection: duckdb.Connection;
  inUse: boolean;
  lastUsed: Date;
  id: string;
}

export class ConnectionPool extends EventEmitter {
  private pool: PooledConnection[] = [];
  private waitQueue: Array<{
    resolve: (conn: duckdb.Connection) => void;
    reject: (err: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];
  private cleanupInterval?: NodeJS.Timeout;
  private closed = false;

  constructor(
    private db: duckdb.Database,
    private options: PoolOptions
  ) {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // 最小接続数を確保
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.options.min; i++) {
      promises.push(this.createConnection());
    }
    await Promise.all(promises);

    // アイドル接続のクリーンアップを開始
    if (this.options.idleTimeoutMillis) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupIdleConnections();
      }, this.options.idleTimeoutMillis / 2);
    }
  }

  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connection = this.db.connect();
        
        const pooledConn: PooledConnection = {
          connection,
          inUse: false,
          lastUsed: new Date(),
          id: `conn-${Date.now()}-${Math.random()}`
        };

        this.pool.push(pooledConn);
        this.emit('connection-created', pooledConn.id);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async acquire(): Promise<duckdb.Connection> {
    if (this.closed) {
      throw new Error('Connection pool is closed');
    }

    // 利用可能な接続を探す
    const available = this.pool.find(conn => !conn.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      this.emit('connection-acquired', available.id);
      return available.connection;
    }

    // プールが上限に達していない場合は新規作成
    if (this.pool.length < this.options.max) {
      await this.createConnection();
      return this.acquire(); // 再帰的に取得を試みる
    }

    // 接続が空くのを待つ
    return new Promise((resolve, reject) => {
      const timeoutId = this.options.acquireTimeoutMillis
        ? setTimeout(() => {
            const index = this.waitQueue.findIndex(item => item.timeoutId === timeoutId);
            if (index !== -1) {
              this.waitQueue.splice(index, 1);
              reject(new Error('Connection acquire timeout'));
            }
          }, this.options.acquireTimeoutMillis)
        : undefined;

      this.waitQueue.push({ resolve, reject, timeoutId });
    });
  }

  release(connection: duckdb.Connection): void {
    const pooledConn = this.pool.find(conn => conn.connection === connection);
    if (!pooledConn) {
      console.warn('Attempted to release unknown connection');
      return;
    }

    pooledConn.inUse = false;
    pooledConn.lastUsed = new Date();
    this.emit('connection-released', pooledConn.id);

    // 待機中のリクエストがあれば処理
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }
      pooledConn.inUse = true;
      waiter.resolve(connection);
    }
  }

  private cleanupIdleConnections(): void {
    if (!this.options.idleTimeoutMillis || this.pool.length <= this.options.min) {
      return;
    }

    const now = Date.now();
    const toRemove: PooledConnection[] = [];

    for (const conn of this.pool) {
      if (!conn.inUse && 
          this.pool.length > this.options.min &&
          now - conn.lastUsed.getTime() > this.options.idleTimeoutMillis) {
        toRemove.push(conn);
      }
    }

    for (const conn of toRemove) {
      const index = this.pool.indexOf(conn);
      if (index !== -1) {
        this.pool.splice(index, 1);
        conn.connection.close((err) => {
          if (err) {
            console.error('Error closing connection:', err);
          }
          this.emit('connection-closed', conn.id);
        });
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 待機中のリクエストを全て拒否
    for (const waiter of this.waitQueue) {
      if (waiter.timeoutId) {
        clearTimeout(waiter.timeoutId);
      }
      waiter.reject(new Error('Connection pool is closing'));
    }
    this.waitQueue = [];

    // 全ての接続を閉じる
    const closePromises: Promise<void>[] = [];
    for (const conn of this.pool) {
      closePromises.push(new Promise((resolve) => {
        conn.connection.close((err) => {
          if (err) {
            console.error('Error closing connection:', err);
          }
          resolve();
        });
      }));
    }

    await Promise.all(closePromises);
    this.pool = [];
    this.emit('pool-closed');
  }

  getPoolStats(): {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  } {
    const active = this.pool.filter(conn => conn.inUse).length;
    return {
      total: this.pool.length,
      active,
      idle: this.pool.length - active,
      waiting: this.waitQueue.length
    };
  }
}

/**
 * プール化された接続でクエリを実行するヘルパー
 */
export async function withPooledConnection<T>(
  pool: ConnectionPool,
  callback: (conn: duckdb.Connection) => Promise<T>
): Promise<T> {
  const conn = await pool.acquire();
  try {
    return await callback(conn);
  } finally {
    pool.release(conn);
  }
}