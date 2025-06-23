/**
 * バックアップ関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { BackupService } from '../services/backup-service';
import { wrapIPCHandler, ValidationError } from '../utils/error-handler';

export function setupBackupHandlers(container: DIContainer): void {
  // バックアップの作成
  ipcMain.handle('backup:create', wrapIPCHandler(
    async (_, description?: string) => {
      const service = await container.get<BackupService>('backupService');
      const backup = await service.createBackup({ 
        name: `手動バックアップ_${new Date().toISOString().split('T')[0]}`,
        description 
      });
      return { success: true, data: backup };
    },
    'バックアップの作成中にエラーが発生しました'
  ));

  // バックアップからの復元
  ipcMain.handle('backup:restore', wrapIPCHandler(
    async (_, backupId: string) => {
      if (!backupId) {
        throw new ValidationError('バックアップIDが指定されていません');
      }

      const service = await container.get<BackupService>('backupService');
      await service.restoreFromBackup(backupId, {
        overwriteExisting: true,
        createNewProject: false,
        restoreSettings: true
      });
      return { success: true };
    },
    'バックアップの復元中にエラーが発生しました'
  ));

  // バックアップリストの取得
  ipcMain.handle('backup:list', wrapIPCHandler(
    async () => {
      const service = await container.get<BackupService>('backupService');
      const backups = await service.listBackups();
      return { success: true, data: backups };
    },
    'バックアップリストの取得中にエラーが発生しました'
  ));

  // バックアップの削除
  ipcMain.handle('backup:delete', wrapIPCHandler(
    async (_, backupId: string) => {
      if (!backupId) {
        throw new ValidationError('バックアップIDが指定されていません');
      }

      const service = await container.get<BackupService>('backupService');
      await service.deleteBackup(backupId);
      return { success: true };
    },
    'バックアップの削除中にエラーが発生しました'
  ));

  // 自動バックアップの設定
  ipcMain.handle('backup:setAutoBackup', wrapIPCHandler(
    async (_, enabled: boolean, intervalHours: number) => {
      if (typeof enabled !== 'boolean') {
        throw new ValidationError('有効/無効の設定が不正です');
      }
      if (intervalHours && (intervalHours < 1 || intervalHours > 168)) {
        throw new ValidationError('間隔は1〜168時間の範囲で指定してください');
      }

      // TODO: Implement auto backup configuration
      // scheduleAutoBackup is private and needs public API
      return { success: true };
    },
    '自動バックアップの設定中にエラーが発生しました'
  ));

  // バックアップ設定の取得
  ipcMain.handle('backup:getSettings', wrapIPCHandler(
    async () => {
      // モック実装
      return {
        success: true,
        data: {
          autoBackupEnabled: true,
          intervalHours: 24,
          maxBackups: 10,
          lastBackupTime: new Date().toISOString()
        }
      };
    },
    'バックアップ設定の取得中にエラーが発生しました'
  ));
}