/**
 * ConnectionManagerのテスト
 */

import { ConnectionManager } from '../connection-manager';
import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

// DuckDBのモック
jest.mock('duckdb', () => ({
  Database: jest.fn().mockImplementation(function(this: any, dbPath: string) {
    this.path = dbPath;
    this.connect = jest.fn().mockReturnValue({
      close: jest.fn((callback) => callback()),
      all: jest.fn(),
      run: jest.fn(),
      prepare: jest.fn()
    });
    this.close = jest.fn((callback) => callback());
  })
}));

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  const testDbPath = '/tmp/test.db';

  beforeEach(() => {
    // シングルトンインスタンスをリセット
    (ConnectionManager as any).instance = null;
    manager = ConnectionManager.getInstance();
  });

  afterEach(async () => {
    if (manager) {
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
      
      expect(manager.isInitialized()).toBe(true);
      expect(duckdb.Database).toHaveBeenCalledWith(':memory:');
    });

    it('カスタムパスで初期化できる', async () => {
      await manager.initialize({ path: testDbPath });
      
      expect(manager.isInitialized()).toBe(true);
      expect(duckdb.Database).toHaveBeenCalledWith(testDbPath);
    });

    it('読み取り専用モードで初期化できる', async () => {
      await manager.initialize({ path: testDbPath, readOnly: true });
      
      expect(manager.isInitialized()).toBe(true);
      expect((manager as any).options.readOnly).toBe(true);
    });

    it('既に初期化されている場合はエラーをスロー', async () => {
      await manager.initialize();
      
      await expect(manager.initialize()).rejects.toThrow('既にデータベースが初期化されています');
    });
  });

  describe('getDatabase', () => {
    it('初期化後にデータベースインスタンスを返す', async () => {
      await manager.initialize();
      
      const db = manager.getDatabase();
      expect(db).toBeDefined();
      expect(db).toHaveProperty('connect');
    });

    it('初期化前はエラーをスロー', () => {
      expect(() => manager.getDatabase()).toThrow('データベースが初期化されていません');
    });
  });

  describe('getConnection', () => {
    it('初期化後に接続を返す', async () => {
      await manager.initialize();
      
      const conn = manager.getConnection();
      expect(conn).toBeDefined();
      expect(conn).toHaveProperty('all');
      expect(conn).toHaveProperty('run');
    });

    it('初期化前はエラーをスロー', () => {
      expect(() => manager.getConnection()).toThrow('データベースが初期化されていません');
    });
  });

  describe('createConnection', () => {
    it('新しい接続を作成する', async () => {
      await manager.initialize();
      
      const conn = manager.createConnection();
      expect(conn).toBeDefined();
      expect(conn).not.toBe(manager.getConnection());
    });
  });

  describe('close', () => {
    it('データベースと接続を閉じる', async () => {
      await manager.initialize();
      const db = manager.getDatabase();
      const conn = manager.getConnection();
      
      await manager.close();
      
      expect(conn.close).toHaveBeenCalled();
      expect(db.close).toHaveBeenCalled();
      expect(manager.isInitialized()).toBe(false);
    });

    it('初期化されていない場合は何もしない', async () => {
      await expect(manager.close()).resolves.not.toThrow();
    });
  });

  describe('executeTransaction', () => {
    it('トランザクション内で関数を実行する', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      conn.run = jest.fn((sql, callback) => callback(null));
      
      const result = await manager.executeTransaction(async (txConn) => {
        expect(txConn).toBe(conn);
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(conn.run).toHaveBeenCalledWith('BEGIN', expect.any(Function));
      expect(conn.run).toHaveBeenCalledWith('COMMIT', expect.any(Function));
    });

    it('エラー時にロールバックする', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      conn.run = jest.fn((sql, callback) => callback(null));
      
      await expect(
        manager.executeTransaction(async () => {
          throw new Error('Transaction error');
        })
      ).rejects.toThrow('Transaction error');
      
      expect(conn.run).toHaveBeenCalledWith('BEGIN', expect.any(Function));
      expect(conn.run).toHaveBeenCalledWith('ROLLBACK', expect.any(Function));
    });
  });

  describe('query', () => {
    it('クエリを実行して結果を返す', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      const mockResults = [{ id: 1, name: 'test' }];
      conn.all = jest.fn((sql, params, callback) => callback(null, mockResults));
      
      const results = await manager.query('SELECT * FROM users WHERE id = ?', [1]);
      
      expect(results).toEqual(mockResults);
      expect(conn.all).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        [1],
        expect.any(Function)
      );
    });

    it('クエリエラーをスロー', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      conn.all = jest.fn((sql, params, callback) => callback(new Error('Query error'), null));
      
      await expect(
        manager.query('SELECT * FROM invalid_table')
      ).rejects.toThrow('クエリの実行に失敗しました');
    });
  });

  describe('execute', () => {
    it('SQLを実行する', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      conn.run = jest.fn((sql, params, callback) => callback(null));
      
      await manager.execute('INSERT INTO users (name) VALUES (?)', ['test']);
      
      expect(conn.run).toHaveBeenCalledWith(
        'INSERT INTO users (name) VALUES (?)',
        ['test'],
        expect.any(Function)
      );
    });

    it('実行エラーをスロー', async () => {
      await manager.initialize();
      const conn = manager.getConnection();
      conn.run = jest.fn((sql, params, callback) => callback(new Error('Execute error')));
      
      await expect(
        manager.execute('DELETE FROM invalid_table')
      ).rejects.toThrow('SQLの実行に失敗しました');
    });
  });

  describe('健全性チェック', () => {
    it('複数の接続を管理できる', async () => {
      await manager.initialize();
      
      const conn1 = manager.getConnection();
      const conn2 = manager.createConnection();
      const conn3 = manager.createConnection();
      
      expect(conn1).not.toBe(conn2);
      expect(conn2).not.toBe(conn3);
      expect(conn1).not.toBe(conn3);
    });
  });
});