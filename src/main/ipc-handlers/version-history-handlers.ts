/**
 * バージョン履歴関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { VersionHistoryService } from '../services/version-history-service';

export function setupVersionHistoryHandlers(container: DIContainer): void {
  // バージョンの作成
  ipcMain.handle('versionHistory:create', async (_, documentId: string, description?: string) => {
    try {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const version = await service.createVersion(documentId, description);
      return { success: true, data: version };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バージョンの作成に失敗しました' 
      };
    }
  });

  // バージョン履歴の取得
  ipcMain.handle('versionHistory:list', async (_, documentId: string) => {
    try {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const versions = await service.getVersionHistory(documentId);
      return { success: true, data: versions };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バージョン履歴の取得に失敗しました' 
      };
    }
  });

  // バージョンからの復元
  ipcMain.handle('versionHistory:restore', async (_, versionId: string) => {
    try {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      await service.restoreVersion(versionId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バージョンの復元に失敗しました' 
      };
    }
  });

  // バージョン間の差分取得
  ipcMain.handle('versionHistory:diff', async (_, fromVersionId: string, toVersionId: string) => {
    try {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const diff = await service.getDiff(fromVersionId, toVersionId);
      return { success: true, data: diff };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '差分の取得に失敗しました' 
      };
    }
  });
}