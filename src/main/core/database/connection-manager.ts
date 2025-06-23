/**
 * データベース接続の統一管理
 */

import * as duckdb from 'duckdb';
import { EventEmitter } from 'events';
import { DatabaseError, errorLogger } from '../../utils/error-handler';

export interface ConnectionOptions {
  path: string;
  readOnly?: boolean;
  maxConnections?: number;
  connectTimeout?: number;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageQueryTime: number;
  totalQueries: number;
}

interface ConnectionWrapper {
  id: string;
  connection: duckdb.Connection;
  inUse: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  queryCount: number;
  totalQueryTime: number;
}

export class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager | null = null;
  private database: duckdb.Database | null = null;
  private connections: Map<string, ConnectionWrapper> = new Map();
  private options: ConnectionOptions | null = null;
  private isInitialized = false;
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    failedConnections: 0,
    averageQueryTime: 0,
    totalQueries: 0
  };

  private constructor() {
    super();
  }

  /**
   * シングルトンインスタンスの取得
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * データベースの初期化
   */
  async initialize(options?: Partial<ConnectionOptions>): Promise<void> {
    if (this.isInitialized) {
      throw new DatabaseError('既にデータベースが初期化されています');
    }

    this.options = {
      path: ':memory:',
      maxConnections: 10,
      connectTimeout: 5000,
      ...options
    };

    try {
      // DuckDB doesn't support options in constructor, use default
      this.database = new duckdb.Database(this.options.path);

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      errorLogger.log(error as Error, { operation: 'initialize', path: this.options.path });
      throw new DatabaseError('データベースの初期化に失敗しました', error as Error);
    }
  }

  /**
   * データベースインスタンスの取得
   */
  getDatabase(): duckdb.Database {
    if (!this.isInitialized || !this.database) {
      throw new DatabaseError('データベースが初期化されていません');
    }
    return this.database;
  }

  /**
   * コネクションの取得（同期版）
   */
  getConnection(): duckdb.Connection {
    if (!this.isInitialized || !this.database) {
      throw new DatabaseError('データベースが初期化されていません');
    }

    // メインコネクションがない場合は作成
    if (this.connections.size === 0) {
      const conn = this.database.connect();
      const wrapper: ConnectionWrapper = {
        id: 'main',
        connection: conn,
        inUse: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        queryCount: 0,
        totalQueryTime: 0
      };
      this.connections.set('main', wrapper);
      return conn;
    }

    // メインコネクションを返す
    const mainConn = this.connections.get('main');
    if (mainConn) {
      return mainConn.connection;
    }

    throw new DatabaseError('コネクションの取得に失敗しました');
  }

  /**
   * 接続の取得（非同期版）
   */
  async getConnectionAsync(): Promise<duckdb.Connection> {
    if (!this.isInitialized || !this.database) {
      throw new DatabaseError('データベースが初期化されていません');
    }

    // 利用可能な接続を探す
    for (const [id, wrapper] of this.connections) {
      if (!wrapper.inUse) {
        wrapper.inUse = true;
        wrapper.lastUsedAt = new Date();
        this.updateStats();
        this.emit('connectionAcquired', id);
        return wrapper.connection;
      }
    }

    // 最大接続数チェック
    if (this.connections.size >= (this.options.maxConnections || 10)) {
      // 最も古い未使用接続を探して再利用
      const oldestIdle = this.findOldestIdleConnection();
      if (oldestIdle) {
        oldestIdle.inUse = true;
        oldestIdle.lastUsedAt = new Date();
        this.updateStats();
        return oldestIdle.connection;
      }

      throw new DatabaseError('利用可能な接続がありません（最大接続数に達しています）');
    }

    // 新しい接続を作成
    return this.createNewConnection();
  }

  /**
   * 接続の解放
   */
  releaseConnection(connection: duckdb.Connection): void {
    for (const [id, wrapper] of this.connections) {
      if (wrapper.connection === connection) {
        wrapper.inUse = false;
        this.updateStats();
        this.emit('connectionReleased', id);
        return;
      }
    }
  }

  /**
   * トランザクション実行
   */
  async transaction<T>(
    callback: (conn: duckdb.Connection) => Promise<T>
  ): Promise<T> {
    const conn = await this.getConnection();
    
    try {
      // トランザクション開始
      await this.executeQuery(conn, 'BEGIN TRANSACTION');
      
      try {
        const result = await callback(conn);
        
        // コミット
        await this.executeQuery(conn, 'COMMIT');
        
        return result;
      } catch (error) {
        // ロールバック
        await this.executeQuery(conn, 'ROLLBACK');
        throw error;
      }
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * クエリ実行（統計情報付き）
   */
  async query<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    const conn = await this.getConnection();
    const startTime = Date.now();
    
    try {
      const result = await this.executeQuery<T>(conn, sql, params);
      
      // 統計情報を更新
      const wrapper = this.findWrapper(conn);
      if (wrapper) {
        wrapper.queryCount++;
        wrapper.totalQueryTime += Date.now() - startTime;
        this.stats.totalQueries++;
        this.updateAverageQueryTime();
      }
      
      return result;
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.length > 0 && result[0].health === 1;
    } catch (error) {
      errorLogger.log(error as Error, { operation: 'healthCheck' });
      return false;
    }
  }

  /**
   * 統計情報の取得
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * 接続プールの状態を取得
   */
  getPoolStatus(): {
    total: number;
    active: number;
    idle: number;
    connections: Array<{
      id: string;
      inUse: boolean;
      createdAt: Date;
      lastUsedAt: Date;
      queryCount: number;
      averageQueryTime: number;
    }>;
  } {
    const connections = Array.from(this.connections.entries()).map(([id, wrapper]) => ({
      id,
      inUse: wrapper.inUse,
      createdAt: wrapper.createdAt,
      lastUsedAt: wrapper.lastUsedAt,
      queryCount: wrapper.queryCount,
      averageQueryTime: wrapper.queryCount > 0 
        ? wrapper.totalQueryTime / wrapper.queryCount 
        : 0
    }));

    return {
      total: this.connections.size,
      active: this.stats.activeConnections,
      idle: this.stats.idleConnections,
      connections
    };
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    // すべての接続をクローズ
    for (const [id, wrapper] of this.connections) {
      try {
        // DuckDBの接続は明示的にクローズする必要がない
        this.emit('connectionClosed', id);
      } catch (error) {
        errorLogger.log(error as Error, { operation: 'cleanup', connectionId: id });
      }
    }

    this.connections.clear();
    
    if (this.database) {
      this.database = null;
    }

    this.isInitialized = false;
    this.emit('cleanup');
  }

  /**
   * 新しい接続の作成
   */
  private async createNewConnection(): Promise<duckdb.Connection> {
    if (!this.database) {
      throw new DatabaseError('データベースが初期化されていません');
    }

    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const connection = this.database.connect();
      
      const wrapper: ConnectionWrapper = {
        id,
        connection,
        inUse: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        queryCount: 0,
        totalQueryTime: 0
      };

      this.connections.set(id, wrapper);
      this.stats.totalConnections++;
      this.updateStats();
      
      this.emit('connectionCreated', id);
      
      return connection;
    } catch (error) {
      this.stats.failedConnections++;
      errorLogger.log(error as Error, { operation: 'createNewConnection' });
      throw new DatabaseError('接続の作成に失敗しました', error as Error);
    }
  }

  /**
   * 最も古い未使用接続を探す
   */
  private findOldestIdleConnection(): ConnectionWrapper | null {
    let oldest: ConnectionWrapper | null = null;
    
    for (const wrapper of this.connections.values()) {
      if (!wrapper.inUse && (!oldest || wrapper.lastUsedAt < oldest.lastUsedAt)) {
        oldest = wrapper;
      }
    }
    
    return oldest;
  }

  /**
   * 接続ラッパーを探す
   */
  private findWrapper(connection: duckdb.Connection): ConnectionWrapper | null {
    for (const wrapper of this.connections.values()) {
      if (wrapper.connection === connection) {
        return wrapper;
      }
    }
    return null;
  }

  /**
   * 統計情報の更新
   */
  private updateStats(): void {
    let active = 0;
    let idle = 0;
    
    for (const wrapper of this.connections.values()) {
      if (wrapper.inUse) {
        active++;
      } else {
        idle++;
      }
    }
    
    this.stats.activeConnections = active;
    this.stats.idleConnections = idle;
  }

  /**
   * 平均クエリ時間の更新
   */
  private updateAverageQueryTime(): void {
    let totalTime = 0;
    let totalQueries = 0;
    
    for (const wrapper of this.connections.values()) {
      totalTime += wrapper.totalQueryTime;
      totalQueries += wrapper.queryCount;
    }
    
    this.stats.averageQueryTime = totalQueries > 0 ? totalTime / totalQueries : 0;
  }

  /**
   * クエリの実行
   */
  private executeQuery<T = any>(
    conn: duckdb.Connection,
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      conn.all(sql, ...params, (err: Error | null, result: any) => {
        if (err) {
          reject(new DatabaseError(`クエリ実行エラー: ${err.message}`, err));
        } else {
          resolve(result as T[]);
        }
      });
    });
  }
}

// シングルトンインスタンスのエクスポート
let connectionManager: ConnectionManager | null = null;

export function getConnectionManager(options?: ConnectionOptions): ConnectionManager {
  if (!connectionManager && options) {
    connectionManager = new ConnectionManager(options);
  }
  
  if (!connectionManager) {
    throw new Error('ConnectionManagerが初期化されていません');
  }
  
  return connectionManager;
}

export function resetConnectionManager(): void {
  if (connectionManager) {
    connectionManager.cleanup();
    connectionManager = null;
  }
}