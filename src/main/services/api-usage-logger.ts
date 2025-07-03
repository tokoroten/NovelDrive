import Database from 'better-sqlite3';
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
  private db: Database.Database;
  private pricingCache: Map<string, any> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.loadPricingInfo();
    this.setupHandlers();
  }

  /**
   * 価格情報の読み込み
   */
  private loadPricingInfo(): void {
    try {
      const stmt = this.db.prepare("SELECT value FROM app_settings WHERE key = 'openai_pricing'");
      const row = stmt.get() as { value: string } | undefined;
      
      if (row) {
        const pricing = JSON.parse(row.value);
        this.pricingCache.set('openai', pricing);
      }
    } catch (error) {
      console.error('Failed to load pricing info:', error);
    }
  }

  /**
   * API使用ログの記録
   */
  async logApiUsage(log: ApiUsageLog): Promise<void> {
    const id = log.id || uuidv4();
    const cost = log.estimatedCost || this.calculateCost(log);
    
    const stmt = this.db.prepare(`
      INSERT INTO api_usage_logs (
        id, apiType, provider, model, operation,
        input_tokens, output_tokens, totalTokens, estimatedCost,
        duration_ms, status, error_message,
        request_data, response_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      log.apiType,
      log.provider,
      log.model || null,
      log.operation,
      log.inputTokens || 0,
      log.outputTokens || 0,
      log.totalTokens || 0,
      cost,
      log.durationMs || null,
      log.status,
      log.errorMessage || null,
      JSON.stringify(log.requestData || {}),
      JSON.stringify(log.responseData || {}),
      JSON.stringify(log.metadata || {})
    );
  }

  /**
   * コストの計算
   */
  private calculateCost(log: ApiUsageLog): number {
    if (log.provider !== 'openai' || !log.model) {
      return 0;
    }

    const pricing = this.pricingCache.get('openai');
    if (!pricing || !pricing[log.model]) {
      return 0;
    }

    const modelPricing = pricing[log.model];
    let cost = 0;

    if (log.apiType === 'image' && modelPricing.standard_1024x1024) {
      // 画像生成の場合
      const size = log.metadata?.size || 'standard_1024x1024';
      cost = modelPricing[size] || modelPricing.standard_1024x1024;
    } else {
      // テキスト生成の場合
      const inputCost = (log.inputTokens || 0) * (modelPricing.input || 0) / 1000;
      const outputCost = (log.outputTokens || 0) * (modelPricing.output || 0) / 1000;
      cost = inputCost + outputCost;
    }

    return Math.round(cost * 10000) / 10000; // 小数点4桁で丸める
  }

  /**
   * 期間別の統計情報取得
   */
  async getUsageStats(
    startDate?: Date,
    endDate?: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<ApiUsageStats[]> {
    let query = `
      SELECT * FROM api_usage_summary_view
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate.toISOString().split('T')[0]);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate.toISOString().split('T')[0]);
    }

    query += ' ORDER BY date DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as ApiUsageStats[];
    
    return rows;
  }

  /**
   * API別の使用状況取得
   */
  async getUsageByApi(apiType?: string): Promise<any> {
    let query = `
      SELECT 
        apiType,
        provider,
        model,
        COUNT(*) as requestCount,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
        SUM(input_tokens) as totalInputTokens,
        SUM(output_tokens) as totalOutputTokens,
        SUM(totalTokens) as totalTokens,
        SUM(estimatedCost) as totalCost,
        AVG(duration_ms) as avgDurationMs
      FROM api_usage_logs
    `;

    const params: any[] = [];
    if (apiType) {
      query += ' WHERE apiType = ?';
      params.push(apiType);
    }

    query += ' GROUP BY apiType, provider, model';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * 総コストの取得
   */
  async getTotalCost(startDate?: Date, endDate?: Date): Promise<number> {
    let query = 'SELECT SUM(estimatedCost) as totalCost FROM api_usage_logs WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as { totalCost: number } | undefined;
    
    return row?.totalCost || 0;
  }

  /**
   * エラー率の取得
   */
  async getErrorRate(apiType?: string): Promise<number> {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
      FROM api_usage_logs
    `;
    const params: any[] = [];

    if (apiType) {
      query += ' WHERE apiType = ?';
      params.push(apiType);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as { total: number; errors: number } | undefined;
    
    if (!row || row.total === 0) {
      return 0;
    }

    return row.errors / row.total;
  }

  /**
   * IPCハンドラーの設定
   */
  private setupHandlers(): void {
    // API使用ログの記録
    ipcMain.handle('api:logUsage', async (_, log: ApiUsageLog) => {
      try {
        await this.logApiUsage(log);
        return { success: true };
      } catch (error) {
        console.error('Failed to log API usage:', error);
        throw error;
      }
    });

    // 統計情報の取得
    ipcMain.handle('api:getUsageStats', async (_, startDate?: string, endDate?: string, groupBy?: 'day' | 'week' | 'month') => {
      try {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        return await this.getUsageStats(start, end, groupBy);
      } catch (error) {
        console.error('Failed to get usage stats:', error);
        throw error;
      }
    });

    // API別使用状況の取得
    ipcMain.handle('api:getUsageByApi', async (_, apiType?: string) => {
      try {
        return await this.getUsageByApi(apiType);
      } catch (error) {
        console.error('Failed to get usage by API:', error);
        throw error;
      }
    });

    // 総コストの取得
    ipcMain.handle('api:getTotalCost', async (_, startDate?: string, endDate?: string) => {
      try {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        return await this.getTotalCost(start, end);
      } catch (error) {
        console.error('Failed to get total cost:', error);
        throw error;
      }
    });

    // エラー率の取得
    ipcMain.handle('api:getErrorRate', async (_, apiType?: string) => {
      try {
        return await this.getErrorRate(apiType);
      } catch (error) {
        console.error('Failed to get error rate:', error);
        throw error;
      }
    });

    // 価格情報の更新
    ipcMain.handle('api:updatePricing', async (_, provider: string, pricing: any) => {
      try {
        const stmt = this.db.prepare(`
          UPDATE app_settings 
          SET value = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE key = ?
        `);
        
        stmt.run(JSON.stringify(pricing), `${provider}_pricing`);
        this.pricingCache.set(provider, pricing);
        
        return { success: true };
      } catch (error) {
        console.error('Failed to update pricing:', error);
        throw error;
      }
    });
  }
}