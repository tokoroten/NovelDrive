/**
 * プロット生成ワークフローサービス
 * ユーザーの初期アイデアから完成されたプロットまでの全工程を管理
 */

import { v4 as uuidv4 } from 'uuid';
import { ipcMain } from 'electron';
import * as duckdb from 'duckdb';
import { EventEmitter } from 'events';
import OpenAI from 'openai';

import { PlotManager, PlotNode, PlotStructure } from './plot-management';
import { DiscussionManager, Discussion } from './agents/discussion-manager';
import { WriterAgent } from './agents/writer-agent';
import { EditorAgent } from './agents/editor-agent';
import { ProofreaderAgent } from './agents/proofreader-agent';
import { DeputyEditorAgent, QualityEvaluation } from './agents/deputy-editor-agent';
import { performSerendipitySearch } from './serendipity-search';
import { ApiUsageLogger } from './api-usage-logger';

export interface PlotGenerationRequest {
  theme: string;
  genre: string;
  targetAudience?: string;
  initialIdea?: string;
  constraints?: string[];
  projectId: string;
  humanUserId?: string;
}

export interface PlotGenerationStage {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export interface PlotGenerationSession {
  id: string;
  request: PlotGenerationRequest;
  stages: PlotGenerationStage[];
  currentStage: number;
  status: 'initializing' | 'generating' | 'discussing' | 'evaluating' | 'completed' | 'failed' | 'cancelled';
  discussionId?: string;
  plots: string[]; // 生成されたプロットのIDリスト
  finalPlotId?: string;
  evaluation?: QualityEvaluation;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    serendipityElements?: string[];
    humanInterventions?: number;
    iterationCount?: number;
  };
}

export class PlotGenerationWorkflow extends EventEmitter {
  private plotManager: PlotManager;
  private discussionManager: DiscussionManager;
  private sessions: Map<string, PlotGenerationSession> = new Map();
  private dbConnection: duckdb.Connection;
  private openai: OpenAI;
  private apiLogger: ApiUsageLogger;

  // 生成ステージの定義
  private readonly STAGES = [
    'serendipity_search',    // セレンディピティ検索
    'initial_plot_gen',      // 初期プロット生成
    'agent_discussion',      // エージェント議論
    'plot_refinement',       // プロット改善
    'final_evaluation',      // 最終評価
    'approval_decision'      // 承認判定
  ];

  constructor(
    plotManager: PlotManager,
    dbConnection: duckdb.Connection,
    openai: OpenAI,
    apiLogger: ApiUsageLogger
  ) {
    super();
    this.plotManager = plotManager;
    this.dbConnection = dbConnection;
    this.openai = openai;
    this.apiLogger = apiLogger;
    
    this.discussionManager = new DiscussionManager(
      openai,
      dbConnection,
      apiLogger
    );

    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    this.discussionManager.on('discussionCompleted', (data) => {
      this.handleDiscussionCompleted(data);
    });

    this.discussionManager.on('discussionError', (data) => {
      this.handleDiscussionError(data);
    });
  }

  /**
   * プロット生成セッションを開始
   */
  async startPlotGeneration(request: PlotGenerationRequest): Promise<string> {
    const sessionId = uuidv4();
    
    const session: PlotGenerationSession = {
      id: sessionId,
      request,
      stages: this.STAGES.map(name => ({ name, status: 'pending' })),
      currentStage: 0,
      status: 'initializing',
      plots: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        serendipityElements: [],
        humanInterventions: 0,
        iterationCount: 0
      }
    };

    this.sessions.set(sessionId, session);
    
    // イベント発火
    this.emit('sessionStarted', { sessionId, request });

    // ワークフローを非同期で実行
    this.executeWorkflow(sessionId).catch((error) => {
      this.handleWorkflowError(sessionId, error);
    });

