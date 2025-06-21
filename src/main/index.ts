import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

// .envファイルを読み込む
const envPath = path.join(app.getPath('exe'), '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  config(); // デフォルトの.envを読み込む
}

let mainWindow: BrowserWindow | null = null;

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
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 設定を保存するためのストレージ
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings(): Record<string, any> {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return {};
}

function saveSettings(settings: Record<string, any>): void {
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

ipcMain.handle('settings:set', (_, key: string, value: any) => {
  const settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
});