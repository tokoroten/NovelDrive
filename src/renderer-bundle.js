// Webpackなどのバンドラーを使わずに、シンプルに動作させるための回避策
// DuckDB WASMをscriptタグで読み込む方式に変更

// DOM要素の取得
const counterDisplay = document.getElementById('counter');
const incrementBtn = document.getElementById('increment-btn');
const statusDisplay = document.getElementById('status');

let db;
let conn;

// DuckDB WASMの初期化（グローバル変数経由）
async function initializeDuckDB() {
  try {
    statusDisplay.textContent = 'Loading DuckDB WASM...';
    
    // duckdbがグローバルに読み込まれているか確認
    if (typeof duckdb === 'undefined') {
      throw new Error('DuckDB WASM not loaded');
    }
    
    // WASM URLsの設定
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    
    // DuckDBの初期化
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
    );
    
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    
    // 接続の作成
    conn = await db.connect();
    
    // テーブルの作成
    await conn.query(`
      CREATE TABLE IF NOT EXISTS counter (
        id INTEGER PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `);
    
    // 初期値の確認と挿入
    const result = await conn.query('SELECT COUNT(*) as count FROM counter');
    const count = result.toArray()[0].count;
    
    if (count === 0) {
      await conn.query('INSERT INTO counter (id, value) VALUES (1, 0)');
    }
    
    statusDisplay.textContent = 'DuckDB WASM ready';
    await updateCounter();
    
  } catch (error) {
    console.error('Failed to initialize DuckDB:', error);
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// カウンターの値を更新
async function updateCounter() {
  try {
    const result = await conn.query('SELECT value FROM counter WHERE id = 1');
    const rows = result.toArray();
    if (rows.length > 0) {
      counterDisplay.textContent = rows[0].value;
    }
  } catch (error) {
    statusDisplay.textContent = `Error: ${error.message}`;
  }
}

// インクリメントボタンのクリックハンドラー
incrementBtn.addEventListener('click', async () => {
  try {
    statusDisplay.textContent = 'Incrementing...';
    
    // カウンターをインクリメント
    await conn.query('UPDATE counter SET value = value + 1 WHERE id = 1');
    
    // 新しい値を取得して表示
    await updateCounter();
    statusDisplay.textContent = 'Counter incremented';
    
  } catch (error) {
    statusDisplay.textContent = `Error: ${error.message}`;
  }
});

// 初期化はDuckDB WASMが読み込まれた後に実行
window.addEventListener('load', () => {
  // DuckDB WASMが読み込まれるまで少し待つ
  setTimeout(initializeDuckDB, 100);
});