import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';
import { ipcMain } from 'electron';

/**
 * API使用ログのインターフェース
 */
export interface ApiUsageLog {
  id?: string;
  apiType: 'embedding' | 'chat' | 'image' | 'assistant' | 'thread' | 'other';
  provider: 'openai' | 'local' | 'other';
  model?: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  durationMs?: number;
  status: 'success' | 'error';
  errorMessage?: string;
  requestData?: any;
  responseData?: any;
  metadata?: Record<string, any>;
}

/**
 * API使用状況の統計
 */
export interface ApiUsageStats {
  apiType: string;
  provider: string;
  model?: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgDurationMs: number;
  date: string;
}

/**
 * API使用ログサービス
 */
export class ApiUsageLogger {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private pricingCache: Map<string, any> = new Map();
  
  constructor(db: duckdb.Database) {
    this.db = db;
    this.conn = db.connect();
    this.loadPricingSettings();
  }
  
  /**
   * 価格設定を読み込み
   */
  private async loadPricingSettings(): Promise<void> {
    const sql = "SELECT value FROM app_settings WHERE key = 'openai_pricing'";
    
    this.conn.all(sql, (err, rows) => {
      if (!err && rows.length > 0) {
        try {
          const pricing = JSON.parse(rows[0].value as string);
          this.pricingCache.set('openai', pricing);
        } catch (error) {
          console.error('Failed to parse pricing settings:', error);
        }
      }
    });
  }
  
