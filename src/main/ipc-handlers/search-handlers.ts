/**
 * 検索関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';

export function setupSearchHandlers(container: DIContainer): void {
  // セマンティック検索
  ipcMain.handle('search:semantic', async (_, query, options) => {
    // モック実装
    return {
      success: true,
      data: {
        results: [
          {
            id: '1',
            title: 'サンプル結果1',
            content: query + 'に関連する内容',
            score: 0.95,
            type: 'knowledge'
          },
          {
            id: '2',
            title: 'サンプル結果2',
            content: query + 'に関連する別の内容',
            score: 0.87,
            type: 'plot'
          }
        ],
        totalCount: 2,
        searchTime: 123
      }
    };
  });

  // フルテキスト検索
  ipcMain.handle('search:fulltext', async (_, query, options) => {
    // モック実装
    return {
      success: true,
      data: {
        results: [
          {
            id: '3',
            title: 'テキストマッチ結果',
            content: `"${query}"を含むテキスト`,
            highlights: [query],
            type: 'document'
          }
        ],
        totalCount: 1,
        searchTime: 45
      }
    };
  });

  // ハイブリッド検索
  ipcMain.handle('search:hybrid', async (_, query, options) => {
    // モック実装
    return {
      success: true,
      data: {
        results: [
          {
            id: '4',
            title: 'ハイブリッド検索結果',
            content: 'セマンティックとフルテキストの組み合わせ',
            score: 0.92,
            matchType: 'hybrid'
          }
        ],
        totalCount: 1,
        searchTime: 178
      }
    };
  });
}