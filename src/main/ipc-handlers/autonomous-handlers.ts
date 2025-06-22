/**
 * 自律モード関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { AutonomousModeService } from '../services/autonomous-mode-service';
import { AutonomousConfig } from '../../shared/types';

export function setupAutonomousHandlers(container: DIContainer): void {
  // 自律モードの開始
  ipcMain.handle('autonomous:start', async () => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      await service.start();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '自律モードの開始に失敗しました' 
      };
    }
  });

  // 自律モードの停止
  ipcMain.handle('autonomous:stop', async () => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      await service.stop();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '自律モードの停止に失敗しました' 
      };
    }
  });

  // 自律モードのステータス取得
  ipcMain.handle('autonomous:getStatus', async () => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      const status = await service.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'ステータスの取得に失敗しました' 
      };
    }
  });

  // 自律モードの設定更新
  ipcMain.handle('autonomous:updateConfig', async (_, config: AutonomousConfig) => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      await service.updateConfig(config);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '設定の更新に失敗しました' 
      };
    }
  });

  // 承認待ちコンテンツの取得
  ipcMain.handle('autonomous:getApprovalQueue', async () => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      const queue = await service.getApprovalQueue();
      return { success: true, data: queue };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '承認キューの取得に失敗しました' 
      };
    }
  });

  // コンテンツの承認
  ipcMain.handle('autonomous:approveContent', async (_, contentId: string) => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      await service.approveContent(contentId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'コンテンツの承認に失敗しました' 
      };
    }
  });

  // コンテンツの却下
  ipcMain.handle('autonomous:rejectContent', async (_, contentId: string, reason: string) => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      await service.rejectContent(contentId, reason);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'コンテンツの却下に失敗しました' 
      };
    }
  });

  // アクティビティログの取得
  ipcMain.handle('autonomous:getActivityLog', async (_, limit = 100) => {
    try {
      const service = await container.get<AutonomousModeService>('autonomousModeService');
      const logs = await service.getActivityLog(limit);
      return { success: true, data: logs };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'アクティビティログの取得に失敗しました' 
      };
    }
  });
}