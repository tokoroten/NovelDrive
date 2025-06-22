/**
 * バックアップ関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { BackupService } from '../services/backup-service';

export function setupBackupHandlers(container: DIContainer): void {
  // バックアップの作成
  ipcMain.handle('backup:create', async (_, description?: string) => {
    try {
      const service = await container.get<BackupService>('backupService');
      const backup = await service.createBackup(description);
      return { success: true, data: backup };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バックアップの作成に失敗しました' 
      };
    }
  });

  // バックアップからの復元
  ipcMain.handle('backup:restore', async (_, backupId: string) => {
    try {
      const service = await container.get<BackupService>('backupService');
      await service.restoreFromBackup(backupId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バックアップの復元に失敗しました' 
      };
    }
  });

  // バックアップリストの取得
  ipcMain.handle('backup:list', async () => {
    try {
      const service = await container.get<BackupService>('backupService');
      const backups = await service.listBackups();
      return { success: true, data: backups };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バックアップリストの取得に失敗しました' 
      };
    }
  });

  // バックアップの削除
  ipcMain.handle('backup:delete', async (_, backupId: string) => {
    try {
      const service = await container.get<BackupService>('backupService');
      await service.deleteBackup(backupId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'バックアップの削除に失敗しました' 
      };
    }
  });

  // 自動バックアップの設定
  ipcMain.handle('backup:setAutoBackup', async (_, enabled: boolean, intervalHours: number) => {
    try {
      const service = await container.get<BackupService>('backupService');
      if (enabled) {
        await service.scheduleAutoBackup(intervalHours);
      } else {
        await service.stopAutoBackup();
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '自動バックアップの設定に失敗しました' 
      };
    }
  });

  // バックアップ設定の取得
  ipcMain.handle('backup:getSettings', async () => {
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
  });
}