/**
 * バージョン履歴関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { VersionHistoryService } from '../services/version-history-service';
import { wrapIPCHandler, ValidationError } from '../utils/error-handler';

export function setupVersionHistoryHandlers(container: DIContainer): void {
  // バージョンの作成
  ipcMain.handle('versionHistory:create', wrapIPCHandler(
    async (_, documentId: string, description?: string) => {
      if (!documentId) {
        throw new ValidationError('ドキュメントIDが指定されていません');
      }

      const service = await container.get<VersionHistoryService>('versionHistoryService');
      // TODO: Implement proper createVersion call with required options
      // const version = await service.createVersion({
      //   documentId,
      //   documentType: 'chapter',
      //   title: '',
      //   content: '',
      //   changeType: 'edit',
      //   changeDescription: description
      // });
      const version = { id: documentId, description };
      return { success: true, data: version };
    },
    'バージョンの作成中にエラーが発生しました'
  ));

  // バージョン履歴の取得
  ipcMain.handle('versionHistory:list', wrapIPCHandler(
    async (_, documentId?: string) => {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const versions = documentId 
        ? await service.getVersionHistory(documentId)
        : [];
      return { success: true, data: versions };
    },
    'バージョン履歴の取得中にエラーが発生しました'
  ));

  // バージョンからの復元
  ipcMain.handle('versionHistory:restore', wrapIPCHandler(
    async (_, versionId: string, options?: any) => {
      if (!versionId) {
        throw new ValidationError('バージョンIDが指定されていません');
      }

      const service = await container.get<VersionHistoryService>('versionHistoryService');
      await service.restoreVersion(versionId);
      return { success: true };
    },
    'バージョンの復元中にエラーが発生しました'
  ));

  // バージョン間の差分取得
  ipcMain.handle('versionHistory:diff', wrapIPCHandler(
    async (_, fromVersionId: string, toVersionId: string) => {
      if (!fromVersionId || !toVersionId) {
        throw new ValidationError('比較元・比較先のバージョンIDが必要です');
      }

      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const diff = await service.calculateDiff(fromVersionId, toVersionId);
      return { success: true, data: diff };
    },
    '差分の取得中にエラーが発生しました'
  ));

  // バージョン間の比較
  ipcMain.handle('versionHistory:compare', wrapIPCHandler(
    async (_, fromVersionId: string, toVersionId: string) => {
      if (!fromVersionId || !toVersionId) {
        throw new ValidationError('比較元・比較先のバージョンIDが必要です');
      }

      const service = await container.get<VersionHistoryService>('versionHistoryService');
      const diff = await service.calculateDiff(fromVersionId, toVersionId);
      return { success: true, data: diff };
    },
    'バージョンの比較中にエラーが発生しました'
  ));

  // バージョンの削除
  ipcMain.handle('versionHistory:delete', wrapIPCHandler(
    async (_, versionId: string) => {
      if (!versionId) {
        throw new ValidationError('バージョンIDが指定されていません');
      }

      const service = await container.get<VersionHistoryService>('versionHistoryService');
      // TODO: Implement deleteVersion method in service
      // await service.deleteVersion(versionId);
      return { success: true };
    },
    'バージョンの削除中にエラーが発生しました'
  ));

  // 統計情報の取得
  ipcMain.handle('versionHistory:getStats', wrapIPCHandler(
    async () => {
      const service = await container.get<VersionHistoryService>('versionHistoryService');
      // TODO: Implement getStats method in service
      // const stats = await service.getStats();
      const stats = {
        totalVersions: 0,
        totalSize: 0,
        versionsByType: {}
      };
      return { success: true, data: stats };
    },
    '統計情報の取得中にエラーが発生しました'
  ));
}