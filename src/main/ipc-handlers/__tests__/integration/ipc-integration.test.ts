/**
 * IPCハンドラーの統合テスト
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ConnectionManager } from '../../../core/database/connection-manager';
import { DatabaseMigration } from '../../../services/database-migration';
import { setupAnythingBoxHandlers } from '../../../services/anything-box';
import { setupSerendipitySearchHandlers } from '../../../services/serendipity-search';
import { setupPlotHandlers } from '../../../services/plot-management';
import { setupChapterHandlers } from '../../../services/chapter-management';
import { LocalEmbeddingService } from '../../../services/local-embedding-service';
import * as path from 'path';
import * as fs from 'fs';

// Electronのモック
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn()
  }
}));

describe('IPC Handlers Integration Tests', () => {
  let connectionManager: ConnectionManager;
  let handlers: Map<string, Function> = new Map();
  const testDbPath = path.join(__dirname, 'test-ipc-integration.db');

  // IPCハンドラーのモック実装
  const mockIpcMain = {
    handle: (channel: string, handler: Function) => {
      handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel);
    }
  };

  // ハンドラーを呼び出すヘルパー関数
  async function invokeHandler(channel: string, ...args: any[]) {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Handler not found for channel: ${channel}`);
    }
    return handler({} as IpcMainInvokeEvent, ...args);
  }

  beforeAll(async () => {
    // テスト用データベースの準備
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // ConnectionManagerの初期化
    connectionManager = ConnectionManager.getInstance();
    await connectionManager.initialize({ path: testDbPath });

    // マイグレーションの実行
    const db = connectionManager.getDatabase();
    const migration = new DatabaseMigration(db);
    await migration.migrate();

    // LocalEmbeddingServiceの初期化
    const embeddingService = LocalEmbeddingService.getInstance();
    await embeddingService.initialize();

    // ipcMainのモックを設定
    (ipcMain.handle as jest.Mock).mockImplementation(mockIpcMain.handle);

    // ハンドラーのセットアップ
    const conn = connectionManager.getConnection();
    setupAnythingBoxHandlers(conn);
    setupSerendipitySearchHandlers(conn);
    setupPlotHandlers(conn);
    setupChapterHandlers(conn);
  });

  afterAll(async () => {
    // クリーンアップ
    await connectionManager.cleanup();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    handlers.clear();
  });

  describe('AnythingBox Handlers', () => {
    it('コンテンツを処理してナレッジを作成できる', async () => {
      const input = {
        content: 'これはテスト用のコンテンツです。アイデアやインスピレーションが含まれています。',
        type: 'text',
        projectId: 'test-project-1'
      };

      const result = await invokeHandler('anythingBox:process', input);

      expect(result.success).toBe(true);
      expect(result.processed).toBeDefined();
      expect(result.processed.originalId).toBeDefined();
      expect(result.processed.knowledgeCount).toBeGreaterThan(0);
      expect(result.saved).toBeGreaterThan(0);
    });

    it('空のコンテンツでエラーが発生する', async () => {
      const input = {
        content: '',
        type: 'text'
      };

      await expect(invokeHandler('anythingBox:process', input))
        .rejects.toThrow('入力内容が指定されていません');
    });

    it('処理履歴を取得できる', async () => {
      // まずコンテンツを処理
      const input = {
        content: '履歴テスト用コンテンツ',
        type: 'text',
        projectId: 'test-project-2'
      };
      await invokeHandler('anythingBox:process', input);

      // 履歴を取得
      const history = await invokeHandler('anythingBox:history', {
        projectId: 'test-project-2',
        limit: 10
      });

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Search Handlers', () => {
    beforeEach(async () => {
      // テスト用のナレッジを作成
      const conn = connectionManager.getConnection();
      const sql = `
        INSERT INTO knowledge (id, title, content, type, embedding, search_tokens, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `;

      const embeddingService = LocalEmbeddingService.getInstance();
      const embedding1 = await embeddingService.generateEmbedding('ファンタジー世界の魔法');
      const embedding2 = await embeddingService.generateEmbedding('科学技術の発展');

      await new Promise((resolve, reject) => {
        conn.run(sql, [
          'search-test-1',
          'ファンタジー世界の魔法',
          '魔法使いが住む世界の物語',
          'inspiration',
          JSON.stringify(embedding1),
          'ファンタジー 世界 魔法 魔法使い 住む 物語'
        ], (err) => err ? reject(err) : resolve(null));
      });

      await new Promise((resolve, reject) => {
        conn.run(sql, [
          'search-test-2',
          '科学技術の発展',
          '未来の技術と人類の進化',
          'article',
          JSON.stringify(embedding2),
          '科学 技術 発展 未来 人類 進化'
        ], (err) => err ? reject(err) : resolve(null));
      });
    });

    it('セレンディピティ検索が動作する', async () => {
      const results = await invokeHandler('search:serendipity', '魔法', {
        limit: 10,
        minScore: 0.1
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('score');
    });

    it('空のクエリでエラーが発生する', async () => {
      await expect(invokeHandler('search:serendipity', ''))
        .rejects.toThrow('検索クエリが指定されていません');
    });

    it('関連アイテム検索が動作する', async () => {
      const results = await invokeHandler('search:related', 'search-test-1', {
        limit: 5
      });

      expect(Array.isArray(results)).toBe(true);
      // 自分自身は除外されるので、他のアイテムが返される
      const ids = results.map((r: any) => r.id);
      expect(ids).not.toContain('search-test-1');
    });
  });

  describe('Plot Management Handlers', () => {
    it('プロットの作成・取得・更新ができる', async () => {
      // 作成
      const createResult = await invokeHandler('plots:create', {
        projectId: 'test-project-3',
        title: 'テストプロット',
        synopsis: 'これはテスト用のプロットです',
        structure: {
          acts: [],
          totalChapters: 10,
          estimatedLength: 100000,
          genre: 'ファンタジー',
          themes: ['冒険', '成長'],
          mainConflict: '主人公vs悪の帝王',
          resolution: '世界の平和'
        }
      });

      expect(createResult.success).toBe(true);
      expect(createResult.plot).toBeDefined();
      const plotId = createResult.plot.id;

      // 取得
      const getResult = await invokeHandler('plots:get', plotId);
      expect(getResult.success).toBe(true);
      expect(getResult.plot.title).toBe('テストプロット');

      // ステータス更新
      const updateResult = await invokeHandler('plots:updateStatus', plotId, 'approved');
      expect(updateResult.success).toBe(true);

      // 履歴取得
      const historyResult = await invokeHandler('plots:history', 'test-project-3');
      expect(historyResult.success).toBe(true);
      expect(historyResult.plots.length).toBeGreaterThan(0);
    });

    it('必須フィールドが不足している場合エラーが発生する', async () => {
      await expect(invokeHandler('plots:create', {
        projectId: 'test-project-3'
        // titleとsynopsisが不足
      })).rejects.toThrow('タイトルと概要は必須です');
    });

    it('無効なステータスでエラーが発生する', async () => {
      await expect(invokeHandler('plots:updateStatus', 'some-id', 'invalid-status'))
        .rejects.toThrow('無効なステータスです');
    });
  });

  describe('Chapter Management Handlers', () => {
    it('章の作成・取得・更新・削除ができる', async () => {
      // 作成
      const chapter = {
        plotId: 'test-plot-1',
        title: '第1章：始まり',
        content: 'これは第1章の内容です。',
        order: 1,
        status: 'draft' as const
      };

      const createResult = await invokeHandler('chapters:create', chapter);
      expect(createResult.id).toBeDefined();
      const chapterId = createResult.id;

      // 取得
      const retrieved = await invokeHandler('chapters:get', chapterId);
      expect(retrieved.title).toBe('第1章：始まり');
      expect(retrieved.wordCount).toBeGreaterThan(0);

      // 更新
      const updateResult = await invokeHandler('chapters:update', chapterId, {
        content: '更新された内容です。もっと長い文章になりました。',
        status: 'completed'
      });
      expect(updateResult.success).toBe(true);

      // 再取得して確認
      const updated = await invokeHandler('chapters:get', chapterId);
      expect(updated.content).toContain('更新された内容');
      expect(updated.status).toBe('completed');

      // プロットごとの章一覧
      const chapters = await invokeHandler('chapters:listByPlot', 'test-plot-1');
      expect(Array.isArray(chapters)).toBe(true);
      expect(chapters.length).toBeGreaterThan(0);

      // 削除
      const deleteResult = await invokeHandler('chapters:delete', chapterId);
      expect(deleteResult.success).toBe(true);

      // 削除後は取得できない
      await expect(invokeHandler('chapters:get', chapterId))
        .rejects.toThrow('チャプターが見つかりません');
    });

    it('必須フィールドが不足している場合エラーが発生する', async () => {
      await expect(invokeHandler('chapters:create', {
        title: '章タイトル'
        // plotIdが不足
      })).rejects.toThrow('プロットIDが指定されていません');
    });

    it('執筆提案を取得できる', async () => {
      const suggestions = await invokeHandler('agents:requestWritingSuggestions', {
        plotId: 'test-plot-1',
        chapterTitle: '第1章',
        previousContent: '前の章の内容',
        chapterOrder: 1
      });

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('suggestion');
      expect(suggestions[0]).toHaveProperty('agentName');
    });
  });
});