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
import { AgentManager } from './services/agents/agent-manager';
import { InMemoryTaskQueue } from './core/async/task-queue';
import { retry } from './core/async/retry';

// IPC API Response Types
interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

interface AgentSession {
  id: string;
  topic: string;
  status: string;
  messageCount: number;
  startTime: string;
  endTime?: string;
}

interface AgentMessage {
  id: string;
  agentId: string;
  agentRole: string;
  content: string;
  timestamp: string;
}

interface AgentParticipant {
  role: string;
  name?: string;
}

interface FullAgentSession extends AgentSession {
  messages: AgentMessage[];
  participants: AgentParticipant[];
}

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

  // データベース直接クエリ
  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    try {
      // 基本的なSQLクエリを実行（読み取り専用）
      if (!sql.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed through this API');
      }
      
      // TODO: 実際のデータベース接続を使用
      return [];
    } catch (error) {
      console.error('Database query error:', error);
      return [];
    }
  });

  ipcMain.handle('db:execute', async (_, sql: string, params: unknown[] = []) => {
    try {
      // 更新系のSQLクエリを実行
      // TODO: 実際のデータベース接続を使用
      return { success: true };
    } catch (error) {
      console.error('Database execute error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
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

  // Anything Box関連
  ipcMain.handle('anythingBox:process', async (_, input) => {
    try {
      const { processAnythingBoxInput } = await import('./services/anything-box');
      const processed = await processAnythingBoxInput(input);
      
      return {
        success: true,
        processed: {
          originalId: processed.original.id,
          inspirationCount: processed.inspirations.length,
          knowledgeCount: processed.knowledge.length,
        }
      };
    } catch (error) {
      console.error('AnythingBox processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('anythingBox:history', async (_, options) => {
    try {
      // TODO: Implement history retrieval
      return {
        success: true,
        items: []
      };
    } catch (error) {
      console.error('AnythingBox history error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Agent関連のIPCハンドラー
  ipcMain.handle('agents:getAllSessions', async (): Promise<{
    success: boolean;
    sessions: AgentSession[];
    error?: string;
  }> => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      // AgentManagerにgetAllSessionsメソッドがない場合、サンプルセッションを返す
      const sessions: AgentSession[] = [
        {
          id: 'sample-session-1',
          topic: 'サンプル議論: 魔法と科学の融合',
          status: 'completed',
          messageCount: 5,
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: 'sample-session-2',
          topic: 'キャラクター設定の検討',
          status: 'active',
          messageCount: 3,
          startTime: new Date(Date.now() - 300000).toISOString()
        }
      ]; // TODO: 実際のセッション取得ロジック
      
      return {
        success: true,
        sessions
      };
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sessions: []
      };
    }
  });

  ipcMain.handle('agents:getSession', async (_, sessionId: string): Promise<{
    success: boolean;
    session: FullAgentSession | null;
    error?: string;
  }> => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      // AgentManagerにgetSessionメソッドがない場合、nullを返す
      const session: FullAgentSession | null = null; // TODO: 実際のセッション取得ロジック
      return {
        success: true,
        session
      };
    } catch (error) {
      console.error('Failed to get session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        session: null
      };
    }
  });

  ipcMain.handle('agents:create', async (_, options) => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      // AgentManagerにcreateメソッドがない場合、暫定的な応答を返す
      return {
        success: true,
        agent: {
          id: uuidv4(),
          role: options.role,
          personality: options.personality,
          name: options.name || 'Agent'
        }
      };
    } catch (error) {
      console.error('Failed to create agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('agents:startDiscussion', async (_, options) => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      const context = {
        maxRounds: options.maxRounds || 3,
        projectContext: options.projectId ? { projectId: options.projectId } : undefined,
        plotContext: options.plotId ? { plotId: options.plotId } : undefined
      };
      const messages = await agentManager.startDiscussion(options.topic, context, options.agentConfigs);
      
      return {
        success: true,
        session: {
          id: uuidv4(),
          topic: options.topic,
          status: 'active',
          messages,
          participants: options.agentConfigs,
          startTime: new Date()
        }
      };
    } catch (error) {
      console.error('Failed to start discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('agents:pauseSession', async (_, sessionId: string) => {
    try {
      // Pause session logic - for now just return success
      return { success: true };
    } catch (error) {
      console.error('Failed to pause session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('agents:resumeSession', async (_, sessionId: string) => {
    try {
      // Resume session logic - for now just return success
      return { success: true };
    } catch (error) {
      console.error('Failed to resume session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('agents:getDiscussionHistory', async (_, options) => {
    try {
      // Return empty history for now
      return {
        success: true,
        discussions: []
      };
    } catch (error) {
      console.error('Failed to get discussion history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('agents:requestWritingSuggestions', async (_, context) => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      // Return empty suggestions for now
      return {
        success: true,
        suggestions: []
      };
    } catch (error) {
      console.error('Failed to request writing suggestions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Discussion Manager API handlers
  ipcMain.handle('discussion:start', async (_, topic: string, context?, options?) => {
    try {
      const agentManager = await container.get<AgentManager>('agentManager');
      const discussionContext = {
        maxRounds: options?.maxRounds || 3,
        projectContext: context?.projectId ? { projectId: context.projectId } : undefined,
        plotContext: context?.plotId ? { plotId: context.plotId } : undefined
      };
      const messages = await agentManager.startDiscussion(topic, discussionContext, options?.agentConfigs || []);
      
      return {
        success: true,
        discussionId: uuidv4(),
        messages
      };
    } catch (error) {
      console.error('Failed to start discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:pause', async () => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to pause discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:resume', async () => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to resume discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:addHumanIntervention', async (_, content: string) => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to add human intervention:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getStatus', async () => {
    try {
      return {
        success: true,
        status: 'idle'
      };
    } catch (error) {
      console.error('Failed to get discussion status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getMessages', async (_, discussionId: string, limit?: number) => {
    try {
      return {
        success: true,
        messages: []
      };
    } catch (error) {
      console.error('Failed to get messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getAgents', async () => {
    try {
      return {
        success: true,
        agents: []
      };
    } catch (error) {
      console.error('Failed to get agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getHistory', async (_, limit?: number) => {
    try {
      return {
        success: true,
        history: []
      };
    } catch (error) {
      console.error('Failed to get history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:setAutonomousMode', async (_, enabled: boolean, options?) => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to set autonomous mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getTokenUsage', async (_, discussionId: string) => {
    try {
      return {
        success: true,
        usage: {
          total: 0,
          input: 0,
          output: 0
        }
      };
    } catch (error) {
      console.error('Failed to get token usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getSummarizationConfig', async () => {
    try {
      return {
        success: true,
        config: {
          enabled: false,
          threshold: 100
        }
      };
    } catch (error) {
      console.error('Failed to get summarization config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:updateSummarizationConfig', async (_, config) => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to update summarization config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:getSummaries', async (_, discussionId: string) => {
    try {
      return {
        success: true,
        summaries: []
      };
    } catch (error) {
      console.error('Failed to get summaries:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('discussion:submitHumanIntervention', async (_, discussionId: string, intervention) => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Failed to submit human intervention:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // プロット管理API
  ipcMain.handle('plots:create', async (_, data) => {
    try {
      const plotService = await container.get<PlotApplicationService>('plotService');
      const plot = await plotService.createPlot(data);
      return {
        success: true,
        plot: {
          id: plot.id,
          projectId: plot.projectId,
          version: plot.version,
          title: plot.title,
          synopsis: plot.synopsis,
          structure: plot.structure,
          status: plot.status,
          createdAt: plot.createdAt,
          updatedAt: plot.updatedAt,
          createdBy: plot.createdBy
        }
      };
    } catch (error) {
      console.error('Failed to create plot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plots:fork', async (_, plotId: string, modifications) => {
    try {
      const plotService = await container.get<PlotApplicationService>('plotService');
      const plot = await plotService.forkPlot(plotId, modifications);
      return {
        success: true,
        plot: {
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
        }
      };
    } catch (error) {
      console.error('Failed to fork plot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plots:get', async (_, plotId: string) => {
    try {
      // TODO: 実装
      return {
        success: true,
        plot: null
      };
    } catch (error) {
      console.error('Failed to get plot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plots:history', async (_, projectId: string) => {
    try {
      const plotService = await container.get<PlotApplicationService>('plotService');
      const plots = await plotService.getPlotVersionTree(projectId);
      return {
        success: true,
        plots: plots.map((plot: any) => ({
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
        }))
      };
    } catch (error) {
      console.error('Failed to get plot history:', error);
      return {
        success: true,
        plots: []
      };
    }
  });

  ipcMain.handle('plots:updateStatus', async (_, plotId: string, status: string) => {
    try {
      // TODO: 実装
      return { success: true };
    } catch (error) {
      console.error('Failed to update plot status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // チャプター管理API
  ipcMain.handle('chapters:create', async (_, chapter) => {
    try {
      // TODO: 実装
      return {
        success: true,
        chapter: {
          id: uuidv4(),
          ...chapter,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Failed to create chapter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('chapters:update', async (_, id: string, updates) => {
    try {
      // TODO: 実装
      return { success: true };
    } catch (error) {
      console.error('Failed to update chapter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('chapters:delete', async (_, id: string) => {
    try {
      // TODO: 実装
      return { success: true };
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('chapters:get', async (_, id: string) => {
    try {
      // TODO: 実装
      return {
        success: true,
        chapter: null
      };
    } catch (error) {
      console.error('Failed to get chapter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('chapters:listByPlot', async (_, plotId: string) => {
    try {
      // TODO: 実装
      return {
        success: true,
        chapters: []
      };
    } catch (error) {
      console.error('Failed to list chapters:', error);
      return {
        success: true,
        chapters: []
      };
    }
  });

  // プロット生成ワークフロー
  ipcMain.handle('plotGen:start', async (_, request) => {
    try {
      // TODO: 実装
      return {
        success: true,
        sessionId: uuidv4()
      };
    } catch (error) {
      console.error('Failed to start plot generation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:getSession', async (_, sessionId: string) => {
    try {
      // TODO: 実装
      return {
        success: true,
        session: null
      };
    } catch (error) {
      console.error('Failed to get plot generation session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:getSessions', async () => {
    try {
      // TODO: 実装
      return {
        success: true,
        sessions: []
      };
    } catch (error) {
      console.error('Failed to get plot generation sessions:', error);
      return {
        success: true,
        sessions: []
      };
    }
  });

  ipcMain.handle('plotGen:cancel', async (_, sessionId: string) => {
    try {
      // TODO: 実装
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel plot generation session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:addIntervention', async (_, sessionId: string, content: string) => {
    try {
      // TODO: 実装
      return { success: true };
    } catch (error) {
      console.error('Failed to add plot generation intervention:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // 自律モードAPI
  ipcMain.handle('autonomous:getConfig', async () => {
    try {
      // Mockデータを返す（サービス統合時に実装予定）
      return {
        enabled: false,
        projectId: '',
        schedule: {
          writingInterval: 120,
          ideaGenerationInterval: 60,
          discussionInterval: 180,
        },
        quality: {
          minQualityScore: 65,
          autoSaveThreshold: 70,
          requireHumanApproval: true,
        },
        limits: {
          maxChaptersPerDay: 3,
          maxWordsPerSession: 5000,
          maxTokensPerDay: 100000,
        },
      };
    } catch (error) {
      console.error('Failed to get autonomous config:', error);
      return {
        enabled: false,
        projectId: '',
        schedule: {
          writingInterval: 120,
          ideaGenerationInterval: 60,
          discussionInterval: 180,
        },
        quality: {
          minQualityScore: 65,
          autoSaveThreshold: 70,
          requireHumanApproval: true,
        },
        limits: {
          maxChaptersPerDay: 3,
          maxWordsPerSession: 5000,
          maxTokensPerDay: 100000,
        },
      };
    }
  });

  ipcMain.handle('autonomous:updateConfig', async (_, config) => {
    try {
      // TODO: AutonomousModeServiceと統合
      console.log('Updating autonomous config:', config);
      return { success: true };
    } catch (error) {
      console.error('Failed to update autonomous config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('autonomous:getStatus', async () => {
    try {
      // TODO: AutonomousModeServiceと統合
      return {
        isRunning: false,
        config: {
          enabled: false,
          projectId: '',
          schedule: {
            writingInterval: 120,
            ideaGenerationInterval: 60,
            discussionInterval: 180,
          },
          quality: {
            minQualityScore: 65,
            autoSaveThreshold: 70,
            requireHumanApproval: true,
          },
          limits: {
            maxChaptersPerDay: 3,
            maxWordsPerSession: 5000,
            maxTokensPerDay: 100000,
          },
        },
        dailyTokenUsage: 0,
        tokenLimitRemaining: 100000,
      };
    } catch (error) {
      console.error('Failed to get autonomous status:', error);
      return {
        isRunning: false,
        config: {
          enabled: false,
          projectId: '',
          schedule: {
            writingInterval: 120,
            ideaGenerationInterval: 60,
            discussionInterval: 180,
          },
          quality: {
            minQualityScore: 65,
            autoSaveThreshold: 70,
            requireHumanApproval: true,
          },
          limits: {
            maxChaptersPerDay: 3,
            maxWordsPerSession: 5000,
            maxTokensPerDay: 100000,
          },
        },
        dailyTokenUsage: 0,
        tokenLimitRemaining: 100000,
      };
    }
  });

  ipcMain.handle('autonomous:start', async () => {
    try {
      // TODO: AutonomousModeServiceと統合
      console.log('Starting autonomous mode');
      return { success: true };
    } catch (error) {
      console.error('Failed to start autonomous mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('autonomous:stop', async () => {
    try {
      // TODO: AutonomousModeServiceと統合
      console.log('Stopping autonomous mode');
      return { success: true };
    } catch (error) {
      console.error('Failed to stop autonomous mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Crawler API
  ipcMain.handle('crawler:crawl', async (_, url: string, depth: number, options?) => {
    try {
      // TODO: 実装
      return {
        success: true,
        result: {
          url,
          status: 'completed',
          pagesProcessed: 1,
          knowledgeCreated: 0
        }
      };
    } catch (error) {
      console.error('Failed to crawl:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Tokenizer API
  ipcMain.handle('tokenizer:tokenize', async (_, text: string) => {
    try {
      // TODO: 実装 - TinySegmenterを使用
      return {
        tokens: text.split(''),
        count: text.length
      };
    } catch (error) {
      console.error('Failed to tokenize:', error);
      return {
        tokens: [],
        count: 0
      };
    }
  });

  // Knowledge API
  ipcMain.handle('knowledge:save', async (_, knowledge) => {
    try {
      const knowledgeService = await container.get<KnowledgeApplicationService>('knowledgeService');
      const savedKnowledge = await knowledgeService.createKnowledge(knowledge);
      return {
        success: true,
        knowledge: {
          id: savedKnowledge.id,
          title: savedKnowledge.title,
          content: savedKnowledge.content,
          type: savedKnowledge.type,
          projectId: savedKnowledge.projectId,
          metadata: savedKnowledge.metadata,
          createdAt: savedKnowledge.createdAt,
          updatedAt: savedKnowledge.updatedAt
        }
      };
    } catch (error) {
      console.error('Failed to save knowledge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // File API
  ipcMain.handle('file:read', async (_, path: string) => {
    try {
      // TODO: 実装（セキュリティ制限あり）
      return '';
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle('file:write', async (_, path: string, content: string) => {
    try {
      // TODO: 実装（セキュリティ制限あり）
      return { success: true };
    } catch (error) {
      console.error('Failed to write file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('file:exists', async (_, path: string) => {
    try {
      // TODO: 実装（セキュリティ制限あり）
      return false;
    } catch (error) {
      console.error('Failed to check file existence:', error);
      return false;
    }
  });

  // AI API（ローカル埋め込み用）
  ipcMain.handle('ai:embed', async (_, text: string) => {
    try {
      // TODO: LocalEmbeddingServiceを使用
      return {
        embedding: new Array(384).fill(0).map(() => Math.random()),
        dimensions: 384
      };
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  });

  ipcMain.handle('ai:chat', async (_, messages, options?) => {
    try {
      // TODO: OpenAI API実装
      return {
        response: 'チャット機能は現在開発中です。',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } catch (error) {
      console.error('Failed to process chat:', error);
      throw error;
    }
  });

  ipcMain.handle('ai:generateImage', async (_, prompt: string, options?) => {
    try {
      // TODO: DALL-E API実装
      return {
        imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="lightgray"/><text x="50" y="50" text-anchor="middle">画像生成中</text></svg>',
        usage: {
          cost: 0
        }
      };
    } catch (error) {
      console.error('Failed to generate image:', error);
      throw error;
    }
  });

  ipcMain.handle('ai:extractInspiration', async (_, text: string, type: string) => {
    try {
      // TODO: ローカルインスピレーション抽出実装
      return {
        keywords: ['サンプル', 'キーワード'],
        themes: ['テーマ1'],
        plotSeeds: ['サンプルプロット'],
        characters: [],
        scenes: []
      };
    } catch (error) {
      console.error('Failed to extract inspiration:', error);
      throw error;
    }
  });

  ipcMain.handle('ai:extractContent', async (_, html: string, url: string) => {
    try {
      // TODO: コンテンツ抽出実装
      return {
        title: '抽出されたタイトル',
        content: '抽出されたコンテンツ',
        summary: '要約'
      };
    } catch (error) {
      console.error('Failed to extract content:', error);
      throw error;
    }
  });

  // Search API
  ipcMain.handle('search:serendipity', async (_, query: string, options?) => {
    try {
      const searchService = await container.get<SerendipitySearchService>('serendipitySearchService');
      const results = await searchService.search(query, options);
      return results;
    } catch (error) {
      console.error('Failed to perform serendipity search:', error);
      return [];
    }
  });

  ipcMain.handle('search:hybrid', async (_, query: string, options?) => {
    try {
      // TODO: ハイブリッド検索実装
      return [];
    } catch (error) {
      console.error('Failed to perform hybrid search:', error);
      return [];
    }
  });

  ipcMain.handle('search:related', async (_, itemId: string, options?) => {
    try {
      // TODO: 関連検索実装
      return [];
    } catch (error) {
      console.error('Failed to perform related search:', error);
      return [];
    }
  });

  // Backup API
  ipcMain.handle('backup:create', async (_, options) => {
    try {
      // TODO: BackupServiceと統合
      const backupId = require('uuid').v4();
      console.log('Creating backup:', options);
      
      // Mockバックアップメタデータを返す
      return {
        id: backupId,
        name: options.name,
        description: options.description,
        projectIds: options.projectIds || [],
        size: Math.floor(Math.random() * 10000000) + 1000000, // 1-10MB
        createdAt: new Date().toISOString(),
        type: 'manual',
        version: '1.0.0',
        checksum: 'mock-checksum-' + backupId.substring(0, 8),
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  });

  ipcMain.handle('backup:listBackups', async () => {
    try {
      // TODO: BackupServiceと統合
      // Mockデータを返す
      return [
        {
          id: 'backup-1',
          name: 'サンプル自動バックアップ',
          description: '定期自動バックアップ',
          projectIds: ['project-1', 'project-2'],
          size: 2500000,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          type: 'auto',
          version: '1.0.0',
          checksum: 'mock-checksum-1',
        },
        {
          id: 'backup-2',
          name: '重要な節目のバックアップ',
          description: '第一章完成時のバックアップ',
          projectIds: ['project-1'],
          size: 1800000,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          type: 'manual',
          version: '1.0.0',
          checksum: 'mock-checksum-2',
        },
      ];
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  });

  ipcMain.handle('backup:restore', async (_, backupId: string, options) => {
    try {
      // TODO: BackupServiceと統合
      console.log('Restoring backup:', backupId, options);
      
      // 復元処理のシミュレーション
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { success: true };
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  });

  ipcMain.handle('backup:delete', async (_, backupId: string) => {
    try {
      // TODO: BackupServiceと統合
      console.log('Deleting backup:', backupId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  });

  ipcMain.handle('backup:getConfig', async () => {
    try {
      // TODO: BackupServiceと統合
      return {
        enabled: true,
        intervalHours: 24,
        maxBackups: 10,
        includeLogs: false,
        compressBackups: true,
        backupLocation: require('path').join(require('electron').app.getPath('userData'), 'backups'),
      };
    } catch (error) {
      console.error('Failed to get backup config:', error);
      return {
        enabled: false,
        intervalHours: 24,
        maxBackups: 10,
        includeLogs: false,
        compressBackups: true,
        backupLocation: '',
      };
    }
  });

  ipcMain.handle('backup:updateConfig', async (_, config) => {
    try {
      // TODO: BackupServiceと統合
      console.log('Updating backup config:', config);
      return { success: true };
    } catch (error) {
      console.error('Failed to update backup config:', error);
      throw error;
    }
  });

  // Version History API
  ipcMain.handle('versionHistory:getHistory', async (_, documentId: string, limit?: number) => {
    try {
      // TODO: VersionHistoryServiceと統合
      // Mockデータを返す
      return [
        {
          id: 'version-1',
          documentId,
          documentType: 'chapter',
          version: 3,
          title: '第一章：始まり',
          content: '最新版のテキスト内容...',
          metadata: {},
          changeType: 'update',
          changeDescription: '誤字修正と文章の調整',
          authorName: 'ユーザー',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          checksum: 'checksum-3',
          size: 2500,
        },
        {
          id: 'version-2',
          documentId,
          documentType: 'chapter',
          version: 2,
          title: '第一章：始まり',
          content: '前のバージョンのテキスト内容...',
          metadata: {},
          changeType: 'update',
          changeDescription: 'プロットに合わせて内容を調整',
          authorName: 'ユーザー',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          checksum: 'checksum-2',
          size: 2200,
        },
        {
          id: 'version-3',
          documentId,
          documentType: 'chapter',
          version: 1,
          title: '第一章：始まり',
          content: '最初のバージョンのテキスト内容...',
          metadata: {},
          changeType: 'create',
          changeDescription: '初回作成',
          authorName: 'ユーザー',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          checksum: 'checksum-1',
          size: 1800,
        },
      ];
    } catch (error) {
      console.error('Failed to get version history:', error);
      return [];
    }
  });

  ipcMain.handle('versionHistory:calculateDiff', async (_, fromVersionId: string, toVersionId: string) => {
    try {
      // TODO: VersionHistoryServiceと統合
      // Mock差分データを返す
      return {
        additions: [
          { lineNumber: 5, content: '新しく追加された行です。', type: 'added' },
          { lineNumber: 8, content: 'もう一つの追加行。', type: 'added' },
        ],
        deletions: [
          { lineNumber: 3, content: '削除された行です。', type: 'deleted' },
        ],
        modifications: [
          { 
            lineNumber: 7, 
            content: '修正後の内容です。', 
            oldContent: '修正前の内容です。',
            type: 'modified' 
          },
        ],
        summary: {
          linesAdded: 2,
          linesDeleted: 1,
          linesModified: 1,
          charactersAdded: 25,
          charactersDeleted: 10,
        },
      };
    } catch (error) {
      console.error('Failed to calculate diff:', error);
      throw error;
    }
  });

  ipcMain.handle('versionHistory:restore', async (_, versionId: string, options) => {
    try {
      // TODO: VersionHistoryServiceと統合
      console.log('Restoring version:', versionId, options);
      return { success: true };
    } catch (error) {
      console.error('Failed to restore version:', error);
      throw error;
    }
  });

  ipcMain.handle('versionHistory:delete', async (_, versionId: string) => {
    try {
      // TODO: VersionHistoryServiceと統合
      console.log('Deleting version:', versionId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete version:', error);
      throw error;
    }
  });

  // Plot Branching API
  ipcMain.handle('plotBranching:createBranch', async (_, branchData) => {
    try {
      const { projectId, title, synopsis, parentVersion, createdBy } = branchData;
      console.log('Creating plot branch:', branchData);
      
      // TODO: 実際のプロット分岐作成処理
      // Mockレスポンス
      const newBranch = {
        id: `plot-${Date.now()}`,
        version: `v${Date.now()}`,
        title,
        synopsis,
        parentVersion,
        projectId,
        status: 'draft',
        createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return {
        success: true,
        data: newBranch,
      };
    } catch (error) {
      console.error('Failed to create plot branch:', error);
      throw error;
    }
  });

  ipcMain.handle('plotBranching:mergeBranch', async (_, mergeData) => {
    try {
      const { sourceId, targetId, strategy, description } = mergeData;
      console.log('Merging plot branch:', mergeData);
      
      // TODO: 実際のプロット分岐マージ処理
      // Mockレスポンス
      return {
        success: true,
        data: {
          mergedVersionId: `merged-${Date.now()}`,
          status: 'merged',
          description,
        },
      };
    } catch (error) {
      console.error('Failed to merge plot branch:', error);
      throw error;
    }
  });

  ipcMain.handle('plotBranching:getTree', async (_, projectId: string) => {
    try {
      console.log('Getting plot tree for project:', projectId);
      
      // TODO: 実際のプロット系譜取得処理
      // 現在はdatabase.listPlotsを使用するため、実装不要
      return {
        success: true,
        message: 'Use database.listPlots instead',
      };
    } catch (error) {
      console.error('Failed to get plot tree:', error);
      throw error;
    }
  });

  // Export API (テキストのみ)
  ipcMain.handle('export:text', async (_, options) => {
    try {
      const { documentIds, format, includeMetadata } = options;
      console.log('Exporting as text:', documentIds, format);
      
      // TODO: 実際のエクスポート処理
      // Mockレスポンス
      return {
        success: true,
        filePath: '/mock/path/to/exported/file.txt',
        size: 15000,
      };
    } catch (error) {
      console.error('Failed to export as text:', error);
      throw error;
    }
  });
}