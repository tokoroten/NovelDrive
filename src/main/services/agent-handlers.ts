import { ipcMain } from 'electron';
import { MultiAgentOrchestrator, AgentRole, PersonalityType } from './multi-agent-system';

let orchestrator: MultiAgentOrchestrator | null = null;

/**
 * エージェントシステムのIPCハンドラーを設定
 */
export function setupAgentHandlers(conn: any): void {
  // オーケストレーターの初期化
  orchestrator = new MultiAgentOrchestrator(conn);

  // エージェント作成
  ipcMain.handle(
    'agents:create',
    async (
      _,
      options: {
        role: AgentRole;
        personality: PersonalityType;
        name?: string;
        temperature?: number;
        customPrompt?: string;
      }
    ) => {
      if (!orchestrator) {
        throw new Error('Orchestrator not initialized');
      }

      try {
        const agent = await orchestrator.createAgent(options.role, options.personality, {
          name: options.name,
          temperature: options.temperature,
          customPrompt: options.customPrompt,
        });

        return {
          success: true,
          agent: agent.toJSON(),
        };
      } catch (error) {
        console.error('Failed to create agent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  // 議論開始
  ipcMain.handle(
    'agents:startDiscussion',
    async (
      _,
      options: {
        topic: string;
        agentConfigs: Array<{
          role: AgentRole;
          personality: PersonalityType;
          name?: string;
        }>;
        projectId?: string;
        plotId?: string;
        maxRounds?: number;
      }
    ) => {
      if (!orchestrator) {
        throw new Error('Orchestrator not initialized');
      }

      try {
        // エージェントを作成
        const agents = await Promise.all(
          options.agentConfigs.map((config) =>
            orchestrator!.createAgent(config.role, config.personality, { name: config.name })
          )
        );

        // 議論を開始
        const session = await orchestrator.startDiscussion(options.topic, agents, {
          projectId: options.projectId,
          plotId: options.plotId,
          maxRounds: options.maxRounds,
        });

        return {
          success: true,
          session: {
            id: session.id,
            topic: session.topic,
            status: session.status,
            messageCount: session.messages.length,
            summary: session.summary,
            startTime: session.startTime,
            endTime: session.endTime,
          },
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

  // セッション一時停止
  ipcMain.handle('agents:pauseSession', async (_, sessionId: string) => {
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      orchestrator.pauseSession(sessionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // セッション再開
  ipcMain.handle('agents:resumeSession', async (_, sessionId: string) => {
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      orchestrator.resumeSession(sessionId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // セッション取得
  ipcMain.handle('agents:getSession', async (_, sessionId: string) => {
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    const session = orchestrator.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
      };
    }

    return {
      success: true,
      session: {
        id: session.id,
        topic: session.topic,
        status: session.status,
        messages: session.messages,
        participants: session.participants.map((p) => p.toJSON()),
        summary: session.summary,
        startTime: session.startTime,
        endTime: session.endTime,
      },
    };
  });

  // 全セッション取得
  ipcMain.handle('agents:getAllSessions', async () => {
    if (!orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    const sessions = orchestrator.getAllSessions();
    return {
      success: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        topic: session.topic,
        status: session.status,
        messageCount: session.messages.length,
        startTime: session.startTime,
        endTime: session.endTime,
      })),
    };
  });

  // 議論履歴の取得（データベースから）
  ipcMain.handle(
    'agents:getDiscussionHistory',
    async (
      _,
      options?: {
        projectId?: string;
        plotId?: string;
        limit?: number;
      }
    ) => {
      const { projectId, plotId, limit = 50 } = options || {};

      let sql = `
      SELECT id, plot_id, participants, messages, conclusion, status, 
             created_at, updated_at
      FROM agent_discussions
      WHERE 1=1
    `;

      const params: any[] = [];

      if (projectId) {
        sql += ` AND plot_id IN (SELECT id FROM plots WHERE project_id = ?)`;
        params.push(projectId);
      }

      if (plotId) {
        sql += ` AND plot_id = ?`;
        params.push(plotId);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      return new Promise((resolve, reject) => {
        conn.all(sql, params, (err: any, rows: any[]) => {
          if (err) {
            reject({
              success: false,
              error: err.message,
            });
          } else {
            const results = rows.map((row) => ({
              ...row,
              participants: JSON.parse(row.participants || '[]'),
              messages: JSON.parse(row.messages || '[]'),
            }));
            resolve({
              success: true,
              discussions: results,
            });
          }
        });
      });
    }
  );

  // リアルタイムメッセージ通知の設定
  if (orchestrator) {
    orchestrator.on('message', ({ session, message }) => {
      // レンダラープロセスに通知を送信
      if (global.mainWindow) {
        (global as any).mainWindow.webContents.send('agent-message', {
          sessionId: session.id,
          message,
        });
      }
    });

    orchestrator.on('sessionStarted', (session) => {
      if (global.mainWindow) {
        (global as any).mainWindow.webContents.send('session-started', {
          sessionId: session.id,
          topic: session.topic,
        });
      }
    });

    orchestrator.on('sessionConcluded', (session) => {
      if (global.mainWindow) {
        (global as any).mainWindow.webContents.send('session-concluded', {
          sessionId: session.id,
          summary: session.summary,
        });
      }
    });
  }
}

// グローバル宣言の追加
declare global {
  // eslint-disable-next-line no-var
  var mainWindow: any;
}
