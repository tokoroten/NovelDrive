import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';
import { initializeDatabase, closeDatabase, getDatabase } from './database';
import { initializeOpenAI, updateApiKey, setupOpenAIHandlers } from './services/openai-service';
import { setupLocalEmbeddingHandlers } from './services/local-embedding-service';
import { initializeApiUsageLogger, setupApiUsageHandlers } from './services/api-usage-logger';
import { initializeAutonomousMode, cleanup as cleanupServices } from './services/service-initializer';
import { setupAnythingBoxHandlers } from './services/anything-box';
import { DIContainer } from './core/di-container';
import { registerServices, cleanupServices as cleanupDIServices } from './services/service-registry';
import { setupIPCHandlers } from './ipc-handlers';

// .envファイルを読み込む
const envPath = path.join(app.getPath('exe'), '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  config(); // デフォルトの.envを読み込む
}

let mainWindow: BrowserWindow | null = null;
let container: DIContainer | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f5',
  });

  // 開発中はローカルサーバーから読み込み
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3003');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // データベースの初期化
  try {
    await initializeDatabase();
    
    // DIコンテナの初期化
    const db = getDatabase();
    if (db) {
      container = new DIContainer();
      await registerServices(container, db);
      
      // API使用ログサービスの初期化
      initializeApiUsageLogger(db);
      setupApiUsageHandlers();
      
      // IPCハンドラーの設定
      await setupIPCHandlers(container);
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
    app.quit();
    return;
  }

  // 旧ハンドラー設定は新しいDIコンテナベースのアーキテクチャに移行済み
  // OpenAI APIの初期化
  // const apiKey = process.env.OPENAI_API_KEY || loadSettings().openai_api_key;
  // if (apiKey) {
  //   initializeOpenAI(apiKey as string);
  // }
  // setupOpenAIHandlers();
  
  // ローカル埋め込みサービスのハンドラー設定
  // setupLocalEmbeddingHandlers();

  // なんでもボックスのハンドラー設定 - ipc-handlers.tsに移行済み
  // const db = getDatabase();
  // if (db) {
  //   const conn = db.connect();
  //   setupAnythingBoxHandlers(conn);
  // }

  // 自律モードシステムの初期化
  // try {
  //   if (db) {
  //     const conn = db.connect();
  //     await initializeAutonomousMode(conn);
  //   }
  // } catch (error) {
  //   console.error('Failed to initialize autonomous mode:', error);
  // }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // サービスのクリーンアップ
  await cleanupServices();
  
  // DIコンテナのクリーンアップ
  if (container) {
    await cleanupDIServices(container);
  }
  
  // データベースのクローズ
  await closeDatabase();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // サービスのクリーンアップ
  await cleanupServices();
  
  // DIコンテナのクリーンアップ
  if (container) {
    await cleanupDIServices(container);
  }
  
  await closeDatabase();
});

// 設定を保存するためのストレージ
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return {};
}

function saveSettings(settings: Record<string, unknown>): void {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// IPC通信のハンドラー設定
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// 設定関連のハンドラー
ipcMain.handle('settings:get', (_, key: string) => {
  const settings = loadSettings();
  // 環境変数を優先
  if (key === 'openai_api_key' && process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  return settings[key];
});

ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);

  // OpenAI APIキーが更新された場合
  if (key === 'openai_api_key' && typeof value === 'string') {
    updateApiKey(value);
  }
});
