/**
 * プロット管理関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { PlotApplicationService } from '../application/services/plot-service';

export function setupPlotHandlers(container: DIContainer): void {
  // プロットの作成
  ipcMain.handle('plot:create', async (_, data) => {
    const service = await container.get<PlotApplicationService>('plotService');
    const plot = await service.createPlot(data);
    return {
      id: plot.id,
      projectId: plot.projectId,
      version: plot.version,
      parentVersion: plot.parentVersion,
      title: plot.title,
      synopsis: plot.synopsis,
      structure: plot.structure,
      status: plot.status,
      createdAt: plot.createdAt,
      updatedAt: plot.updatedAt,
      createdBy: plot.createdBy
    };
  });

  // プロットのフォーク
  ipcMain.handle('plot:fork', async (_, plotId: string, modifications) => {
    const service = await container.get<PlotApplicationService>('plotService');
    const plot = await service.forkPlot(plotId, modifications);
    return {
      id: plot.id,
      projectId: plot.projectId,
      version: plot.version,
      parentVersion: plot.parentVersion,
      title: plot.title,
      synopsis: plot.synopsis,
      structure: plot.structure,
      status: plot.status,
      createdAt: plot.createdAt,
      updatedAt: plot.updatedAt,
      createdBy: plot.createdBy
    };
  });

  // プロットの分析
  ipcMain.handle('plot:analyze', async (_, plotId: string) => {
    const service = await container.get<PlotApplicationService>('plotService');
    return service.analyzePlot(plotId);
  });

  // プロットのバージョンツリー取得
  ipcMain.handle('plot:getVersionTree', async (_, projectId: string) => {
    const service = await container.get<PlotApplicationService>('plotService');
    return service.getPlotVersionTree(projectId);
  });

  // プロット生成関連のハンドラー（既存のipc-handlers.tsから抽出）
  ipcMain.handle('plotGen:generateFromTheme', async (_, request) => {
    // モックレスポンス - 実際のサービス実装時に置き換え
    const mockPlot = {
      id: Math.random().toString(36).substring(7),
      projectId: request.projectId,
      title: `${request.theme}をテーマにした物語`,
      synopsis: `${request.genre}ジャンルの${request.theme}をテーマにした物語です。`,
      structure: {
        acts: [
          {
            id: 'act1',
            title: '第一幕：導入',
            description: '物語の始まり',
            chapters: []
          }
        ],
        themes: [request.theme],
        emotionalCurve: []
      },
      version: '1.0.0',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return { success: true, data: mockPlot };
  });

  ipcMain.handle('plotGen:discussPlot', async (_, plotId, agentConfigs) => {
    // モック実装
    return {
      success: true,
      data: {
        id: Math.random().toString(36).substring(7),
        plotId,
        messages: [],
        conclusion: '議論の結論',
        summary: '議論の要約'
      }
    };
  });

  ipcMain.handle('plotGen:refinePlot', async (_, plotId, discussionId) => {
    // モック実装
    return {
      success: true,
      data: {
        id: plotId,
        refined: true,
        changes: ['プロットが改善されました']
      }
    };
  });

  ipcMain.handle('plotGen:approvePlot', async (_, plotId) => {
    // モック実装
    return { success: true };
  });

  ipcMain.handle('plotGen:rejectPlot', async (_, plotId, reason) => {
    // モック実装
    return { success: true };
  });

  // プロット分岐管理
  ipcMain.handle('plotBranching:getTree', async (_, projectId) => {
    // モック実装
    return {
      success: true,
      data: {
        nodes: [],
        edges: []
      }
    };
  });

  ipcMain.handle('plotBranching:createBranch', async (_, plotId, branchName) => {
    // モック実装
    return {
      success: true,
      data: {
        id: Math.random().toString(36).substring(7),
        parentId: plotId,
        name: branchName,
        createdAt: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('plotBranching:mergeBranches', async (_, sourceId, targetId, strategy) => {
    // モック実装
    return {
      success: true,
      data: {
        id: targetId,
        merged: true,
        conflicts: []
      }
    };
  });

  // プロット関連のモック実装
  ipcMain.handle('plots:getAll', async () => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });

  ipcMain.handle('plots:get', async (_, plotId) => {
    // モック実装
    return {
      success: true,
      data: {
        id: plotId,
        title: 'モックプロット',
        synopsis: 'プロットの概要',
        createdAt: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('plots:update', async (_, plotId, updates) => {
    // モック実装
    return {
      success: true,
      data: {
        id: plotId,
        ...updates,
        updatedAt: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('plots:delete', async (_, plotId) => {
    // モック実装
    return { success: true };
  });

  ipcMain.handle('plots:getByProject', async (_, projectId) => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });
}