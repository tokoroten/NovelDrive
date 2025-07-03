/**
 * ConnectionManagerのテスト
 */

import { ConnectionManager } from '../connection-manager';
import { DatabaseError } from '../../../utils/error-handler';
import * as duckdb from 'duckdb';

// DuckDBのモック
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(function(this: any, dbPath: string) {
    this.path = dbPath;
    this.connect = jest.fn().mockReturnValue({
      all: jest.fn((sql: string, ...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null, [{ result: 1 }]);
        }
      }),
      run: jest.fn((sql: string, ...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      })
    });
  })
}));

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    // シングルトンインスタンスをリセット
    (ConnectionManager as any).instance = null;
    manager = ConnectionManager.getInstance();
  });

  afterEach(async () => {
    if (manager && manager.checkInitialized()) {
      await manager.close();
    }
  });

  describe('getInstance', () => {
    it('シングルトンインスタンスを返す', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('デフォルト設定で初期化できる', async () => {
      await manager.initialize();
      
      expect(manager.checkInitialized()).toBe(true);
      expect(duckdb.Database).toHaveBeenCalledWith(':memory:');
    });

    it('カスタムパスで初期化できる', async () => {
      await manager.initialize({ path: '/tmp/test.db' });
      
      expect(manager.checkInitialized()).toBe(true);
      expect(duckdb.Database).toHaveBeenCalledWith('/tmp/test.db');
    });

    it('二重初期化でエラーをスロー', async () => {
      await manager.initialize();
      
      await expect(manager.initialize()).rejects.toThrow(DatabaseError);
      await expect(manager.initialize()).rejects.toThrow('既にデータベースが初期化されています');
    });
  });

  describe('getDatabase', () => {
    it('初期化後にデータベースインスタンスを返す', async () => {
      await manager.initialize();
      
      const db = manager.getDatabase();
      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(duckdb.Database);
    });

    it('初期化前はエラーをスロー', () => {
      expect(() => manager.getDatabase()).toThrow(DatabaseError);
      expect(() => manager.getDatabase()).toThrow('データベースが初期化されていません');
    });
  });

  describe('query', () => {
    it('初期化後にクエリを実行できる', async () => {
      await manager.initialize();
      
      const result = manager.query('SELECT 1 as value');
      expect(result).toEqual([{ value: 1 }]);
    });

    it('初期化前はエラーをスロー', () => {
      expect(() => manager.query('SELECT 1')).toThrow(DatabaseError);
      expect(() => manager.query('SELECT 1')).toThrow('データベースが初期化されていません');
    });
  });

  describe('run', () => {
    it('INSERT文を実行できる', async () => {
      await manager.initialize();
      
      const info = manager.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      expect(info.changes).toBe(0);
      
      const insertInfo = manager.run('INSERT INTO test (name) VALUES (?)', ['Test']);
      expect(insertInfo.changes).toBe(1);
      expect(insertInfo.lastInsertRowid).toBeDefined();
    });
  });

  describe('releaseConnection', () => {
    it('コネクションを解放できる', async () => {
      await manager.initialize();
      
      const conn = await manager.getConnectionAsync();
      manager.releaseConnection(conn);
      
      // 解放後は再取得できる
      const conn2 = await manager.getConnectionAsync();
      expect(conn2).toBe(conn);
    });
  });

  describe('transaction', () => {
    it('トランザクションを実行できる', async () => {
      await manager.initialize();
      
      const mockCallback = jest.fn().mockResolvedValue({ result: 'success' });
      const result = await manager.transaction(mockCallback);
      
      expect(result).toEqual({ result: 'success' });
      expect(mockCallback).toHaveBeenCalled();
    });

    it('エラー時にロールバック', async () => {
      await manager.initialize();
      
      const mockCallback = jest.fn().mockRejectedValue(new Error('Transaction error'));
      
      await expect(manager.transaction(mockCallback)).rejects.toThrow('Transaction error');
    });
  });

  describe('query', () => {
    it('クエリを実行して結果を返す', async () => {
      await manager.initialize();
      
      const conn = manager.getConnection();
      (conn.all as jest.Mock).mockImplementationOnce((sql, ...args) => {
        const callback = args[args.length - 1];
        callback(null, [{ id: 1, name: 'test' }]);
      });
      
      const result = await manager.query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });

    it('クエリエラーをDatabaseErrorとしてスロー', async () => {
      await manager.initialize();
      
      const conn = manager.getConnection();
      (conn.all as jest.Mock).mockImplementationOnce((sql, ...args) => {
        const callback = args[args.length - 1];
        callback(new Error('Query failed'), null);
      });
      
      await expect(manager.query('SELECT * FROM invalid')).rejects.toThrow(DatabaseError);
    });
  });

  describe('healthCheck', () => {
    it('正常時はtrueを返す', async () => {
      await manager.initialize();
      
      const result = await manager.healthCheck();
      expect(result).toBe(true);
    });

    it('エラー時はfalseを返す', async () => {
      await manager.initialize();
      
      const conn = manager.getConnection();
      (conn.all as jest.Mock).mockImplementationOnce((sql, ...args) => {
        const callback = args[args.length - 1];
        callback(new Error('Health check failed'), null);
      });
      
      const result = await manager.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('統計情報を取得できる', async () => {
      await manager.initialize();
      
      const stats = manager.getStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('failedConnections');
      expect(stats).toHaveProperty('averageQueryTime');
      expect(stats).toHaveProperty('totalQueries');
    });
  });

  describe('getPoolStatus', () => {
    it('接続プールの状態を取得できる', async () => {
      await manager.initialize();
      
      const status = manager.getPoolStatus();
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('idle');
      expect(status).toHaveProperty('connections');
      expect(Array.isArray(status.connections)).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('すべてのリソースをクリーンアップ', async () => {
      await manager.initialize();
      
      await manager.cleanup();
      
      expect(manager.checkInitialized()).toBe(false);
      expect(() => manager.getDatabase()).toThrow(DatabaseError);
    });
  });

  describe('イベント', () => {
    it('初期化イベントが発火される', async () => {
      const onInitialized = jest.fn();
      manager.on('initialized', onInitialized);
      
      await manager.initialize();
      
      expect(onInitialized).toHaveBeenCalled();
    });

    it('クリーンアップイベントが発火される', async () => {
      await manager.initialize();
      
      const onCleanup = jest.fn();
      manager.on('cleanup', onCleanup);
      
      await manager.cleanup();
      
      expect(onCleanup).toHaveBeenCalled();
    });
  });
});