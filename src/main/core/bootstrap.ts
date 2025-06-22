/**
 * アプリケーションブートストラップ
 * DIコンテナへのサービス登録と初期化を管理
 */

import { container } from './di-container';
import { initializeDatabase, getDatabase } from '../database';
import { LocalEmbeddingService } from '../services/local-embedding-service';
import { getOpenAI } from '../services/openai-service';
import { ApiUsageLogger } from '../services/api-usage-logger';
import { PlotManager } from '../services/plot-management';
import { MultiAgentOrchestrator } from '../services/multi-agent-system';
import { QualityFilterService } from '../services/quality-filter-service';
import { AutonomousModeService } from '../services/autonomous-mode-service';
import * as duckdb from 'duckdb';
import {
  IDatabaseService,
  IEmbeddingService,
  IOpenAIService,
  IApiLoggerService,
  IPlotService,
  IMultiAgentService,
  IQualityFilterService,
  IAutonomousService
} from '../services/interfaces';

/**
 * データベースサービスアダプタ
 */
class DatabaseServiceAdapter implements IDatabaseService {
  private db: duckdb.Database | null = null;
  private conn: duckdb.Connection | null = null;

  async initialize(): Promise<void> {
    await initializeDatabase();
    this.db = getDatabase();
    if (this.db) {
      this.conn = this.db.connect();
    }
  }

  getConnection(): duckdb.Connection {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }
    return this.conn;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getConnection().all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getConnection().run(sql, params || [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async transaction<T>(callback: (conn: duckdb.Connection) => Promise<T>): Promise<T> {
    const conn = this.getConnection();
    try {
      await this.execute('BEGIN TRANSACTION');
      const result = await callback(conn);
      await this.execute('COMMIT');
      return result;
    } catch (error) {
      await this.execute('ROLLBACK');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.conn) {
      // DuckDB doesn't have a close method for connections
      this.conn = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * 埋め込みサービスアダプタ
 */
class EmbeddingServiceAdapter implements IEmbeddingService {
  private service: LocalEmbeddingService;

  constructor() {
    this.service = LocalEmbeddingService.getInstance();
  }

  async initialize(): Promise<void> {
    await this.service.initialize();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.service.generateEmbedding(text);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  getDimensions(): number {
    return 384; // multilingual-e5-small
  }

  getModelName(): string {
    return 'multilingual-e5-small';
  }
}

/**
 * サービスを登録
 */
export function registerServices(): void {
  // データベースサービス
  container.register<IDatabaseService>('database', DatabaseServiceAdapter, {
    singleton: true
  });

  // 埋め込みサービス
  container.register<IEmbeddingService>('embedding', EmbeddingServiceAdapter, {
    singleton: true
  });

  // APIログサービス
  container.register<IApiLoggerService>('apiLogger', () => {
    const dbService = container.getSync<IDatabaseService>('database');
    // ApiUsageLogger needs the actual duckdb.Database object
    // We need to access it through the global variable for now
    const db = require('../database').getDatabase();
    return new ApiUsageLogger(db) as any;
  }, {
    dependencies: ['database'],
    singleton: true
  });

  // プロット管理サービス
  container.register<IPlotService>('plotService', () => {
    const db = container.getSync<IDatabaseService>('database');
    return new PlotManager(db.getConnection()) as any;
  }, {
    dependencies: ['database'],
    singleton: true
  });

  // マルチエージェントサービス
  container.register<IMultiAgentService>('multiAgent', () => {
    const db = container.getSync<IDatabaseService>('database');
    return new MultiAgentOrchestrator(db.getConnection()) as any;
  }, {
    dependencies: ['database'],
    singleton: true
  });

  // 品質フィルタサービス
  container.register<IQualityFilterService>('qualityFilter', () => {
    const db = container.getSync<IDatabaseService>('database');
    return new QualityFilterService(db.getConnection()) as any;
  }, {
    dependencies: ['database'],
    singleton: true
  });

  // 自律モードサービス
  container.register<IAutonomousService>('autonomous', () => {
    const db = container.getSync<IDatabaseService>('database');
    const multiAgent = container.getSync<IMultiAgentService>('multiAgent');
    return new AutonomousModeService(db.getConnection(), multiAgent as any) as any;
  }, {
    dependencies: ['database', 'multiAgent'],
    singleton: true
  });
}

/**
 * アプリケーションを初期化
 */
export async function bootstrap(): Promise<void> {
  console.log('Bootstrapping application...');

  // サービスを登録
  registerServices();

  // 必須サービスを初期化
  console.log('Initializing database...');
  await container.get('database');

  console.log('Initializing embedding service...');
  await container.get('embedding');

  console.log('Initializing API logger...');
  await container.get('apiLogger');

  console.log('Application bootstrap completed');
}

/**
 * アプリケーションをクリーンアップ
 */
export async function cleanup(): Promise<void> {
  console.log('Cleaning up application...');

  // 各サービスのクリーンアップ
  const services = ['autonomous', 'multiAgent', 'database'];
  
  for (const serviceName of services) {
    if (container.isInitialized(serviceName)) {
      const service = container.getSync(serviceName);
      if (service && typeof service === 'object' && 'cleanup' in service) {
        await (service as any).cleanup();
      }
    }
  }

  // コンテナをリセット
  container.resetAll();

  console.log('Application cleanup completed');
}