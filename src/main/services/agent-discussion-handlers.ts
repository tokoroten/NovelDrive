/**
 * エージェント議論システムのIPCハンドラー
 * DiscussionManagerの機能をレンダラープロセスに公開
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as duckdb from 'duckdb';
import OpenAI from 'openai';
import { DiscussionManager, Discussion, DiscussionOptions } from './agents/discussion-manager';
import { AgentMessage } from './agents/agent-base';
import { ApiUsageLogger, getApiUsageLogger } from './api-usage-logger';

let discussionManager: DiscussionManager | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * エージェント議論システムのIPCハンドラーを設定
 */
export function setupAgentDiscussionHandlers(
  conn: duckdb.Connection,
  openaiClient: OpenAI,
  window: BrowserWindow
): void {
  mainWindow = window;
  const apiLogger = getApiUsageLogger();
  
  // DiscussionManagerの初期化
  discussionManager = new DiscussionManager(openaiClient, conn, apiLogger);
  
  // イベントリスナーの設定
  setupEventForwarding();
  
  // 議論開始
  ipcMain.handle(
    'discussion:start',
    async (
      _,
      options: {
        topic: string;
        context?: {
          projectId?: string;
          plotId?: string;
          initialKnowledge?: string;
        };
        discussionOptions?: DiscussionOptions;
      }
    ) => {
      if (!discussionManager) {
        return {
          success: false,
          error: 'Discussion manager not initialized',
        };
      }

      try {
        const discussionId = await discussionManager.startDiscussion(
          options.topic,
          options.context,
          {
            maxRounds: 10,
            timeLimit: 30 * 60 * 1000, // 30分
            autoStop: true,
            saveToDatabase: true,
            humanInterventionEnabled: true,
            ...options.discussionOptions,
          }
        );

        return {
          success: true,
          discussionId,
        };
      } catch (error) {
        console.error('Failed to start discussion:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // 議論一時停止
  ipcMain.handle('discussion:pause', async () => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      discussionManager.pauseDiscussion();
      return { success: true };
    } catch (error) {
      console.error('Failed to pause discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 議論再開
  ipcMain.handle('discussion:resume', async () => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      await discussionManager.resumeDiscussion();
      return { success: true };
    } catch (error) {
      console.error('Failed to resume discussion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 人間の介入追加
  ipcMain.handle(
    'discussion:addHumanIntervention',
    async (_, content: string) => {
      if (!discussionManager) {
        return {
          success: false,
          error: 'Discussion manager not initialized',
        };
      }

      try {
        await discussionManager.addHumanIntervention(content);
        return { success: true };
      } catch (error) {
        console.error('Failed to add human intervention:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // 議論状態取得
  ipcMain.handle('discussion:getStatus', async (_, discussionId?: string) => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      let discussion: Discussion | undefined;
      
      if (discussionId) {
        discussion = discussionManager.getDiscussion(discussionId);
      } else {
        discussion = discussionManager.getActiveDiscussion();
      }

      if (!discussion) {
        return {
          success: false,
          error: 'Discussion not found',
        };
      }

      return {
        success: true,
        discussion: {
          id: discussion.id,
          projectId: discussion.projectId,
          plotId: discussion.plotId,
          topic: discussion.topic,
          status: discussion.status,
          startTime: discussion.startTime,
          endTime: discussion.endTime,
          participants: discussion.participants,
          messageCount: discussion.messages.length,
          decisions: discussion.decisions,
          qualityScore: discussion.qualityScore,
          metadata: discussion.metadata,
        },
      };
    } catch (error) {
      console.error('Failed to get discussion status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 議論メッセージ取得
  ipcMain.handle('discussion:getMessages', async (_, discussionId?: string) => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      let discussion: Discussion | undefined;
      
      if (discussionId) {
        discussion = discussionManager.getDiscussion(discussionId);
      } else {
        discussion = discussionManager.getActiveDiscussion();
      }

      if (!discussion) {
        return {
          success: false,
          error: 'Discussion not found',
        };
      }

      // エージェント情報を付加してメッセージを返す
      const messagesWithAgentInfo = discussion.messages.map(message => {
        const agent = discussionManager!.getAgent(message.agentId);
        return {
          ...message,
          agentName: agent?.getName() || message.agentId,
          agentRole: agent?.getRole() || 'unknown',
        };
      });

      return {
        success: true,
        messages: messagesWithAgentInfo,
      };
    } catch (error) {
      console.error('Failed to get discussion messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // エージェント一覧取得
  ipcMain.handle('discussion:getAgents', async () => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      const agents = discussionManager.getAgents();
      return {
        success: true,
        agents: agents.map(agent => ({
          id: agent.getId(),
          name: agent.getName(),
          role: agent.getRole(),
          personality: agent.getPersonality?.() || 'default',
        })),
      };
    } catch (error) {
      console.error('Failed to get agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 議論履歴取得（データベースから）
  ipcMain.handle(
    'discussion:getHistory',
    async (
      _,
      options?: {
        projectId?: string;
        plotId?: string;
        limit?: number;
        status?: 'active' | 'paused' | 'completed' | 'aborted';
      }
    ) => {
      if (!conn) {
        return {
          success: false,
          error: 'Database connection not available',
        };
      }

      try {
        const { projectId, plotId, limit = 50, status } = options || {};
        
        let sql = `
          SELECT 
            id, project_id, plot_id, topic, status, thread_id,
            participants, metadata, created_at, updated_at
          FROM agent_discussions
          WHERE 1=1
        `;
        
        const params: any[] = [];

        if (projectId) {
          sql += ` AND project_id = ?`;
          params.push(projectId);
        }

        if (plotId) {
          sql += ` AND plot_id = ?`;
          params.push(plotId);
        }

        if (status) {
          sql += ` AND status = ?`;
          params.push(status);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve) => {
          conn.all(sql, params, (err: any, rows: any[]) => {
            if (err) {
              console.error('Failed to get discussion history:', err);
              resolve({
                success: false,
                error: err.message,
              });
            } else {
              const discussions = rows.map(row => ({
                id: row.id,
                projectId: row.project_id,
                plotId: row.plot_id,
                topic: row.topic,
                status: row.status,
                threadId: row.thread_id,
                participants: JSON.parse(row.participants || '[]'),
                metadata: JSON.parse(row.metadata || '{}'),
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
              }));

              resolve({
                success: true,
                discussions,
              });
            }
          });
        });
      } catch (error) {
        console.error('Failed to get discussion history:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // 24時間自動モード切り替え
  ipcMain.handle(
    'discussion:setAutonomousMode',
    async (_, enabled: boolean, options?: { qualityThreshold?: number }) => {
      if (!discussionManager) {
        return {
          success: false,
          error: 'Discussion manager not initialized',
        };
      }

      try {
        // 24時間モードの設定を保存/更新
        // 実装は将来的に追加される予定
        console.log('Autonomous mode:', enabled ? 'enabled' : 'disabled', options);
        
        return {
          success: true,
          message: `Autonomous mode ${enabled ? 'enabled' : 'disabled'}`,
        };
      } catch (error) {
        console.error('Failed to set autonomous mode:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // Get token usage statistics
  ipcMain.handle('discussion:getTokenUsage', async () => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      const stats = discussionManager.getTokenUsageStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('Failed to get token usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get summarization configuration
  ipcMain.handle('discussion:getSummarizationConfig', async () => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      const config = discussionManager.getSummarizationConfig();
      return {
        success: true,
        config,
      };
    } catch (error) {
      console.error('Failed to get summarization config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Update summarization configuration
  ipcMain.handle('discussion:updateSummarizationConfig', async (_, config: any) => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      discussionManager.updateSummarizationConfig(config);
      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to update summarization config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get discussion summaries
  ipcMain.handle('discussion:getSummaries', async (_, discussionId?: string) => {
    if (!discussionManager) {
      return {
        success: false,
        error: 'Discussion manager not initialized',
      };
    }

    try {
      let discussion: Discussion | undefined;
      
      if (discussionId) {
        discussion = discussionManager.getDiscussion(discussionId);
      } else {
        discussion = discussionManager.getActiveDiscussion();
      }

      if (!discussion) {
        return {
          success: false,
          error: 'Discussion not found',
        };
      }

      return {
        success: true,
        summaries: discussion.summaries || [],
      };
    } catch (error) {
      console.error('Failed to get summaries:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

/**
 * DiscussionManagerのイベントをレンダラープロセスに転送
 */
function setupEventForwarding(): void {
  if (!discussionManager || !mainWindow) return;

  // 議論開始イベント
  discussionManager.on('discussionStarted', (data) => {
    mainWindow?.webContents.send('discussion:started', data);
  });

  // 議論完了イベント
  discussionManager.on('discussionCompleted', (data) => {
    mainWindow?.webContents.send('discussion:completed', data);
  });

  // 議論一時停止イベント
  discussionManager.on('discussionPaused', (data) => {
    mainWindow?.webContents.send('discussion:paused', data);
  });

  // 議論再開イベント
  discussionManager.on('discussionResumed', (data) => {
    mainWindow?.webContents.send('discussion:resumed', data);
  });

  // 議論エラーイベント
  discussionManager.on('discussionError', (data) => {
    mainWindow?.webContents.send('discussion:error', data);
  });

  // 議論タイムアウトイベント
  discussionManager.on('discussionTimeout', (data) => {
    mainWindow?.webContents.send('discussion:timeout', data);
  });

  // 議論自動停止イベント
  discussionManager.on('discussionAutoStopped', (data) => {
    mainWindow?.webContents.send('discussion:autoStopped', data);
  });

  // エージェント発言イベント
  discussionManager.on('agentSpoke', (data) => {
    const agent = discussionManager!.getAgent(data.agentId);
    const enrichedData = {
      ...data,
      agentName: agent?.getName() || data.agentId,
      agentRole: agent?.getRole() || 'unknown',
    };
    mainWindow?.webContents.send('discussion:agentSpoke', enrichedData);
  });

  // エージェントエラーイベント
  discussionManager.on('agentError', (data) => {
    mainWindow?.webContents.send('discussion:agentError', data);
  });

  // 人間介入イベント
  discussionManager.on('humanIntervention', (data) => {
    mainWindow?.webContents.send('discussion:humanIntervention', data);
  });

  // Summarization started event
  discussionManager.on('summarizationStarted', (data) => {
    mainWindow?.webContents.send('discussion:summarizationStarted', data);
  });

  // Summarization completed event
  discussionManager.on('summarizationCompleted', (data) => {
    mainWindow?.webContents.send('discussion:summarizationCompleted', data);
  });

  // Summarization error event
  discussionManager.on('summarizationError', (data) => {
    mainWindow?.webContents.send('discussion:summarizationError', data);
  });
}

/**
 * クリーンアップ関数
 */
export function cleanupAgentDiscussionHandlers(): void {
  discussionManager?.removeAllListeners();
  discussionManager = null;
  mainWindow = null;
}

/**
 * DiscussionManagerインスタンスを取得（テスト用）
 */
export function getDiscussionManager(): DiscussionManager | null {
  return discussionManager;
}