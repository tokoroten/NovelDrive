import { ipcMain, app } from 'electron';
import * as path from 'path';
import Database from 'better-sqlite3';
import { getSearchTokens, createDuckDBTokenizerFunction } from './services/japanese-tokenizer';
import { LocalEmbeddingService } from './services/local-embedding-service';
import { setupSerendipitySearchHandlers } from './services/serendipity-search';
import { setupCrawlerHandlers } from './services/web-crawler';
import { setupAnythingBoxHandlers } from './services/anything-box';
import { setupAgentHandlers } from './services/agent-handlers';
import { setupPlotHandlers } from './services/plot-management';
import { setupChapterHandlers } from './services/chapter-management';
import { DatabaseMigration } from './services/database-migration';
import { setupDatabaseHandlers } from './services/database-handlers';
import { ApiUsageLogger } from './services/api-usage-logger';
import { ConnectionManager } from './core/database/connection-manager';
import { wrapIPCHandler, DatabaseError, ValidationError } from './utils/error-handler';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: string;
  projectId?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  sourceUrl?: string;
}

let connectionManager: ConnectionManager | null = null;

export async function initializeDatabase(): Promise<void> {
  // データベースファイルのパスを設定
  const dbPath = path.join(app.getPath('userData'), 'noveldrive.db');

  // ConnectionManagerの初期化
  connectionManager = ConnectionManager.getInstance();
  await connectionManager.initialize({ path: dbPath });

  // データベースの取得
  const db = connectionManager.getDatabase();

  // マイグレーションの実行
  const migration = new DatabaseMigration(db);
  await migration.migrate();

  // ApiUsageLoggerの初期化
  const apiLogger = new ApiUsageLogger(db);

  // IPCハンドラーの設定
  setupIPCHandlers();
  setupDatabaseHandlers(db);
  setupSerendipitySearchHandlers(db);
  setupCrawlerHandlers(db);
  setupAnythingBoxHandlers(db);
  setupAgentHandlers(db);
  setupPlotHandlers(db);
  setupChapterHandlers(db);
  
  // ApiUsageLoggerのハンドラー設定は初期化時に実行済み
}

function setupIPCHandlers(): void {
  // クエリ実行
  ipcMain.handle('db:query', wrapIPCHandler(
    async (_, sql: string, params?: unknown[]) => {
      if (!connectionManager) {
        throw new DatabaseError('データベース接続が初期化されていません');
      }

      return connectionManager.query(sql, params || []);
    },
    'データベースクエリの実行中にエラーが発生しました'
  ));

  // 実行（戻り値なし）
  ipcMain.handle('db:execute', wrapIPCHandler(
    async (_, sql: string, params?: unknown[]) => {
      if (!connectionManager) {
        throw new DatabaseError('データベース接続が初期化されていません');
      }

      connectionManager.run(sql, params || []);
      return { success: true };
    },
    'データベース操作の実行中にエラーが発生しました'
  ));

  // 日本語トークン化
  ipcMain.handle('tokenizer:tokenize', wrapIPCHandler(
    async (_, text: string) => {
      if (!text) {
        throw new ValidationError('テキストが指定されていません');
      }
      return getSearchTokens(text);
    },
    'トークン化の処理中にエラーが発生しました'
  ));

  // ナレッジの保存（日本語トークン化込み）
  ipcMain.handle('knowledge:save', wrapIPCHandler(
    async (_, knowledge: KnowledgeItem) => {
      if (!connectionManager) {
        throw new DatabaseError('データベース接続が初期化されていません');
      }

      // バリデーション
      if (!knowledge.id) {
        throw new ValidationError('知識IDが指定されていません');
      }
      if (!knowledge.title && !knowledge.content) {
        throw new ValidationError('タイトルまたはコンテンツが必要です');
      }

      // URLから生成された場合、既に存在しないかチェック
      const sourceUrl = knowledge.metadata?.url || knowledge.sourceUrl;
      if (sourceUrl) {
        const existingRow = connectionManager.queryOne<{ id: string }>(
          'SELECT id FROM knowledge WHERE source_url = ? LIMIT 1',
          [sourceUrl]
        );

        if (existingRow) {
          return {
            success: false,
            error: 'URL already exists in knowledge base',
            duplicate: true,
          };
        }
      }

      // 検索用トークンを生成
      const titleTokens = getSearchTokens(knowledge.title || '');
      const contentTokens = getSearchTokens(knowledge.content || '');
      const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');

      // ベクトル埋め込みを生成（まだない場合）
      let embedding = knowledge.embedding;
      if (!embedding && knowledge.content) {
        try {
          const localService = LocalEmbeddingService.getInstance();
          await localService.initialize();
          embedding = await localService.generateEmbedding(knowledge.title + ' ' + knowledge.content);
        } catch (error) {
          // Failed to generate embedding
        }
      }

      const sql = `
        INSERT INTO knowledge (id, title, content, type, project_id, embedding, metadata, search_tokens, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          type = excluded.type,
          project_id = excluded.project_id,
          embedding = excluded.embedding,
          metadata = excluded.metadata,
          search_tokens = excluded.search_tokens,
          source_url = excluded.source_url,
          updated_at = CURRENT_TIMESTAMP
      `;

      try {
        connectionManager.run(sql, [
          knowledge.id,
          knowledge.title,
          knowledge.content,
          knowledge.type,
          knowledge.projectId || null,
          JSON.stringify(embedding || null),
          JSON.stringify(knowledge.metadata || {}),
          searchTokens,
          sourceUrl || null,
        ]);

        return { success: true, searchTokens, embedding: !!embedding };
      } catch (error: any) {
        // UNIQUE制約違反の場合
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
          return {
            success: false,
            error: 'URL already exists in knowledge base',
            duplicate: true,
          };
        }
        throw error;
      }
    },
    'ナレッジの保存中にエラーが発生しました'
  ));
}

export async function closeDatabase(): Promise<void> {
  if (connectionManager) {
    await connectionManager.close();
    connectionManager = null;
  }
}

export function getDatabase(): Database.Database | null {
  return connectionManager?.getDatabase() || null;
}