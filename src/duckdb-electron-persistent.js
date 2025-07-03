// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

let db = null;
let conn = null;

// DuckDB WASMを動的にロード（ローカルのnode_modulesから）
async function loadDuckDBWASM() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // node_modulesから直接読み込む
    script.src = '../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-blocking.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// DuckDB WASMの初期化（Electronファイル永続化版）
async function initializeDuckDB() {
  try {
    statusDisplay.textContent = 'Loading DuckDB WASM...';
    
    // DuckDB WASMライブラリをロード
    await loadDuckDBWASM();
    
    if (typeof duckdb === 'undefined') {
      throw new Error('DuckDB WASM failed to load');
    }
    
    statusDisplay.textContent = 'Initializing DuckDB...';
    
    // CDNからWASMファイルを取得
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    // Workerの作成
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    
    // DuckDBインスタンスの作成
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    
    // 永続化されたデータを読み込む
    const savedData = await window.electronAPI.loadDatabase();
    
    if (savedData && savedData.length > 0) {
      // 保存されたデータベースを復元
      statusDisplay.textContent = 'Restoring database from file...';
      await db.dropFile('database.db');
      await db.registerFileBuffer('database.db', new Uint8Array(savedData));
      conn = await db.connect();
      
      // データベースファイルをアタッチ
      await conn.query("ATTACH 'database.db' AS persistent");
      await conn.query("USE persistent");
    } else {
      // 新規データベースを作成
      statusDisplay.textContent = 'Creating new database...';
      await db.dropFile('database.db');
      await db.registerFileBuffer('database.db', new Uint8Array(0));
      conn = await db.connect();
      
      // 永続化用のデータベースを作成
      await conn.query("ATTACH 'database.db' AS persistent");
      await conn.query("USE persistent");
      
      // カウンターテーブルの作成
      await conn.query(`
        CREATE TABLE IF NOT EXISTS counter (
          id INTEGER PRIMARY KEY,
          value INTEGER NOT NULL
        )
      `);
      
      // 初期値を挿入
      await conn.query('INSERT INTO counter (id, value) VALUES (1, 0)');
      
      // 初回保存
      await saveDatabase();
    }
    
    statusDisplay.textContent = 'Database ready (file-backed)';
    await updateCounterDisplay();
    
  } catch (error) {
    console.error('DuckDB initialization error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// データベースをファイルに保存
async function saveDatabase() {
  try {
    // DuckDBからデータベースファイルを取得
    const buffer = await db.copyFileToBuffer('database.db');
    
    // Electronのメインプロセス経由でファイルに保存
    await window.electronAPI.saveDatabase(Array.from(buffer));
    
    console.log('Database saved to file');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// カウンター表示の更新
async function updateCounterDisplay() {
  try {
    const result = await conn.query('SELECT value FROM counter WHERE id = 1');
    const rows = result.toArray();
    if (rows.length > 0) {
      counterDisplay.textContent = rows[0].value;
    }
  } catch (error) {
    console.error('Failed to update display:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// インクリメントボタンのハンドラー
incrementBtn.addEventListener('click', async () => {
  if (!conn) {
    statusDisplay.textContent = 'Database not initialized';
    return;
  }
  
  try {
    statusDisplay.textContent = 'Incrementing...';
    
    // カウンターをインクリメント
    await conn.query('UPDATE counter SET value = value + 1 WHERE id = 1');
    
    // 表示を更新
    await updateCounterDisplay();
    
    // ファイルに保存
    await saveDatabase();
    
    statusDisplay.textContent = 'Counter incremented and saved to file';
    
  } catch (error) {
    console.error('Increment error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// アプリケーションの初期化
window.addEventListener('DOMContentLoaded', () => {
  initializeDuckDB();
});