    return sessionId;
  }

  /**
   * ワークフローの実行
   */
  private async executeWorkflow(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'generating';
    session.updatedAt = new Date();

    for (let i = 0; i < this.STAGES.length; i++) {
      session.currentStage = i;
      const stage = session.stages[i];
      
      this.emit('stageStarted', { sessionId, stage: stage.name });

      try {
        await this.executeStage(sessionId, stage);
        
        if (stage.status === 'failed') {
          session.status = 'failed';
          this.emit('sessionFailed', { sessionId, stage: stage.name, error: stage.error });
          return;
        }

      } catch (error) {
        stage.status = 'failed';
        stage.error = error instanceof Error ? error.message : 'Unknown error';
        session.status = 'failed';
        this.emit('sessionFailed', { sessionId, stage: stage.name, error: stage.error });
        return;
      }
    }

    session.status = 'completed';
    session.updatedAt = new Date();
    this.emit('sessionCompleted', { 
      sessionId, 
      finalPlotId: session.finalPlotId,
      evaluation: session.evaluation 
    });
  }

  /**
   * 個別ステージの実行
   */
  private async executeStage(sessionId: string, stage: PlotGenerationStage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    stage.status = 'in_progress';
    stage.startTime = new Date();

    switch (stage.name) {
      case 'serendipity_search':
        await this.executeSerendipitySearch(session, stage);
        break;
      case 'initial_plot_gen':
        await this.executeInitialPlotGeneration(session, stage);
        break;
      case 'agent_discussion':
        await this.executeAgentDiscussion(session, stage);
        break;
      case 'plot_refinement':
        await this.executePlotRefinement(session, stage);
        break;
      case 'final_evaluation':
        await this.executeFinalEvaluation(session, stage);
        break;
      case 'approval_decision':
        await this.executeApprovalDecision(session, stage);
        break;
    }

    stage.endTime = new Date();
    session.updatedAt = new Date();
  }

  /**
   * セレンディピティ検索の実行
   */
  private async executeSerendipitySearch(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      const { theme, genre, initialIdea } = session.request;
      
      // 検索クエリを構築
      const searchQuery = [theme, genre, initialIdea].filter(Boolean).join(' ');
      
      // セレンディピティ検索を実行
      const results = await performSerendipitySearch(
        this.dbConnection,
        searchQuery,
        {
          limit: 10,
          projectId: session.request.projectId,
          serendipityLevel: 0.4, // 高めのセレンディピティレベル
          minScore: 0.3
        }
      );

      // 結果をメタデータに保存
      if (session.metadata) {
        session.metadata.serendipityElements = results.map(r => 
          `[${r.type}] ${r.title}: ${r.content.substring(0, 100)}...`
        );
      }

      stage.result = results;
      stage.status = 'completed';

      this.emit('serendipitySearchCompleted', { 
        sessionId: session.id, 
        elements: results.length 
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Serendipity search failed';
    }
  }

  /**
   * 初期プロット生成の実行
   */
  private async executeInitialPlotGeneration(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      const writerAgent = new WriterAgent(this.openai, this.apiLogger, this.dbConnection);
      
      // セレンディピティ要素を取得
      const serendipityStage = session.stages.find(s => s.name === 'serendipity_search');
      const serendipityElements = serendipityStage?.result || [];

      // プロット生成
      const plotContent = await writerAgent.generatePlot(
        session.request.theme,
        session.request.genre,
        serendipityElements.map((e: any) => `${e.title}: ${e.content.substring(0, 200)}`)
      );

      // プロット構造を解析・構築
      const structure = this.parsePlotStructure(plotContent, session.request.genre);

      // データベースに保存
      const plot = await this.plotManager.createPlot(session.request.projectId, {
        title: this.extractPlotTitle(plotContent) || `${session.request.theme}のプロット`,
        synopsis: this.extractPlotSynopsis(plotContent) || plotContent.substring(0, 500),
        structure,
        createdBy: 'writer-agent'
      });

      session.plots.push(plot.id);
      stage.result = { plotId: plot.id, content: plotContent };
      stage.status = 'completed';

      this.emit('initialPlotGenerated', { 
        sessionId: session.id, 
        plotId: plot.id 
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Initial plot generation failed';
    }
  }

  /**
   * エージェント議論の実行
   */
  private async executeAgentDiscussion(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      const plotStage = session.stages.find(s => s.name === 'initial_plot_gen');
      if (!plotStage || !plotStage.result) {
        throw new Error('No initial plot available for discussion');
      }

      const plotId = plotStage.result.plotId;
      const plot = await this.plotManager.getPlot(plotId);
      if (!plot) {
        throw new Error('Plot not found');
      }

      // 議論を開始
      const discussionId = await this.discussionManager.startDiscussion(
        `プロット「${plot.title}」の評価と改善`,
        {
          projectId: session.request.projectId,
          plotId: plot.id,
          initialKnowledge: `テーマ: ${session.request.theme}\nジャンル: ${session.request.genre}\n\nプロット内容:\n${plot.synopsis}`
        },
        {
          maxRounds: 5,
          autoStop: true,
          saveToDatabase: true,
          humanInterventionEnabled: true
        }
      );

      session.discussionId = discussionId;
      session.status = 'discussing';
      
      stage.result = { discussionId };
      stage.status = 'completed';

      this.emit('discussionStarted', { 
        sessionId: session.id, 
        discussionId 
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Agent discussion failed to start';
    }
  }

  /**
   * プロット改善の実行
   */
  private async executePlotRefinement(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      if (!session.discussionId) {
        stage.status = 'completed'; // 議論がない場合はスキップ
        return;
      }

      const discussion = this.discussionManager.getDiscussion(session.discussionId);
      if (!discussion || discussion.status !== 'completed') {
        throw new Error('Discussion not completed yet');
      }

      // 議論の結果を分析して改善案を抽出
      const improvements = this.extractImprovements(discussion);
      
      if (improvements.length === 0) {
        stage.status = 'completed'; // 改善案がない場合はスキップ
        return;
      }

      // 元のプロットを取得
      const originalPlotId = session.plots[session.plots.length - 1];
      const originalPlot = await this.plotManager.getPlot(originalPlotId);
      if (!originalPlot) {
        throw new Error('Original plot not found');
      }

      // 改善版プロットを生成
      const writerAgent = new WriterAgent(this.openai, this.apiLogger, this.dbConnection);
      const refinedPlotContent = await writerAgent.participate({
        topic: `プロット改善`,
        previousMessages: discussion.messages.slice(-5), // 最新の議論を参考に
        knowledgeContext: `改善点:\n${improvements.join('\n')}\n\n元のプロット:\n${originalPlot.synopsis}`
      });

      // 改善版プロットを保存
      const refinedStructure = this.parsePlotStructure(refinedPlotContent.content, session.request.genre);
      const refinedPlot = await this.plotManager.forkPlot(originalPlotId, {
        title: `${originalPlot.title}（改訂版）`,
        synopsis: this.extractPlotSynopsis(refinedPlotContent.content) || refinedPlotContent.content.substring(0, 500),
        structure: refinedStructure,
        createdBy: 'writer-agent'
      });

      session.plots.push(refinedPlot.id);
      stage.result = { plotId: refinedPlot.id, improvements };
      stage.status = 'completed';

      if (session.metadata) {
        session.metadata.iterationCount = (session.metadata.iterationCount || 0) + 1;
      }

      this.emit('plotRefined', { 
        sessionId: session.id, 
        refinedPlotId: refinedPlot.id,
        improvements: improvements.length
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Plot refinement failed';
    }
  }

  /**
   * 最終評価の実行
   */
  private async executeFinalEvaluation(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      const finalPlotId = session.plots[session.plots.length - 1];
      const plot = await this.plotManager.getPlot(finalPlotId);
      if (!plot) {
        throw new Error('Final plot not found');
      }

      // 副編集長による評価
      const deputyEditor = new DeputyEditorAgent(this.openai, this.apiLogger);
      
      // 他のエージェントの意見を取得（議論があった場合）
      let otherOpinions: Record<string, string> = {};
      if (session.discussionId) {
        const discussion = this.discussionManager.getDiscussion(session.discussionId);
        if (discussion) {
          otherOpinions = this.extractAgentOpinions(discussion);
        }
      }

      const evaluation = await deputyEditor.evaluateQuality(
        plot.synopsis,
        session.request.genre,
        session.request.targetAudience || 'general',
        otherOpinions
      );

      session.evaluation = evaluation;
      stage.result = evaluation;
      stage.status = 'completed';

      this.emit('evaluationCompleted', { 
        sessionId: session.id, 
        evaluation 
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Final evaluation failed';
    }
  }

  /**
   * 承認判定の実行
   */
  private async executeApprovalDecision(
    session: PlotGenerationSession,
    stage: PlotGenerationStage
  ): Promise<void> {
    try {
      if (!session.evaluation) {
        throw new Error('No evaluation available for approval decision');
      }

      const finalPlotId = session.plots[session.plots.length - 1];
      const shouldApprove = session.evaluation.recommendation === 'accept';

      // プロットのステータスを更新
      await this.plotManager.updatePlotStatus(
        finalPlotId,
        shouldApprove ? 'approved' : 'rejected'
      );

      if (shouldApprove) {
        session.finalPlotId = finalPlotId;
      }

      stage.result = { 
        approved: shouldApprove,
        plotId: finalPlotId,
        evaluation: session.evaluation
      };
      stage.status = 'completed';

      this.emit('approvalDecision', { 
        sessionId: session.id, 
        approved: shouldApprove,
        plotId: finalPlotId
      });

    } catch (error) {
      stage.status = 'failed';
      stage.error = error instanceof Error ? error.message : 'Approval decision failed';
    }
  }

  /**
   * プロット構造の解析
   */
  private parsePlotStructure(content: string, genre: string): PlotStructure {
    // AIの生成したプロット内容から構造を抽出
    // 実装は簡略化、実際にはより高度な解析が必要
    
    return {
      acts: [
        {
          actNumber: 1,
          title: '序章',
          chapters: [],
          purpose: '導入',
          keyEvents: []
        },
        {
          actNumber: 2,
          title: '中盤',
          chapters: [],
          purpose: '展開',
          keyEvents: []
        },
        {
          actNumber: 3,
          title: '終章',
          chapters: [],
          purpose: '結末',
          keyEvents: []
        }
      ],
      totalChapters: 0,
      estimatedLength: Math.max(content.length * 10, 50000),
      genre,
      themes: this.extractThemes(content),
      mainConflict: this.extractMainConflict(content),
      resolution: this.extractResolution(content)
    };
  }

  /**
   * プロットからタイトルを抽出
   */
  private extractPlotTitle(content: string): string | null {
    const titleMatch = content.match(/(?:タイトル|題名|作品名)[:：]\s*([^\n]+)/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * プロットからあらすじを抽出
   */
  private extractPlotSynopsis(content: string): string | null {
    const synopsisMatch = content.match(/(?:あらすじ|概要|ストーリー)[:：]\s*([\s\S]*?)(?=\n\n|\n(?:[A-Za-z]|[\u4e00-\u9faf])|$)/i);
    return synopsisMatch ? synopsisMatch[1].trim() : null;
  }

  /**
   * テーマを抽出
   */
  private extractThemes(content: string): string[] {
    const themeMatches = content.match(/(?:テーマ|主題)[:：]\s*([^\n]+)/gi);
    if (!themeMatches) return [];
    
    return themeMatches
      .map(match => match.replace(/(?:テーマ|主題)[:：]\s*/i, ''))
      .flatMap(themes => themes.split(/[、,]/))
      .map(theme => theme.trim())
      .filter(theme => theme.length > 0);
  }

  /**
   * 主要な葛藤を抽出
   */
  private extractMainConflict(content: string): string {
    const conflictMatch = content.match(/(?:葛藤|対立|問題|困難)[:：]\s*([^\n]+)/i);
    return conflictMatch ? conflictMatch[1].trim() : '';
  }

  /**
   * 解決策を抽出
   */
  private extractResolution(content: string): string {
    const resolutionMatch = content.match(/(?:解決|結末|終わり方)[:：]\s*([^\n]+)/i);
    return resolutionMatch ? resolutionMatch[1].trim() : '';
  }

  /**
   * 議論から改善点を抽出
   */
  private extractImprovements(discussion: Discussion): string[] {
    const improvements: string[] = [];
    
    // エージェントのメッセージから改善提案を抽出
    for (const message of discussion.messages) {
      if (message.content.includes('改善') || message.content.includes('提案')) {
        const lines = message.content.split('\n');
        for (const line of lines) {
          if (line.includes('-') && (line.includes('改善') || line.includes('提案'))) {
            improvements.push(line.replace(/^[-・]*\s*/, '').trim());
          }
        }
      }
    }

    return improvements.filter(imp => imp.length > 10); // 短すぎる提案は除外
  }

  /**
   * エージェントの意見を抽出
   */
  private extractAgentOpinions(discussion: Discussion): Record<string, string> {
    const opinions: Record<string, string> = {};
    
    for (const message of discussion.messages) {
      const role = message.agentId.split('-')[0];
      if (!opinions[role] || message.timestamp > new Date(opinions[role])) {
        opinions[role] = message.content;
      }
    }

    return opinions;
  }

  /**
   * 議論完了の処理
   */
  private handleDiscussionCompleted(data: any): void {
    const session = Array.from(this.sessions.values()).find(s => s.discussionId === data.discussionId);
    if (session) {
      this.emit('sessionDiscussionCompleted', {
        sessionId: session.id,
        discussionId: data.discussionId
      });
    }
  }

  /**
   * 議論エラーの処理
   */
  private handleDiscussionError(data: any): void {
    const session = Array.from(this.sessions.values()).find(s => s.discussionId === data.discussionId);
    if (session) {
      this.emit('sessionDiscussionError', {
        sessionId: session.id,
        discussionId: data.discussionId,
        error: data.error
      });
    }
  }

  /**
   * ワークフローエラーの処理
   */
  private handleWorkflowError(sessionId: string, error: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.updatedAt = new Date();
      this.emit('sessionFailed', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown workflow error' 
      });
    }
  }

  /**
   * セッション情報の取得
   */
  getSession(sessionId: string): PlotGenerationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * セッション一覧の取得
   */
  getSessions(): PlotGenerationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * セッションのキャンセル
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'cancelled';
    session.updatedAt = new Date();

    // 進行中の議論があれば停止
    if (session.discussionId) {
      this.discussionManager.pauseDiscussion();
    }

    this.emit('sessionCancelled', { sessionId });
    return true;
  }

  /**
   * 人間の介入を追加
   */
  async addHumanIntervention(sessionId: string, content: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.discussionId) return false;

    await this.discussionManager.addHumanIntervention(content);
    
    if (session.metadata) {
      session.metadata.humanInterventions = (session.metadata.humanInterventions || 0) + 1;
    }

    this.emit('humanIntervention', { sessionId, content });
    return true;
  }
}

/**
 * IPCハンドラーの設定
 */
export function setupPlotGenerationHandlers(
  workflow: PlotGenerationWorkflow
): void {
  ipcMain.handle('plotGen:start', async (_, request: PlotGenerationRequest) => {
    try {
      const sessionId = await workflow.startPlotGeneration(request);
      return { success: true, sessionId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:getSession', async (_, sessionId: string) => {
    try {
      const session = workflow.getSession(sessionId);
      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:getSessions', async () => {
    try {
      const sessions = workflow.getSessions();
      return { success: true, sessions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:cancel', async (_, sessionId: string) => {
    try {
      const cancelled = await workflow.cancelSession(sessionId);
      return { success: cancelled };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('plotGen:addIntervention', async (_, sessionId: string, content: string) => {
    try {
      const added = await workflow.addHumanIntervention(sessionId, content);
      return { success: added };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}