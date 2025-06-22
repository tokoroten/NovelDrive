/**
 * IPCハンドラー設定
 * DIコンテナを使用してサービスを取得し、IPCハンドラーを設定
 */

import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { DIContainer } from './core/di-container';
import { KnowledgeApplicationService } from './application/services/knowledge-service';
import { PlotApplicationService } from './application/services/plot-service';
import { KnowledgeGraphService } from './services/knowledge-graph-service';
import { SerendipitySearchService } from './services/serendipity-search-service';
import { AgentManager } from './services/agents';
import { InMemoryTaskQueue } from './core/async/task-queue';
import { retry } from './core/async/retry';

export async function setupIPCHandlers(container: DIContainer): Promise<void> {
  // 知識管理関連
  ipcMain.handle('knowledge:create', async (_, data) => {
    const service = await container.get<KnowledgeApplicationService>('knowledgeService');
    return retry(async () => {
      const knowledge = await service.createKnowledge(data);
      return {
        id: knowledge.id,
        title: knowledge.title,
        content: knowledge.content,
        type: knowledge.type,
        projectId: knowledge.projectId,
        metadata: knowledge.metadata,
        createdAt: knowledge.createdAt,
        updatedAt: knowledge.updatedAt
      };
    });
  });

  ipcMain.handle('knowledge:update', async (_, id: string, updates) => {
    const service = await container.get<KnowledgeApplicationService>('knowledgeService');
    return retry(async () => {
      const knowledge = await service.updateKnowledge(id, updates);
      return {
        id: knowledge.id,
        title: knowledge.title,
        content: knowledge.content,
        type: knowledge.type,
        projectId: knowledge.projectId,
        metadata: knowledge.metadata,
        createdAt: knowledge.createdAt,
        updatedAt: knowledge.updatedAt
      };
    });
  });

  ipcMain.handle('knowledge:search', async (_, query: string, options) => {
    const service = await container.get<KnowledgeApplicationService>('knowledgeService');
    const results = await service.searchKnowledge(query, options);
    return results.map(k => ({
      id: k.id,
      title: k.title,
      content: k.content,
      type: k.type,
      projectId: k.projectId,
      metadata: k.metadata,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt
    }));
  });

  ipcMain.handle('knowledge:delete', async (_, id: string) => {
    const service = await container.get<KnowledgeApplicationService>('knowledgeService');
    await service.deleteKnowledge(id);
  });

  // 知識グラフ関連
  ipcMain.handle('knowledge-graph:get', async (_, projectId?: string) => {
    const service = await container.get<KnowledgeGraphService>('knowledgeGraphService');
    return service.getKnowledgeGraph(projectId);
  });

  ipcMain.handle('knowledge-graph:getRelated', async (_, knowledgeId: string, depth: number) => {
    const service = await container.get<KnowledgeGraphService>('knowledgeGraphService');
    return service.getRelatedKnowledge(knowledgeId, depth);
  });

  // セレンディピティ検索
  ipcMain.handle('serendipity:search', async (_, query: string, options) => {
    const service = await container.get<SerendipitySearchService>('serendipitySearchService');
    return service.search(query, options);
  });

  // プロット管理関連
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

  ipcMain.handle('plot:analyze', async (_, plotId: string) => {
    const service = await container.get<PlotApplicationService>('plotService');
    return service.analyzePlot(plotId);
  });

  ipcMain.handle('plot:getVersionTree', async (_, projectId: string) => {
    const service = await container.get<PlotApplicationService>('plotService');
    return service.getPlotVersionTree(projectId);
  });

  // エージェント議論関連
  ipcMain.handle('agent:startDiscussion', async (_, topic: string, participants: string[], context) => {
    const manager = await container.get<AgentManager>('agentManager');
    const messages = await manager.startDiscussion(topic, context, participants as any);
    return {
      id: uuidv4(),
      topic,
      participants,
      status: 'active',
      messages,
      metadata: {},
      startedAt: new Date()
    };
  });

  ipcMain.handle('agent:continueDiscussion', async (_, discussionId: string) => {
    const manager = await container.get<AgentManager>('agentManager');
    // AgentManager doesn't support continuing discussions yet
    // This would need to be implemented to track discussion state
    throw new Error('Continue discussion not implemented');
  });

  ipcMain.handle('agent:endDiscussion', async (_, discussionId: string, summary?) => {
    const manager = await container.get<AgentManager>('agentManager');
    // Clear discussion history for now
    manager.clearDiscussionHistory();
    return { success: true };
  });

  // タスクキュー関連
  ipcMain.handle('task:enqueue', async (_, type: string, payload, options) => {
    const queue = await container.get<InMemoryTaskQueue>('taskQueue');
    return queue.enqueue(type, payload, options);
  });

  ipcMain.handle('task:getResult', async (_, taskId: string, timeout?: number) => {
    const queue = await container.get<InMemoryTaskQueue>('taskQueue');
    const result = await queue.getResult(taskId, timeout);
    return result ? {
      taskId: result.taskId,
      result: result.result,
      error: result.error?.message,
      completedAt: result.completedAt,
      duration: result.duration
    } : null;
  });

  ipcMain.handle('task:getStats', async (_) => {
    const queue = await container.get<InMemoryTaskQueue>('taskQueue');
    return queue.getStats();
  });

  // システム関連
  ipcMain.handle('system:getStats', async (_) => {
    const queue = await container.get<InMemoryTaskQueue>('taskQueue');
    const queueStats = await queue.getStats();
    
    return {
      queue: queueStats,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  });

  ipcMain.handle('system:gc', async (_) => {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  });
}