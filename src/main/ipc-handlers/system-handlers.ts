/**
 * システム関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { InMemoryTaskQueue } from '../core/async/task-queue';
import { SystemStats } from './types';

export function setupSystemHandlers(container: DIContainer): void {
  // システム統計の取得
  ipcMain.handle('system:getStats', async (_): Promise<SystemStats> => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime()
    };
  });

  // タスクキューへのタスク追加
  ipcMain.handle('task:enqueue', async (_, type: string, payload, options) => {
    const taskQueue = await container.get<InMemoryTaskQueue>('taskQueue');
    const taskId = await taskQueue.enqueue({ type, payload }, options);
    return taskId;
  });

  // タスク結果の取得
  ipcMain.handle('task:getResult', async (_, taskId: string, timeout?: number) => {
    const taskQueue = await container.get<InMemoryTaskQueue>('taskQueue');
    try {
      const result = await taskQueue.waitForResult(taskId, timeout);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'タスクの実行に失敗しました' };
    }
  });

  // タスクキューの統計取得
  ipcMain.handle('task:getStats', async (_) => {
    const taskQueue = await container.get<InMemoryTaskQueue>('taskQueue');
    const stats = taskQueue.getStats();
    return stats;
  });

  // データベースクエリ実行（読み取り専用）
  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    // セキュリティ: 読み取り専用のクエリのみ許可
    const readOnlyKeywords = ['select', 'with'];
    const forbiddenKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'create'];
    
    const normalizedSql = sql.toLowerCase().trim();
    const isReadOnly = readOnlyKeywords.some(keyword => normalizedSql.startsWith(keyword));
    const hasForbidden = forbiddenKeywords.some(keyword => normalizedSql.includes(keyword));
    
    if (!isReadOnly || hasForbidden) {
      return { success: false, error: '読み取り専用のクエリのみ実行できます' };
    }

    // モック実装
    return { success: true, data: [] };
  });

  // データベースコマンド実行
  ipcMain.handle('db:execute', async (_, sql: string, params: unknown[] = []) => {
    // 管理者権限が必要な操作
    // モック実装
    return { success: false, error: '管理者権限が必要です' };
  });

  // Anything Box
  ipcMain.handle('anythingBox:add', async (_, content, metadata) => {
    // モック実装
    return {
      success: true,
      data: {
        id: Math.random().toString(36).substring(7),
        content,
        metadata,
        type: 'inspiration',
        createdAt: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('anythingBox:getRecent', async (_, limit) => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });

  // トークナイザー
  ipcMain.handle('tokenizer:tokenize', async (_, text) => {
    // モック実装 - 実際にはTinySegmenterを使用
    const tokens = text.split(/[\s、。]/g).filter(t => t.length > 0);
    return {
      success: true,
      data: { tokens }
    };
  });

  // クローラー
  ipcMain.handle('crawler:crawl', async (_, url, options) => {
    // モック実装
    return {
      success: true,
      data: {
        url,
        title: 'クロールされたページ',
        content: 'ページの内容',
        links: [],
        metadata: {}
      }
    };
  });
}