  /**
   * APIの使用をログに記録
   */
  async log(log: ApiUsageLog): Promise<string> {
    const id = log.id || uuidv4();
    const startTime = Date.now();
    
    // コストを計算
    if (!log.estimatedCost && log.provider === 'openai' && log.model) {
      log.estimatedCost = this.calculateCost(log);
    }
    
    // 実行時間を記録
    if (!log.durationMs && startTime) {
      log.durationMs = Date.now() - startTime;
    }
    
    const sql = `
      INSERT INTO api_usage_logs (
        id, apiType, provider, model, operation,
        input_tokens, output_tokens, totalTokens,
        estimatedCost, duration_ms, status, error_message,
        request_data, response_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      log.apiType,
      log.provider,
      log.model || null,
      log.operation,
      log.inputTokens || 0,
      log.outputTokens || 0,
      log.totalTokens || 0,
      log.estimatedCost || 0,
      log.durationMs || 0,
      log.status,
      log.errorMessage || null,
      JSON.stringify(log.requestData || {}),
      JSON.stringify(log.responseData || {}),
      JSON.stringify(log.metadata || {})
    ];
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, ...params, (err: Error | null) => {
        if (err) {
          console.error('Failed to log API usage:', err);
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }
  
  /**
   * OpenAI APIのコストを計算
   */
  private calculateCost(log: ApiUsageLog): number {
    const pricing = this.pricingCache.get('openai');
    if (!pricing || !log.model) {
      return 0;
    }
    
    let cost = 0;
    
    // テキスト生成モデルと埋め込みモデル
    if (log.apiType === 'chat' || log.apiType === 'embedding') {
      const modelPricing = pricing[log.model];
      if (modelPricing) {
        const inputCost = (log.inputTokens || 0) * modelPricing.input / 1000;
        const outputCost = (log.outputTokens || 0) * modelPricing.output / 1000;
        cost = inputCost + outputCost;
      }
    }
    
    // 画像生成モデル
    else if (log.apiType === 'image' && log.metadata) {
      const imageSettings = `${log.metadata.quality || 'standard'}_${log.metadata.size || '1024x1024'}`;
      const imagePricing = pricing['dall-e-3'];
      if (imagePricing && imagePricing[imageSettings]) {
        cost = imagePricing[imageSettings];
      }
    }
    
    return cost;
  }
  
  /**
   * API使用ログを取得
   */
  async getLogs(options?: {
    apiType?: string;
    provider?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ApiUsageLog[]> {
    let sql = 'SELECT * FROM api_usage_logs WHERE 1=1';
    const params: any[] = [];
    
    if (options?.apiType) {
      sql += ' AND apiType = ?';
      params.push(options.apiType);
    }
    
    if (options?.provider) {
      sql += ' AND provider = ?';
      params.push(options.provider);
    }
    
    if (options?.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    if (options?.startDate) {
      sql += ' AND created_at >= ?';
      params.push(options.startDate.toISOString());
    }
    
    if (options?.endDate) {
      sql += ' AND created_at <= ?';
      params.push(options.endDate.toISOString());
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const logs = rows.map((row: any) => ({
            id: row.id,
            apiType: row.apiType,
            provider: row.provider,
            model: row.model,
            operation: row.operation,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            totalTokens: row.totalTokens,
            estimatedCost: row.estimatedCost,
            durationMs: row.duration_ms,
            status: row.status,
            errorMessage: row.error_message,
            requestData: JSON.parse(row.request_data || '{}'),
            responseData: JSON.parse(row.response_data || '{}'),
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: new Date(row.created_at)
          }));
          resolve(logs);
        }
      });
    });
  }
  
  /**
   * API使用統計を取得
   */
  async getUsageStats(options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<ApiUsageStats[]> {
    let sql = 'SELECT * FROM api_usage_summary_view WHERE 1=1';
    const params: any[] = [];
    
    if (options?.startDate) {
      sql += ' AND date >= CAST(? AS DATE)';
      params.push(options.startDate.toISOString());
    }
    
    if (options?.endDate) {
      sql += ' AND date <= CAST(? AS DATE)';
      params.push(options.endDate.toISOString());
    }
    
    sql += ' ORDER BY date DESC';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const stats = rows.map((row: any) => ({
            apiType: row.apiType,
            provider: row.provider,
            model: row.model,
            requestCount: row.requestCount,
            successCount: row.successCount,
            errorCount: row.errorCount,
            totalInputTokens: row.total_input_tokens,
            totalOutputTokens: row.total_output_tokens,
            totalTokens: row.totalTokens,
            totalCost: row.totalCost,
            avgDurationMs: row.avgDurationMs,
            date: row.date
          }));
          resolve(stats);
        }
      });
    });
  }
  
  /**
   * 総コストを取得
   */
  async getTotalCost(options?: {
    startDate?: Date;
    endDate?: Date;
    provider?: string;
  }): Promise<number> {
    let sql = 'SELECT SUM(estimatedCost) as totalCost FROM api_usage_logs WHERE 1=1';
    const params: any[] = [];
    
    if (options?.provider) {
      sql += ' AND provider = ?';
      params.push(options.provider);
    }
    
    if (options?.startDate) {
      sql += ' AND created_at >= ?';
      params.push(options.startDate.toISOString());
    }
    
    if (options?.endDate) {
      sql += ' AND created_at <= ?';
      params.push(options.endDate.toISOString());
    }
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows[0]?.totalCost || 0);
        }
      });
    });
  }
  
  /**
   * エラーログを取得
   */
  async getErrorLogs(limit: number = 100): Promise<ApiUsageLog[]> {
    return this.getLogs({
      status: 'error',
      limit
    });
  }
  
  /**
   * クリーンアップ（古いログを削除）
   */
  async cleanup(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const sql = 'DELETE FROM api_usage_logs WHERE created_at < ?';
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, cutoffDate.toISOString(), function(this: any, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }
}

/**
 * API使用ログのインスタンスを保持
 */
let apiUsageLogger: ApiUsageLogger | null = null;

/**
 * API使用ログサービスを初期化
 */
export function initializeApiUsageLogger(db: duckdb.Database): void {
  apiUsageLogger = new ApiUsageLogger(db);
}

/**
 * API使用ログサービスのインスタンスを取得
 */
export function getApiUsageLogger(): ApiUsageLogger {
  if (!apiUsageLogger) {
    throw new Error('API usage logger not initialized');
  }
  return apiUsageLogger;
}

/**
 * IPCハンドラーの設定
 */
export function setupApiUsageHandlers(): void {
  // ログの取得
  ipcMain.handle('apiUsage:getLogs', async (_, options?: any) => {
    const logger = getApiUsageLogger();
    return logger.getLogs(options);
  });
  
  // 統計の取得
  ipcMain.handle('apiUsage:getStats', async (_, options?: any) => {
    const logger = getApiUsageLogger();
    return logger.getUsageStats(options);
  });
  
  // 総コストの取得
  ipcMain.handle('apiUsage:getTotalCost', async (_, options?: any) => {
    const logger = getApiUsageLogger();
    return logger.getTotalCost(options);
  });
  
  // エラーログの取得
  ipcMain.handle('apiUsage:getErrorLogs', async (_, limit?: number) => {
    const logger = getApiUsageLogger();
    return logger.getErrorLogs(limit);
  });
  
  // クリーンアップ
  ipcMain.handle('apiUsage:cleanup', async (_, daysToKeep?: number) => {
    const logger = getApiUsageLogger();
    return logger.cleanup(daysToKeep);
  });
}