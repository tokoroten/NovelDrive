import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';
import { AutonomousLog } from '../../shared/types';

export class AutonomousLogger {
  private conn: duckdb.Connection;
  private logBuffer: AutonomousLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize = 100;
  private readonly flushIntervalMs = 10000; // 10 seconds

  constructor(conn: duckdb.Connection) {
    this.conn = conn;
  }

  async initialize(): Promise<void> {
    // Create autonomous logs table if it doesn't exist
    await this.createLogTable();
    
    // Start periodic flush
    this.startPeriodicFlush();
  }

  private async createLogTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS autonomous_logs (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP,
        level TEXT,
        category TEXT,
        message TEXT,
        operation_id TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.conn.run(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.flushIntervalMs);
  }

  log(
    level: 'info' | 'warn' | 'error' | 'debug',
    category: 'operation' | 'quality' | 'resource' | 'system',
    message: string,
    operationId?: string,
    metadata?: Record<string, any>
  ): void {
    const logEntry: AutonomousLog = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      category,
      message,
      operationId,
      metadata
    };

    this.logBuffer.push(logEntry);

    // Console output for immediate visibility
    const timestamp = logEntry.timestamp.toISOString();
    const levelUpper = level.toUpperCase().padEnd(5);
    const categoryUpper = category.toUpperCase().padEnd(10);
    const opId = operationId ? `[${operationId.substring(0, 8)}]` : '';
    
    console.log(`${timestamp} ${levelUpper} ${categoryUpper} ${opId} ${message}`);
    
    if (metadata) {
      console.log(`  Metadata:`, JSON.stringify(metadata, null, 2));
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush().catch(err => {
        console.error('Failed to flush log buffer:', err);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.batchInsertLogs(logsToFlush);
    } catch (error) {
      // If flush fails, add logs back to buffer
      this.logBuffer.unshift(...logsToFlush);
      throw error;
    }
  }

  private async batchInsertLogs(logs: AutonomousLog[]): Promise<void> {
    if (logs.length === 0) return;

    const sql = `
      INSERT INTO autonomous_logs 
      (id, timestamp, level, category, message, operation_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      // DuckDB doesn't have serialize method, use transaction manually
      this.conn.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        let errorOccurred = false;
        let completedCount = 0;

        for (const log of logs) {
          this.conn.run(sql, [
            log.id,
            log.timestamp,
            log.level,
            log.category,
            log.message,
            log.operationId || null,
            log.metadata ? JSON.stringify(log.metadata) : null
          ], (err: Error | null) => {
            if (err && !errorOccurred) {
              errorOccurred = true;
              this.conn.run('ROLLBACK', () => {
                reject(err);
              });
              return;
            }

            completedCount++;
            if (completedCount === logs.length && !errorOccurred) {
              this.conn.run('COMMIT', (commitErr: Error | null) => {
                if (commitErr) reject(commitErr);
                else resolve();
              });
            }
          });
        }
      });
    });
  }

  async getLogs(
    limit = 100,
    level?: 'info' | 'warn' | 'error' | 'debug',
    category?: 'operation' | 'quality' | 'resource' | 'system',
    operationId?: string,
    since?: Date
  ): Promise<AutonomousLog[]> {
    let sql = `
      SELECT id, timestamp, level, category, message, operation_id, metadata
      FROM autonomous_logs
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (level) {
      sql += ` AND level = ?`;
      params.push(level);
    }

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (operationId) {
      sql += ` AND operation_id = ?`;
      params.push(operationId);
    }

    if (since) {
      sql += ` AND timestamp >= ?`;
      params.push(since);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const logs = rows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp),
            level: row.level,
            category: row.category,
            message: row.message,
            operationId: row.operation_id,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
          }));
          resolve(logs);
        }
      });
    });
  }

  async getLogSummary(days = 7): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    categoryBreakdown: { category: string; count: number }[];
    recentErrors: AutonomousLog[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const summaryPromises = [
      this.getLogCount(cutoffDate),
      this.getLogCountByLevel(cutoffDate),
      this.getLogCountByCategory(cutoffDate),
      this.getLogs(10, 'error', undefined, undefined, cutoffDate)
    ];

    const [totalLogs, levelCounts, categoryBreakdown, recentErrors] = await Promise.all(summaryPromises);

    return {
      totalLogs: totalLogs as number,
      errorCount: (levelCounts as any).error || 0,
      warnCount: (levelCounts as any).warn || 0,
      infoCount: (levelCounts as any).info || 0,
      debugCount: (levelCounts as any).debug || 0,
      categoryBreakdown: categoryBreakdown as any,
      recentErrors: recentErrors as AutonomousLog[]
    };
  }

  private async getLogCount(since: Date): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM autonomous_logs WHERE timestamp >= ?`;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [since], (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows?.[0]?.count || 0);
      });
    });
  }

  private async getLogCountByLevel(since: Date): Promise<{ [key: string]: number }> {
    const sql = `
      SELECT level, COUNT(*) as count 
      FROM autonomous_logs 
      WHERE timestamp >= ? 
      GROUP BY level
    `;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [since], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const counts: { [key: string]: number } = {};
          rows.forEach(row => {
            counts[row.level] = row.count;
          });
          resolve(counts);
        }
      });
    });
  }

  private async getLogCountByCategory(since: Date): Promise<{ category: string; count: number }[]> {
    const sql = `
      SELECT category, COUNT(*) as count 
      FROM autonomous_logs 
      WHERE timestamp >= ? 
      GROUP BY category
      ORDER BY count DESC
    `;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [since], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            category: row.category,
            count: row.count
          })));
        }
      });
    });
  }

  async clearOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const sql = `DELETE FROM autonomous_logs WHERE timestamp < ?`;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [cutoffDate], function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes || 0);
        }
      });
    });
  }

  async searchLogs(
    query: string,
    limit = 50,
    category?: string,
    level?: string
  ): Promise<AutonomousLog[]> {
    let sql = `
      SELECT id, timestamp, level, category, message, operation_id, metadata
      FROM autonomous_logs
      WHERE message LIKE ?
    `;
    
    const params: any[] = [`%${query}%`];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (level) {
      sql += ` AND level = ?`;
      params.push(level);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const logs = rows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp),
            level: row.level,
            category: row.category,
            message: row.message,
            operationId: row.operation_id,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
          }));
          resolve(logs);
        }
      });
    });
  }

  async cleanup(): Promise<void> {
    // Flush remaining logs
    await this.flush();
    
    // Stop periodic flush
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Clean up old logs (keep last 30 days)
    await this.clearOldLogs(30);
  }
}