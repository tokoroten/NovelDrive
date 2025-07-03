const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let mainWindow;
let db;

// ウィンドウの作成
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // セキュリティを有効に戻す
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 開発モードの場合はDevToolsを開く
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // キャッシュをクリア
  mainWindow.webContents.session.clearCache();
}

// SQLite3データベースの初期化
async function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'noveldrive.db');
  
  try {
    // データベースを開く（なければ作成）
    db = new Database(dbPath);
    
    // カウンターテーブルの作成
    db.prepare(`
      CREATE TABLE IF NOT EXISTS counter (
        id INTEGER PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `).run();
    
    // 初期値の確認
    const row = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    
    if (!row) {
      // 初期値を挿入
      db.prepare('INSERT INTO counter (id, value) VALUES (1, 0)').run();
      console.log('Created initial counter with value 0');
    } else {
      console.log('Loaded counter value:', row.value);
    }
    
    console.log('SQLite database initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// アプリケーションの準備完了時
app.whenReady().then(async () => {
  try {
    await initializeDatabase();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// すべてのウィンドウが閉じられた時
app.on('window-all-closed', () => {
  // データベースを閉じる
  if (db) {
    db.close();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPCハンドラー（SQLite3版）
ipcMain.handle('get-counter', async () => {
  try {
    const row = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    return { value: row ? row.value : 0 };
  } catch (error) {
    console.error('Failed to get counter:', error);
    return { value: 0 };
  }
});

ipcMain.handle('increment-counter', async () => {
  try {
    // トランザクションで安全に更新
    const stmt = db.prepare('UPDATE counter SET value = value + 1 WHERE id = 1');
    stmt.run();
    
    // 更新後の値を取得
    const row = db.prepare('SELECT value FROM counter WHERE id = 1').get();
    return { value: row.value };
  } catch (error) {
    console.error('Failed to increment counter:', error);
    throw error;
  }
});

// DuckDB WASM永続化用のIPCハンドラー
let duckdbPath;

app.whenReady().then(() => {
  duckdbPath = path.join(app.getPath('userData'), 'duckdb-database.db');
});

ipcMain.handle('save-database', async (event, data) => {
  try {
    // Uint8Arrayに変換
    const buffer = Buffer.from(data);
    fs.writeFileSync(duckdbPath, buffer);
    return { success: true };
  } catch (error) {
    console.error('Failed to save database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-database', async () => {
  try {
    if (fs.existsSync(duckdbPath)) {
      const buffer = fs.readFileSync(duckdbPath);
      return Array.from(buffer);
    }
    return null;
  } catch (error) {
    console.error('Failed to load database:', error);
    return null;
  }
});