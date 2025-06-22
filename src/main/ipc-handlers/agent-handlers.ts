/**
 * エージェント管理関連のIPCハンドラー
 */

import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { DIContainer } from '../core/di-container';
import { AgentManager } from '../services/agents/agent-manager';
import { AgentSession, AgentMessage, AgentParticipant, FullAgentSession } from './types';

export function setupAgentHandlers(container: DIContainer): void {
  // ディスカッションの開始
  ipcMain.handle('agent:startDiscussion', async (_, topic: string, participants: string[], context) => {
    const manager = await container.get<AgentManager>('agentManager');
    const messages = await manager.startDiscussion(topic, context, participants as any);
    return {
      id: uuidv4(),
      topic,
      participants,
      status: 'active',
      messageCount: messages.length,
      startTime: new Date().toISOString(),
      messages: messages.map(m => ({
        id: uuidv4(),
        agentId: m.agentId,
        agentRole: m.agentRole,
        content: m.content,
        timestamp: new Date().toISOString()
      }))
    };
  });

  // ディスカッションの継続
  ipcMain.handle('agent:continueDiscussion', async (_, discussionId: string) => {
    const manager = await container.get<AgentManager>('agentManager');
    const messages = await manager.continueDiscussion(discussionId);
    return messages;
  });

  // ディスカッションの終了
  ipcMain.handle('agent:endDiscussion', async (_, discussionId: string, summary?) => {
    const manager = await container.get<AgentManager>('agentManager');
    await manager.endDiscussion(discussionId);
    return { success: true };
  });

  // エージェント関連のモックハンドラー
  ipcMain.handle('agents:getStatus', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: {
        agents: [],
        activeAgent: null,
        totalMessages: 0
      }
    };
  });

  ipcMain.handle('agents:sendMessage', async (_, discussionId, content) => {
    // モック実装
    return {
      success: true,
      data: {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('agents:getSession', async (_, sessionId): Promise<FullAgentSession> => {
    // モック実装
    return {
      id: sessionId,
      topic: 'モックディスカッション',
      status: 'completed',
      messageCount: 3,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      messages: [
        {
          id: uuidv4(),
          agentId: 'writer',
          agentRole: 'Writer AI',
          content: 'このプロットには独創性があります。',
          timestamp: new Date().toISOString()
        },
        {
          id: uuidv4(),
          agentId: 'editor',
          agentRole: 'Editor AI',
          content: '構成をもう少し整理する必要があります。',
          timestamp: new Date().toISOString()
        }
      ],
      participants: [
        { role: 'Writer AI', name: 'ライター' },
        { role: 'Editor AI', name: 'エディター' }
      ]
    };
  });

  ipcMain.handle('agents:listSessions', async (): Promise<AgentSession[]> => {
    // モック実装
    return [
      {
        id: uuidv4(),
        topic: 'プロット改善の議論',
        status: 'completed',
        messageCount: 5,
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: uuidv4(),
        topic: 'キャラクター設定の検討',
        status: 'active',
        messageCount: 3,
        startTime: new Date(Date.now() - 600000).toISOString()
      }
    ];
  });

  ipcMain.handle('agents:getSessionMessages', async (_, sessionId): Promise<AgentMessage[]> => {
    // モック実装
    return [
      {
        id: uuidv4(),
        agentId: 'writer',
        agentRole: 'Writer AI',
        content: 'このプロットの核心は人間の成長です。',
        timestamp: new Date(Date.now() - 300000).toISOString()
      },
      {
        id: uuidv4(),
        agentId: 'editor',
        agentRole: 'Editor AI',
        content: 'その視点は素晴らしいですが、より具体的な描写が必要です。',
        timestamp: new Date(Date.now() - 240000).toISOString()
      }
    ];
  });

  ipcMain.handle('agents:getSessionParticipants', async (_, sessionId): Promise<AgentParticipant[]> => {
    // モック実装
    return [
      { role: 'Writer AI', name: 'クリエイティブライター' },
      { role: 'Editor AI', name: '構成エディター' },
      { role: 'Proofreader AI', name: '校正担当' }
    ];
  });

  ipcMain.handle('agents:updateStatus', async (_, sessionId, status) => {
    // モック実装
    return { success: true };
  });

  ipcMain.handle('agents:getProgress', async (_, sessionId) => {
    // モック実装
    return {
      success: true,
      data: {
        currentRound: 2,
        maxRounds: 5,
        completedRounds: 1,
        participantProgress: {
          'writer': 40,
          'editor': 35,
          'proofreader': 25
        },
        overallProgress: 33
      }
    };
  });

  // ディスカッション管理
  ipcMain.handle('discussion:create', async (_, params) => {
    // モック実装
    return {
      success: true,
      data: {
        id: uuidv4(),
        topic: params.topic,
        participants: params.agentConfigs.map((cfg: any) => cfg.role),
        messages: [],
        status: 'active',
        startTime: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('discussion:get', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: {
        id: discussionId,
        topic: 'モックディスカッション',
        messages: [],
        status: 'completed'
      }
    };
  });

  ipcMain.handle('discussion:list', async () => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });

  ipcMain.handle('discussion:addMessage', async (_, discussionId, message) => {
    // モック実装
    return {
      success: true,
      data: {
        id: uuidv4(),
        ...message,
        timestamp: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('discussion:end', async (_, discussionId) => {
    // モック実装
    return { success: true };
  });

  ipcMain.handle('discussion:sendHumanMessage', async (_, discussionId, message) => {
    // モック実装
    return {
      success: true,
      data: {
        id: uuidv4(),
        agentId: 'human',
        agentRole: 'Human',
        content: message,
        timestamp: new Date().toISOString()
      }
    };
  });

  ipcMain.handle('discussion:getHistory', async (_, options) => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });

  ipcMain.handle('discussion:getStats', async () => {
    // モック実装
    return {
      success: true,
      data: {
        totalDiscussions: 10,
        activeDiscussions: 2,
        completedDiscussions: 8,
        averageDuration: 1800000,
        averageMessages: 15
      }
    };
  });

  ipcMain.handle('discussion:export', async (_, discussionId, format) => {
    // モック実装
    return {
      success: true,
      data: {
        content: 'エクスポートされたディスカッション内容',
        format,
        filename: `discussion_${discussionId}.${format}`
      }
    };
  });

  ipcMain.handle('discussion:analyze', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: {
        keyPoints: ['ポイント1', 'ポイント2'],
        consensus: 'コンセンサス内容',
        conflicts: [],
        recommendations: ['推奨事項1']
      }
    };
  });

  ipcMain.handle('discussion:summarize', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: {
        summary: 'ディスカッションの要約',
        mainPoints: ['主要ポイント1', '主要ポイント2'],
        decisions: ['決定事項1'],
        actionItems: []
      }
    };
  });

  ipcMain.handle('discussion:getParticipants', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: [
        { role: 'Writer AI', messageCount: 5 },
        { role: 'Editor AI', messageCount: 4 }
      ]
    };
  });

  ipcMain.handle('discussion:search', async (_, query, options) => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });

  ipcMain.handle('discussion:getRelated', async (_, discussionId) => {
    // モック実装
    return {
      success: true,
      data: []
    };
  });
}