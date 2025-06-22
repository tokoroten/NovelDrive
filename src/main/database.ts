import { ipcMain, app } from 'electron';
import * as duckdb from 'duckdb';
import * as path from 'path';
import { getSearchTokens, createDuckDBTokenizerFunction } from './services/japanese-tokenizer';
import { LocalEmbeddingService } from './services/local-embedding-service';
import { setupSerendipitySearchHandlers } from './services/serendipity-search';
import { setupCrawlerHandlers } from './services/web-crawler';
import { setupAnythingBoxHandlers } from './services/anything-box';
import { setupAgentHandlers } from './services/agent-handlers';
import { setupPlotHandlers } from './services/plot-management';
import { setupChapterHandlers } from './services/chapter-management';
import { DatabaseMigration } from './services/database-migration';
import { setupDuckDBVSS } from './services/duckdb-vss-setup';
import { setupDatabaseHandlers } from './services/database-handlers';
import { ApiUsageLogger } from './services/api-usage-logger';

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

let db: duckdb.Database | null = null;
let conn: duckdb.Connection | null = null;

export async function initializeDatabase(): Promise<void> {
  // データベースファイルのパスを設定
  const dbPath = path.join(app.getPath('userData'), 'noveldrive.db');

  // DuckDBインスタンスの作成
  db = new duckdb.Database(dbPath);

  // 接続の作成
  conn = db.connect();

  // マイグレーションの実行
  const migration = new DatabaseMigration(db);
  await migration.migrate();

  // DuckDB VSSのセットアップ
  try {
    await setupDuckDBVSS(conn);
  } catch (error) {
    console.warn('DuckDB VSS setup failed (will use fallback):', error);
  }

  // データベース最適化
  // インデックスはマイグレーションで作成されるため、ここでは不要

  // スキーマの作成はすべてマイグレーションで管理
  // createInitialSchema()は不要

  // ApiUsageLoggerの初期化
  const apiLogger = new ApiUsageLogger(db);

  // IPCハンドラーの設定
  setupIPCHandlers();
  setupDatabaseHandlers(conn);
  setupSerendipitySearchHandlers(conn);
  setupCrawlerHandlers(conn);
  setupAnythingBoxHandlers(conn);
  setupAgentHandlers(conn);
  setupPlotHandlers(conn);
  setupChapterHandlers(conn);
  
  // ApiUsageLoggerのハンドラー設定は初期化時に実行済み
}

// 初期スキーマの作成関数は不要になったため削除
// すべてのスキーマ管理はDatabaseMigrationクラスで行う

function setupIPCHandlers(): void {
  // クエリ実行
  ipcMain.handle('db:query', async (_, sql: string, params?: unknown[]) => {
    if (!conn) throw new Error('Database connection not initialized');

    return new Promise((resolve, reject) => {
      conn?.all(sql, params || [], (err, rows) => {
        if (err) {
          // Database query error
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  });

  // 実行（戻り値なし）
  ipcMain.handle('db:execute', async (_, sql: string, params?: unknown[]) => {
    if (!conn) throw new Error('Database connection not initialized');

    return new Promise((resolve, reject) => {
      conn?.run(sql, params || [], (err) => {
        if (err) {
          // Database execute error
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // 日本語トークン化
  ipcMain.handle('tokenizer:tokenize', async (_, text: string) => {
    return getSearchTokens(text);
  });

  // ナレッジの保存（日本語トークン化込み）
  ipcMain.handle('knowledge:save', async (_, knowledge: KnowledgeItem) => {
    if (!conn) throw new Error('Database connection not initialized');

    // URLから生成された場合、既に存在しないかチェック
    const sourceUrl = knowledge.metadata?.url || knowledge.sourceUrl;
    if (sourceUrl) {
      const existingCheck = await new Promise<boolean>((resolve) => {
        conn?.all(
          'SELECT id FROM knowledge WHERE source_url = ? LIMIT 1',
          [sourceUrl],
          (err, rows) => {
            if (err) {
              // URL check error
              resolve(false);
            } else {
              resolve(rows && rows.length > 0);
            }
          }
        );
      });

      if (existingCheck) {
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

    return new Promise((resolve, reject) => {
      conn?.run(
        sql,
        [
          knowledge.id,
          knowledge.title,
          knowledge.content,
          knowledge.type,
          knowledge.projectId || null,
          JSON.stringify(embedding || null),
          JSON.stringify(knowledge.metadata || {}),
          searchTokens,
          sourceUrl || null,
        ],
        (err) => {
          if (err) {
            // UNIQUE制約違反の場合
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
              resolve({
                success: false,
                error: 'URL already exists in knowledge base',
                duplicate: true,
              });
            } else {
              // Knowledge save error
              reject(err);
            }
          } else {
            resolve({ success: true, searchTokens, embedding: !!embedding });
          }
        }
      );
    });
  });
}

export async function closeDatabase(): Promise<void> {
  return new Promise((resolve) => {
    if (conn) {
      conn.close(() => {
        conn = null;
        if (db) {
          db.close(() => {
            db = null;
            resolve();
          });
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

export function getDatabase(): duckdb.Database | null {
  return db;
}
