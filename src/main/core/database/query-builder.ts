/**
 * 最適化されたクエリビルダー
 * バッチクエリとプリペアドステートメントのサポート
 */

import * as duckdb from 'duckdb';
import { ConnectionPool, withPooledConnection } from './connection-pool';
import { performanceMonitor } from '../performance/performance-monitor';

export interface QueryOptions {
  timeout?: number;
  cache?: boolean;
  prepare?: boolean;
}

export class QueryBuilder {
  private preparedStatements = new Map<string, duckdb.Statement>();
  
  constructor(private pool: ConnectionPool) {}

  /**
   * SELECT クエリの実行
   */
  async select<T = any>(
    table: string,
    options?: {
      columns?: string[];
      where?: Record<string, any>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    } & QueryOptions
  ): Promise<T[]> {
    const columns = options?.columns?.join(', ') || '*';
    let sql = `SELECT ${columns} FROM ${table}`;
    const params: any[] = [];

    if (options?.where) {
      const conditions = Object.entries(options.where)
        .map(([key]) => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
      params.push(...Object.values(options.where));
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.execute(sql, params, options);
  }

  /**
   * INSERT クエリの実行
   */
  async insert(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    options?: QueryOptions
  ): Promise<void> {
    const records = Array.isArray(data) ? data : [data];
    if (records.length === 0) return;

    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    if (records.length === 1) {
      await this.execute(sql, Object.values(records[0]), options);
    } else {
      // バッチインサート
      await this.batchExecute(sql, records.map(r => Object.values(r)), options);
    }
  }

  /**
   * UPDATE クエリの実行
   */
  async update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
    options?: QueryOptions
  ): Promise<number> {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];

    const result = await this.execute(sql, params, options);
    return result.length;
  }

  /**
   * DELETE クエリの実行
   */
  async delete(
    table: string,
    where: Record<string, any>,
    options?: QueryOptions
  ): Promise<number> {
    const whereClause = Object.keys(where)
      .map(key => `${key} = ?`)
      .join(' AND ');

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const params = Object.values(where);

    const result = await this.execute(sql, params, options);
    return result.length;
  }

  /**
   * 生SQLの実行
   */
  async execute<T = any>(
    sql: string,
    params: any[] = [],
    options?: QueryOptions
  ): Promise<T[]> {
    return performanceMonitor.measure(
      'db.query',
      async () => {
        return withPooledConnection(this.pool, async (conn) => {
          return new Promise<T[]>((resolve, reject) => {
            const callback = (err: any, rows: any[]) => {
              if (err) reject(err);
              else resolve(rows || []);
            };

            if (options?.prepare && this.shouldPrepare(sql)) {
              this.executePrepared(conn, sql, params, callback);
            } else {
              conn.all(sql, params, callback);
            }
          });
        });
      },
      { sql, params: params.length }
    );
  }

  /**
   * バッチ実行
   */
  async batchExecute(
    sql: string,
    batchParams: any[][],
    options?: QueryOptions
  ): Promise<void> {
    return performanceMonitor.measure(
      'db.batchQuery',
      async () => {
        return withPooledConnection(this.pool, async (conn) => {
          return new Promise<void>((resolve, reject) => {
            conn.run('BEGIN TRANSACTION', (err) => {
              if (err) return reject(err);

              let completed = 0;
              let hasError = false;

              const processNext = () => {
                if (hasError || completed >= batchParams.length) {
                  const finalSql = hasError ? 'ROLLBACK' : 'COMMIT';
                  conn.run(finalSql, (err) => {
                    if (err) reject(err);
                    else if (hasError) reject(new Error('Batch execution failed'));
                    else resolve();
                  });
                  return;
                }

                const params = batchParams[completed];
                conn.run(sql, params, (err) => {
                  if (err) {
                    hasError = true;
                    processNext();
                  } else {
                    completed++;
                    processNext();
                  }
                });
              };

              processNext();
            });
          });
        });
      },
      { sql, batchSize: batchParams.length }
    );
  }

  /**
   * トランザクション実行
   */
  async transaction<T>(
    callback: (query: QueryBuilder) => Promise<T>
  ): Promise<T> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise<T>(async (resolve, reject) => {
        conn.run('BEGIN TRANSACTION', async (err) => {
          if (err) return reject(err);

          try {
            // トランザクション用の一時的なQueryBuilderを作成
            const txQueryBuilder = new TransactionalQueryBuilder(conn);
            const result = await callback(txQueryBuilder);
            
            conn.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(result);
            });
          } catch (error) {
            conn.run('ROLLBACK', () => reject(error));
          }
        });
      });
    });
  }

  /**
   * ストリーミングクエリ
   */
  async *stream<T = any>(
    sql: string,
    params: any[] = [],
    options?: { batchSize?: number }
  ): AsyncGenerator<T[], void, unknown> {
    const batchSize = options?.batchSize || 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batchSql = `${sql} LIMIT ${batchSize} OFFSET ${offset}`;
      const results = await this.execute<T>(batchSql, params);
      
      if (results.length === 0) {
        hasMore = false;
      } else {
        yield results;
        offset += batchSize;
        hasMore = results.length === batchSize;
      }
    }
  }

  private shouldPrepare(sql: string): boolean {
    // 頻繁に実行されるクエリパターンを判定
    return sql.includes('SELECT') && !sql.includes('CREATE') && !sql.includes('DROP');
  }

  private executePrepared(
    conn: duckdb.Connection,
    sql: string,
    params: any[],
    callback: (err: any, rows: any[]) => void
  ): void {
    const key = this.getStatementKey(sql);
    let stmt = this.preparedStatements.get(key);

    if (!stmt) {
      stmt = conn.prepare(sql);
      this.preparedStatements.set(key, stmt);
    }

    stmt.all(...params, callback);
  }

  private getStatementKey(sql: string): string {
    // SQLを正規化してキーを生成
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * プリペアドステートメントをクリア
   */
  clearPreparedStatements(): void {
    for (const stmt of this.preparedStatements.values()) {
      stmt.finalize();
    }
    this.preparedStatements.clear();
  }
}

/**
 * トランザクション用QueryBuilder
 */
class TransactionalQueryBuilder extends QueryBuilder {
  constructor(private conn: duckdb.Connection) {
    super(null as any); // poolは使用しない
  }

  async execute<T = any>(
    sql: string,
    params: any[] = [],
    options?: QueryOptions
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  async batchExecute(
    sql: string,
    batchParams: any[][],
    options?: QueryOptions
  ): Promise<void> {
    for (const params of batchParams) {
      await this.execute(sql, params, options);
    }
  }
}

/**
 * クエリ最適化ヒント
 */
export class QueryOptimizer {
  static analyzeQuery(sql: string): {
    hasIndex: boolean;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let hasIndex = false;

    // SELECT N+1問題の検出
    if (sql.match(/SELECT.*FROM.*WHERE.*IN\s*\(/i)) {
      suggestions.push('Consider using JOIN instead of IN clause for better performance');
    }

    // インデックスヒント
    if (sql.match(/WHERE.*=/i) && !sql.match(/CREATE.*INDEX/i)) {
      suggestions.push('Consider adding an index on the WHERE clause columns');
    }

    // LIMIT なしの全件取得
    if (sql.match(/SELECT.*FROM/i) && !sql.match(/LIMIT/i)) {
      suggestions.push('Consider adding LIMIT clause to prevent loading too many records');
    }

    return { hasIndex, suggestions };
  }
}