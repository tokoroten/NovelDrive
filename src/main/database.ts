import { ipcMain, app } from 'electron';
import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';
import { getSearchTokens, createDuckDBTokenizerFunction } from './services/japanese-tokenizer';

let db: duckdb.Database | null = null;
let conn: duckdb.Connection | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    // データベースファイルのパスを設定
    const dbPath = path.join(app.getPath('userData'), 'noveldrive.db');
    
    // DuckDBインスタンスの作成
    db = new duckdb.Database(dbPath);
    
    // 接続の作成
    conn = db.connect();
    
    // 初期スキーマの作成
    await createInitialSchema();
    
    // IPCハンドラーの設定
    setupIPCHandlers();
    
    console.log('Database initialized successfully at:', dbPath);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createInitialSchema(): Promise<void> {
  if (!conn) throw new Error('Database connection not initialized');
  
  // promisifyして非同期処理を扱いやすくする
  const runAsync = (sql: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      conn!.run(sql, (err) => {
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
    console.log('VSS extension not available, skipping...');
  }
  
  try {
    await runAsync(`INSTALL fts;`);
    await runAsync(`LOAD fts;`);
  } catch (error) {
    console.log('FTS extension not available, skipping...');
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
  
  // 日本語検索用のカラムを追加
  const tokenizerSQL = createDuckDBTokenizerFunction();
  const statements = tokenizerSQL.split(';').filter(s => s.trim());
  for (const statement of statements) {
    if (statement.trim()) {
      await runAsync(statement);
    }
  }
}

function setupIPCHandlers(): void {
  // クエリ実行
  ipcMain.handle('db:query', async (_, sql: string, params?: any[]) => {
    if (!conn) throw new Error('Database connection not initialized');
    
    return new Promise((resolve, reject) => {
      conn!.all(sql, params || [], (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  });
  
  // 実行（戻り値なし）
  ipcMain.handle('db:execute', async (_, sql: string, params?: any[]) => {
    if (!conn) throw new Error('Database connection not initialized');
    
    return new Promise((resolve, reject) => {
      conn!.run(sql, params || [], (err) => {
        if (err) {
          console.error('Database execute error:', err);
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
  ipcMain.handle('knowledge:save', async (_, knowledge: any) => {
    if (!conn) throw new Error('Database connection not initialized');
    
    // 検索用トークンを生成
    const titleTokens = getSearchTokens(knowledge.title || '');
    const contentTokens = getSearchTokens(knowledge.content || '');
    const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');
    
    const sql = `
      INSERT INTO knowledge (id, title, content, type, project_id, embedding, metadata, search_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        type = excluded.type,
        project_id = excluded.project_id,
        embedding = excluded.embedding,
        metadata = excluded.metadata,
        search_tokens = excluded.search_tokens,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    return new Promise((resolve, reject) => {
      conn!.run(sql, [
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId || null,
        JSON.stringify(knowledge.embedding || null),
        JSON.stringify(knowledge.metadata || {}),
        searchTokens
      ], (err) => {
        if (err) {
          console.error('Knowledge save error:', err);
          reject(err);
        } else {
          resolve({ success: true, searchTokens });
        }
      });
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