/**
 * Jest テストのセットアップファイル
 */

// グローバルな設定
jest.setTimeout(10000);

// Electronのモック
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/tmp/test-user-data';
      }
      return '/tmp';
    }),
    getName: jest.fn(() => 'NovelDrive'),
    getVersion: jest.fn(() => '1.0.0')
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn()
    }
  }))
}));

// DuckDBのモック（必要に応じて）
jest.mock('duckdb', () => {
  const mockConnection = {
    run: jest.fn((sql: string, params: any, callback?: any) => {
      if (typeof params === 'function') {
        params(null);
      } else if (callback) {
        callback(null);
      }
    }),
    all: jest.fn((sql: string, params: any, callback?: any) => {
      if (typeof params === 'function') {
        params(null, []);
      } else if (callback) {
        callback(null, []);
      }
    }),
    get: jest.fn((sql: string, params: any, callback?: any) => {
      if (typeof params === 'function') {
        params(null, null);
      } else if (callback) {
        callback(null, null);
      }
    })
  };

  const mockDatabase = {
    connect: jest.fn(() => mockConnection),
    close: jest.fn((callback?: any) => {
      if (callback) callback();
    })
  };

  return {
    Database: jest.fn(() => mockDatabase)
  };
});

// consoleメソッドのモック（ノイズを減らす）
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// タイムアウトの設定
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});