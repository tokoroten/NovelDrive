/**
 * ConnectionManagerの使用例
 */

import { ConnectionManager } from './connection-manager';
import { DatabaseError } from '../../utils/error-handler';

// 初期化例
export async function initializeDatabase(): Promise<ConnectionManager> {
  const manager = new ConnectionManager({
    path: './database.db',
    maxConnections: 5,
    connectTimeout: 3000
  });

  // イベントリスナーの設定
  manager.on('initialized', () => {
    console.log('Database initialized');
  });

  manager.on('connectionCreated', (id) => {
    console.log(`New connection created: ${id}`);
  });

  manager.on('connectionAcquired', (id) => {
    console.log(`Connection acquired: ${id}`);
  });

  manager.on('connectionReleased', (id) => {
    console.log(`Connection released: ${id}`);
  });

  await manager.initialize();
  
  return manager;
}

// 基本的なクエリ実行
export async function basicQueryExample(manager: ConnectionManager): Promise<void> {
  try {
    // シンプルなクエリ
    const results = await manager.query(
      'SELECT * FROM users WHERE age > ?',
      [18]
    );
    
    console.log('Query results:', results);
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error('Database error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// トランザクション使用例
export async function transactionExample(manager: ConnectionManager): Promise<void> {
  try {
    const result = await manager.transaction(async (conn) => {
      // トランザクション内で複数の操作を実行
      await new Promise((resolve, reject) => {
        conn.run(
          'INSERT INTO users (name, email) VALUES (?, ?)',
          ['John Doe', 'john@example.com'],
          (err) => err ? reject(err) : resolve(undefined)
        );
      });

      await new Promise((resolve, reject) => {
        conn.run(
          'UPDATE user_stats SET login_count = login_count + 1 WHERE user_id = ?',
          [1],
          (err) => err ? reject(err) : resolve(undefined)
        );
      });

      // トランザクションの結果を返す
      return { success: true, userId: 1 };
    });

    console.log('Transaction completed:', result);
  } catch (error) {
    console.error('Transaction failed:', error);
    // 自動的にロールバックされる
  }
}

// ヘルスチェックと統計情報
export async function monitoringExample(manager: ConnectionManager): Promise<void> {
  // ヘルスチェック
  const isHealthy = await manager.healthCheck();
  console.log('Database health:', isHealthy ? 'OK' : 'FAILED');

  // 統計情報の取得
  const stats = manager.getStats();
  console.log('Connection statistics:', {
    total: stats.totalConnections,
    active: stats.activeConnections,
    idle: stats.idleConnections,
    failed: stats.failedConnections,
    avgQueryTime: `${stats.averageQueryTime.toFixed(2)}ms`,
    totalQueries: stats.totalQueries
  });

  // 接続プールの詳細状態
  const poolStatus = manager.getPoolStatus();
  console.log('Connection pool status:', poolStatus);
}

// 並行処理の例
export async function concurrentQueriesExample(manager: ConnectionManager): Promise<void> {
  const queries = [
    manager.query('SELECT COUNT(*) as count FROM users'),
    manager.query('SELECT AVG(age) as avg_age FROM users'),
    manager.query('SELECT MAX(created_at) as latest FROM users'),
    manager.query('SELECT MIN(created_at) as earliest FROM users')
  ];

  try {
    const results = await Promise.all(queries);
    console.log('Concurrent query results:', results);
  } catch (error) {
    console.error('Concurrent queries failed:', error);
  }
}

// リトライ付きクエリの例
export async function retryQueryExample(
  manager: ConnectionManager, 
  maxRetries = 3
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await manager.query(
        'SELECT * FROM volatile_table WHERE status = ?',
        ['active']
      );
    } catch (error) {
      lastError = error as Error;
      console.log(`Query attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // 指数バックオフ
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Query failed after retries');
}

// クリーンアップ例
export async function cleanupExample(manager: ConnectionManager): Promise<void> {
  try {
    await manager.cleanup();
    console.log('Database connections cleaned up successfully');
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// 完全な使用例
export async function completeExample(): Promise<void> {
  let manager: ConnectionManager | null = null;
  
  try {
    // 初期化
    manager = await initializeDatabase();
    
    // 各種操作の実行
    await basicQueryExample(manager);
    await transactionExample(manager);
    await concurrentQueriesExample(manager);
    await monitoringExample(manager);
    
  } catch (error) {
    console.error('Database operations failed:', error);
  } finally {
    // 必ずクリーンアップ
    if (manager) {
      await cleanupExample(manager);
    }
  }
}