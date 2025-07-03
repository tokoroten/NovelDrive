// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

let db = null;
let conn = null;

// DuckDB WASMを動的にロード
async function loadDuckDBWASM() {
  // スクリプトタグを動的に追加
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-blocking.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// DuckDB WASMの初期化
async function initializeDuckDB() {
  try {
    statusDisplay.textContent = 'Loading DuckDB WASM library...';
    
    // DuckDB WASMライブラリをロード
    await loadDuckDBWASM();
    
    // グローバル変数duckdbが利用可能になるまで待つ
    if (typeof duckdb === 'undefined') {
      throw new Error('DuckDB WASM failed to load');
    }
    
    statusDisplay.textContent = 'Initializing DuckDB...';
    
    // CDNからWASMファイルを取得
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    
    // 適切なバンドルを選択
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    // Workerの作成
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
    );
    const worker = new Worker(worker_url);
    
    // ロガーの設定
    const logger = new duckdb.ConsoleLogger();
    
    // DuckDBインスタンスの作成（永続化のためIndexedDBを使用）
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    // IndexedDBを使用してデータを永続化
    await db.open({
      path: ':memory:',  // メモリDBを使用
      access_mode: 'READ_WRITE'
    });
    
    // Worker URLをクリーンアップ
    URL.revokeObjectURL(worker_url);
    
    statusDisplay.textContent = 'Creating connection...';
    
    // コネクションの作成
    conn = await db.connect();
    
    // カウンターテーブルの作成
    await conn.query(`
      CREATE TABLE IF NOT EXISTS counter (
        id INTEGER PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `);
    
    // 初期データの確認
    const countResult = await conn.query('SELECT COUNT(*) as cnt FROM counter');
    const count = countResult.toArray()[0].cnt;
    
    if (count === 0) {
      // 初期値を挿入
      await conn.query('INSERT INTO counter (id, value) VALUES (1, 0)');
      statusDisplay.textContent = 'Database initialized with counter = 0';
    } else {
      statusDisplay.textContent = 'Database loaded successfully';
    }
    
    // 現在の値を表示
    await updateCounterDisplay();
    
  } catch (error) {
    console.error('DuckDB initialization error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
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
    
    statusDisplay.textContent = 'Counter incremented';
    
    // 永続化の確認（DuckDB WASMはメモリ内DBなので、実際の永続化には追加処理が必要）
    setTimeout(() => {
      statusDisplay.textContent = 'Ready (in-memory database)';
    }, 1000);
    
  } catch (error) {
    console.error('Increment error:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// アプリケーションの初期化
window.addEventListener('DOMContentLoaded', () => {
  initializeDuckDB();
});