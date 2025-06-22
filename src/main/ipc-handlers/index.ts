/**
 * IPCハンドラーの統合設定
 * 各機能別のハンドラーをインポートして設定
 */

import { DIContainer } from '../core/di-container';
import { setupKnowledgeHandlers } from './knowledge-handlers';
import { setupPlotHandlers } from './plot-handlers';
import { setupAgentHandlers } from './agent-handlers';
import { setupChapterHandlers } from './chapter-handlers';
import { setupAIHandlers } from './ai-handlers';
import { setupBackupHandlers } from './backup-handlers';
import { setupAutonomousHandlers } from './autonomous-handlers';
import { setupVersionHistoryHandlers } from './version-history-handlers';
import { setupFileHandlers } from './file-handlers';
import { setupSearchHandlers } from './search-handlers';
import { setupSystemHandlers } from './system-handlers';

export async function setupIPCHandlers(container: DIContainer): Promise<void> {
  // 各機能別のハンドラーを設定
  setupKnowledgeHandlers(container);
  setupPlotHandlers(container);
  setupAgentHandlers(container);
  setupChapterHandlers(container);
  setupAIHandlers(container);
  setupBackupHandlers(container);
  setupAutonomousHandlers(container);
  setupVersionHistoryHandlers(container);
  setupFileHandlers(container);
  setupSearchHandlers(container);
  setupSystemHandlers(container);

  console.log('All IPC handlers have been set up successfully');
}

// 型定義のエクスポート
export * from './types';