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

  // 初期スキーマの作成（互換性のため残す）
  await createInitialSchema();

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

async function createInitialSchema(): Promise<void> {
  if (!conn) throw new Error('Database connection not initialized');

  // promisifyして非同期処理を扱いやすくする
  const runAsync = (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      conn?.run(sql, (err) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  };

  // VSSとFTS拡張のインストール
  try {
    await runAsync(`INSTALL vss;`);
    await runAsync(`LOAD vss;`);
  } catch (error) {
    // VSS extension not available, skipping...
  }

  try {
    await runAsync(`INSTALL fts;`);
    await runAsync(`LOAD fts;`);
  } catch (error) {
    // FTS extension not available, skipping...
  }

  // ナレッジテーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id VARCHAR PRIMARY KEY,
      title VARCHAR NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR NOT NULL,
      project_id VARCHAR,
      embedding TEXT,
      metadata TEXT,
      source_url VARCHAR UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // プロジェクトテーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR PRIMARY KEY,
      title VARCHAR NOT NULL,
      description TEXT,
      genre TEXT,
      target_audience VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // キャラクターテーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS characters (
      id VARCHAR PRIMARY KEY,
      project_id VARCHAR NOT NULL,
      name VARCHAR NOT NULL,
      profile TEXT,
      personality TEXT,
      speech_style TEXT,
      background TEXT,
      dialogue_samples TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // プロットテーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS plots (
      id VARCHAR PRIMARY KEY,
      project_id VARCHAR NOT NULL,
      version VARCHAR NOT NULL,
      parent_version VARCHAR,
      title VARCHAR NOT NULL,
      synopsis TEXT,
      structure TEXT,
      status VARCHAR NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // エージェント議論テーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS agent_discussions (
      id VARCHAR PRIMARY KEY,
      plot_id VARCHAR NOT NULL,
      participants TEXT,
      messages TEXT,
      conclusion TEXT,
      status VARCHAR NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id)
    );
  `);

  // チャプターテーブル
  await runAsync(`
    CREATE TABLE IF NOT EXISTS chapters (
      id VARCHAR PRIMARY KEY,
      plot_id VARCHAR NOT NULL,
      title VARCHAR NOT NULL,
      content TEXT,
      "order" INTEGER NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'draft',
      word_count INTEGER DEFAULT 0,
      character_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id)
    );
  `);

  // 日本語検索用のカラムを追加
  const tokenizerSQL = createDuckDBTokenizerFunction();
  const statements = tokenizerSQL.split(';').filter((s) => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      await runAsync(statement);
    }
  }
}

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
