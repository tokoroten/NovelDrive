/**
 * 知識管理関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { DIContainer } from '../core/di-container';
import { KnowledgeApplicationService } from '../application/services/knowledge-service';
import { KnowledgeGraphService } from '../services/knowledge-graph-service';
import { SerendipitySearchService } from '../services/serendipity-search-service';
import { retry } from '../core/async/retry';

export function setupKnowledgeHandlers(container: DIContainer): void {
  // 知識の作成
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

  // 知識の更新
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

  // 知識の検索
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

  // 知識の削除
  ipcMain.handle('knowledge:delete', async (_, id: string) => {
    const service = await container.get<KnowledgeApplicationService>('knowledgeService');
    await service.deleteKnowledge(id);
  });

  // 知識グラフの取得
  ipcMain.handle('knowledge-graph:get', async (_, projectId?: string) => {
    const service = await container.get<KnowledgeGraphService>('knowledgeGraphService');
    return service.getKnowledgeGraph(projectId);
  });

  // 関連知識の取得
  ipcMain.handle('knowledge-graph:getRelated', async (_, knowledgeId: string, depth: number) => {
    const service = await container.get<KnowledgeGraphService>('knowledgeGraphService');
    return service.getRelatedKnowledge(knowledgeId, depth);
  });

  // セレンディピティ検索
  ipcMain.handle('serendipity:search', async (_, query: string, options) => {
    const service = await container.get<SerendipitySearchService>('serendipitySearchService');
    return service.search(query, options);
  });
}