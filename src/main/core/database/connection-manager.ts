/**
 * データベース接続の統一管理
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { DatabaseError, errorLogger } from '../../utils/error-handler';

export interface ConnectionOptions {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export interface ConnectionStats {
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  lastQueryTime: number;
}

export class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager | null = null;
  private database: Database.Database | null = null;
  private options: ConnectionOptions | null = null;
  private isInitialized = false;
  private stats: ConnectionStats = {
    totalQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
    lastQueryTime: 0
  };
  private totalQueryTime = 0;

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
      readonly: false,
      verbose: false,
      timeout: 5000,
      ...options
    };

    try {
      // SQLite3データベースを開く
      this.database = new Database(this.options.path, {
        readonly: this.options.readonly,
        verbose: this.options.verbose ? console.log : undefined,
        timeout: this.options.timeout
      });

      // データベースが正しく開けたか確認
      try {
        // シンプルなテストクエリ
        this.database.prepare('SELECT 1').get();
        
        // WALモードを有効化（書き込み性能向上）
        this.database.pragma('journal_mode = WAL');
        // 外部キー制約を有効化
        this.database.pragma('foreign_keys = ON');
      } catch (pragmaError) {
        console.error('Database pragma error:', pragmaError);
        // 新しいデータベースファイルとして初期化
        this.database.close();
        
        // ファイルを削除して再作成
        if (this.options.path !== ':memory:' && require('fs').existsSync(this.options.path)) {
          require('fs').unlinkSync(this.options.path);
        }
        
        // 再度開く
        this.database = new Database(this.options.path, {
          readonly: this.options.readonly,
          verbose: this.options.verbose ? console.log : undefined,
          timeout: this.options.timeout
        });
      }

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
  getDatabase(): Database.Database {
    if (!this.isInitialized || !this.database) {
      throw new DatabaseError('データベースが初期化されていません');
    }
    return this.database;
  }

  /**
   * プリペアドステートメントの取得
   */
  prepare(sql: string): Database.Statement {
    const db = this.getDatabase();
    return db.prepare(sql);
  }

  /**
   * クエリ実行（SELECT）
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    const startTime = Date.now();
    
    try {
      const db = this.getDatabase();
      const stmt = db.prepare(sql);
      const result = stmt.all(...params) as T[];
      
      this.updateStats(Date.now() - startTime);
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      errorLogger.log(error as Error, { operation: 'query', sql });
      throw new DatabaseError('クエリ実行エラー', error as Error);
    }
  }

  /**
   * クエリ実行（SELECT - 単一行）
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const startTime = Date.now();
    
    try {
      const db = this.getDatabase();
      const stmt = db.prepare(sql);
      const result = stmt.get(...params) as T | undefined;
      
      this.updateStats(Date.now() - startTime);
      return result || null;
    } catch (error) {
      this.stats.failedQueries++;
      errorLogger.log(error as Error, { operation: 'queryOne', sql });
      throw new DatabaseError('クエリ実行エラー', error as Error);
    }
  }

  /**
   * クエリ実行（INSERT/UPDATE/DELETE）
   */
  run(sql: string, params: any[] = []): Database.RunResult {
    const startTime = Date.now();
    
    try {
      const db = this.getDatabase();
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      
      this.updateStats(Date.now() - startTime);
      return result;
    } catch (error) {
      this.stats.failedQueries++;
      errorLogger.log(error as Error, { operation: 'run', sql });
      throw new DatabaseError('クエリ実行エラー', error as Error);
    }
  }

  /**
   * トランザクション実行
   */
  transaction<T>(callback: () => T): T {
    const db = this.getDatabase();
    
    const transaction = db.transaction(() => {
      return callback();
    });
    
    try {
      return transaction();
    } catch (error) {
      errorLogger.log(error as Error, { operation: 'transaction' });
      throw new DatabaseError('トランザクション実行エラー', error as Error);
    }
  }

  /**
   * バッチ実行（高速な複数クエリ実行）
   */
  batch<T = any>(operations: Array<{ sql: string; params: any[] }>): T[] {
    const db = this.getDatabase();
    
    return this.transaction(() => {
      return operations.map(({ sql, params }) => {
        const stmt = db.prepare(sql);
        return stmt.run(...params) as T;
      });
    });
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = this.queryOne<{ health: number }>('SELECT 1 as health');
      return result?.health === 1;
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
   * データベース接続を閉じる
   */
  async close(): Promise<void> {
    if (this.database && !this.database.readonly) {
      try {
        // WALモードのチェックポイント実行
        this.database.pragma('wal_checkpoint(TRUNCATE)');
        this.database.close();
      } catch (error) {
        errorLogger.log(error as Error, { operation: 'close' });
      }
    }
    
    this.database = null;
    this.isInitialized = false;
    this.emit('closed');
  }

  /**
   * 初期化状態を確認
   */
  checkInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * バキューム（データベース最適化）
   */
  vacuum(): void {
    const db = this.getDatabase();
    db.exec('VACUUM');
  }

  /**
   * 統計情報の更新
   */
  private updateStats(queryTime: number): void {
    this.stats.totalQueries++;
    this.stats.lastQueryTime = queryTime;
    this.totalQueryTime += queryTime;
    this.stats.averageQueryTime = this.totalQueryTime / this.stats.totalQueries;
  }
}

// シングルトンインスタンスのエクスポート
let connectionManager: ConnectionManager | null = null;

export function getConnectionManager(options?: ConnectionOptions): ConnectionManager {
  if (!connectionManager) {
    connectionManager = ConnectionManager.getInstance();
    if (options) {
      connectionManager.initialize(options);
    }
  }
  
  if (!connectionManager) {
    throw new Error('ConnectionManagerが初期化されていません');
  }
  
  return connectionManager;
}

export function resetConnectionManager(): void {
  if (connectionManager) {
    connectionManager.close();
    connectionManager = null;
  }
}