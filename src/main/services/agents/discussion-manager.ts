/**
 * マルチエージェント議論管理システム
 */

import { v4 as uuidv4 } from 'uuid';
import * as duckdb from 'duckdb';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { BaseAgent, AgentMessage, DiscussionContext } from './agent-base';
import { WriterAgent } from './writer-agent';
import { EditorAgent } from './editor-agent';
import { ProofreaderAgent } from './proofreader-agent';
import { DeputyEditorAgent } from './deputy-editor-agent';
import { ApiUsageLogger } from '../api-usage-logger';
import { MessageSummarizer, MessageSummary, SummarizationConfig } from './message-summarizer';
import { TokenCounter } from './token-counter';

export interface Discussion {
  id: string;
  projectId?: string;
  plotId?: string;
  topic: string;
  status: 'active' | 'paused' | 'completed' | 'aborted';
  startTime: Date;
  endTime?: Date;
  participants: string[];
  messages: AgentMessage[];
  summaries: MessageSummary[];
  decisions: string[];
  qualityScore?: number;
  metadata?: Record<string, any>;
}

export interface DiscussionOptions {
  maxRounds?: number;
  timeLimit?: number; // ミリ秒
  autoStop?: boolean;
  saveToDatabase?: boolean;
  humanInterventionEnabled?: boolean;
  enableSummarization?: boolean;
  summarizationConfig?: SummarizationConfig;
}

export class DiscussionManager extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private discussions: Map<string, Discussion> = new Map();
  private dbConnection?: duckdb.Connection;
  private apiLogger?: ApiUsageLogger;
  private openai: OpenAI;
  private isRunning: boolean = false;
  private currentDiscussionId?: string;
  private messageSummarizer: MessageSummarizer;

  constructor(
    openai: OpenAI,
    dbConnection?: duckdb.Connection,
    apiLogger?: ApiUsageLogger
  ) {
    super();
    this.openai = openai;
    this.dbConnection = dbConnection;
    this.apiLogger = apiLogger;
    this.messageSummarizer = new MessageSummarizer(openai, apiLogger);
    this.initializeAgents();
  }

  /**
   * エージェントの初期化
   */
  private initializeAgents(): void {
    // 各エージェントのインスタンスを作成
    const writer = new WriterAgent(this.openai, this.apiLogger, this.dbConnection);
    const editor = new EditorAgent(this.openai, this.apiLogger);
    const proofreader = new ProofreaderAgent(this.openai, this.apiLogger, this.dbConnection);
    const deputyEditor = new DeputyEditorAgent(this.openai, this.apiLogger);

    this.agents.set(writer.getId(), writer);
    this.agents.set(editor.getId(), editor);
    this.agents.set(proofreader.getId(), proofreader);
    this.agents.set(deputyEditor.getId(), deputyEditor);
  }

  /**
   * 新しい議論を開始
   */
  async startDiscussion(
    topic: string,
    context?: {
      projectId?: string;
      plotId?: string;
      initialKnowledge?: string;
    },
    options: DiscussionOptions = {}
  ): Promise<string> {
    const discussionId = uuidv4();
    const discussion: Discussion = {
      id: discussionId,
      projectId: context?.projectId,
      plotId: context?.plotId,
      topic,
      status: 'active',
      startTime: new Date(),
      participants: Array.from(this.agents.keys()),
      messages: [],
      summaries: [],
      decisions: [],
    };

    this.discussions.set(discussionId, discussion);
    this.currentDiscussionId = discussionId;
    this.isRunning = true;

    // イベント発火
    this.emit('discussionStarted', { discussionId, topic });

    // 議論を実行
    try {
      await this.runDiscussion(discussionId, context?.initialKnowledge, options);
    } catch (error) {
      discussion.status = 'aborted';
      this.emit('discussionError', { discussionId, error });
      throw error;
    }

    return discussionId;
  }

  /**
   * 議論を実行
   */
  private async runDiscussion(
    discussionId: string,
    initialKnowledge?: string,
    options: DiscussionOptions = {}
  ): Promise<void> {
    const discussion = this.discussions.get(discussionId);
    if (!discussion) throw new Error('Discussion not found');

    const maxRounds = options.maxRounds || 10;
    const timeLimit = options.timeLimit || 30 * 60 * 1000; // 30分
    const startTime = Date.now();

    // 初期コンテキスト
    const context: DiscussionContext = {
      projectId: discussion.projectId,
      plotId: discussion.plotId,
      topic: discussion.topic,
      previousMessages: [],
      knowledgeContext: initialKnowledge,
    };

    // Configure summarizer if needed
    if (options.enableSummarization && options.summarizationConfig) {
      this.messageSummarizer.updateConfig(options.summarizationConfig);
    }

    // 議論ラウンド
    for (let round = 0; round < maxRounds && this.isRunning; round++) {
      // タイムアウトチェック
      if (Date.now() - startTime > timeLimit) {
        this.emit('discussionTimeout', { discussionId, round });
        break;
      }

      // 各エージェントの発言順序（作家→編集→校閲→副編集長）
      const agentOrder = [
        'writer',
        'editor',
        'proofreader',
        'deputy_editor'
      ];

      for (const role of agentOrder) {
        if (!this.isRunning) break;

        const agent = Array.from(this.agents.values()).find(a => a.getRole() === role);
        if (!agent) continue;

        try {
          // エージェントの発言を生成
          const message = await agent.participate(context);
          discussion.messages.push(message);
          context.previousMessages.push(message);

          // イベント発火
          this.emit('agentSpoke', {
            discussionId,
            agentId: agent.getId(),
            role: agent.getRole(),
            message,
            round,
          });

          // 人間の介入チェック
          if (options.humanInterventionEnabled) {
            await this.checkHumanIntervention();
          }

        } catch (error) {
          this.emit('agentError', {
            discussionId,
            agentId: agent.getId(),
            error,
          });
        }
      }

      // Check if summarization is needed
      if (options.enableSummarization && this.messageSummarizer.shouldSummarize(discussion.messages)) {
        await this.performSummarization(discussion, context);
      }

      // ラウンド終了時の評価
      if (options.autoStop && round >= 2) {
        const shouldStop = await this.evaluateDiscussion(discussion);
        if (shouldStop) {
          this.emit('discussionAutoStopped', { discussionId, round });
          break;
        }
      }
    }

    // 議論終了処理
    await this.concludeDiscussion(discussionId, options);
  }

  /**
   * 人間の介入をチェック
   */
  private async checkHumanIntervention(): Promise<void> {
    return new Promise((resolve) => {
      // 100ミリ秒待機して、介入があるかチェック
      setTimeout(resolve, 100);
    });
  }

  /**
   * 議論を評価して継続判断
   */
  private async evaluateDiscussion(discussion: Discussion): Promise<boolean> {
    // 副編集長の最新評価を確認
    const deputyMessages = discussion.messages.filter(m => 
      m.agentId.includes('deputy_editor')
    );

    if (deputyMessages.length === 0) return false;

    const lastMessage = deputyMessages[deputyMessages.length - 1];
    
    // 評価スコアが含まれているかチェック
    if (lastMessage.content.includes('採用推奨') || 
        lastMessage.content.includes('総合評価') && lastMessage.content.match(/\d{2,3}点/)) {
      return true; // 評価が完了したので停止
    }

    return false;
  }

  /**
   * 議論を終了
   */
  private async concludeDiscussion(
    discussionId: string,
    options: DiscussionOptions
  ): Promise<void> {
    const discussion = this.discussions.get(discussionId);
    if (!discussion) return;

    discussion.status = 'completed';
    discussion.endTime = new Date();

    // 最終評価を抽出
    const evaluation = this.extractFinalEvaluation(discussion);
    discussion.qualityScore = evaluation.score;
    discussion.decisions = evaluation.decisions;

    // データベースに保存
    if (options.saveToDatabase && this.dbConnection) {
      await this.saveDiscussionToDatabase(discussion);
    }

    this.isRunning = false;
    this.currentDiscussionId = undefined;

    // イベント発火
    this.emit('discussionCompleted', {
      discussionId,
      qualityScore: discussion.qualityScore,
      decisions: discussion.decisions,
    });
  }

  /**
   * 最終評価を抽出
   */
  private extractFinalEvaluation(discussion: Discussion): {
    score: number;
    decisions: string[];
  } {
    const deputyMessages = discussion.messages.filter(m => 
      m.agentId.includes('deputy_editor')
    );

    if (deputyMessages.length === 0) {
      return { score: 0, decisions: [] };
    }

    const lastMessage = deputyMessages[deputyMessages.length - 1];
    const scoreMatch = lastMessage.content.match(/総合評価】\s*(\d+(?:\.\d+)?)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

    // 決定事項を抽出
    const decisions: string[] = [];
    if (lastMessage.content.includes('採用推奨')) {
      decisions.push('採用推奨');
    } else if (lastMessage.content.includes('要改善')) {
      decisions.push('要改善');
    } else {
      decisions.push('不採用');
    }

    // 改善提案を抽出
    const suggestionMatch = lastMessage.content.match(/【改善提案】([\s\S]*?)(?=【|$)/);
    if (suggestionMatch) {
      const suggestions = suggestionMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());
      decisions.push(...suggestions);
    }

    return { score, decisions };
  }

  /**
   * 議論をデータベースに保存
   */
  private async saveDiscussionToDatabase(discussion: Discussion): Promise<void> {
    if (!this.dbConnection) return;

    const sql = `
      INSERT INTO agent_discussions (
        id, project_id, plot_id, topic, status, thread_id,
        participants, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const metadata = {
      startTime: discussion.startTime,
      endTime: discussion.endTime,
      messageCount: discussion.messages.length,
      qualityScore: discussion.qualityScore,
      decisions: discussion.decisions,
    };

    await new Promise<void>((resolve, reject) => {
      this.dbConnection!.run(
        sql,
        [
          discussion.id,
          discussion.projectId || null,
          discussion.plotId || null,
          discussion.topic,
          discussion.status,
          discussion.id, // thread_idとして使用
          JSON.stringify(discussion.participants),
          JSON.stringify(metadata),
          discussion.startTime.toISOString(),
          new Date().toISOString()
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // メッセージも保存
    for (const message of discussion.messages) {
      await this.saveMessageToDatabase(discussion.id, message);
    }
  }

  /**
   * メッセージをデータベースに保存
   */
  private async saveMessageToDatabase(
    discussionId: string,
    message: AgentMessage
  ): Promise<void> {
    if (!this.dbConnection) return;

    const sql = `
      INSERT INTO agent_messages (
        id, discussion_id, agent_role, agent_name, message,
        message_type, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const agentRole = message.agentId.split('-')[0];
    const agent = Array.from(this.agents.values()).find(a => a.getId() === message.agentId);

    await new Promise<void>((resolve, reject) => {
      this.dbConnection!.run(
        sql,
        [
          message.id,
          discussionId,
          agentRole,
          agent?.getName() || agentRole,
          message.content,
          'text',
          JSON.stringify(message.metadata || {}),
          message.timestamp.toISOString()
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 議論を一時停止
   */
  pauseDiscussion(): void {
    if (this.currentDiscussionId) {
      const discussion = this.discussions.get(this.currentDiscussionId);
      if (discussion && discussion.status === 'active') {
        discussion.status = 'paused';
        this.isRunning = false;
        this.emit('discussionPaused', { discussionId: this.currentDiscussionId });
      }
    }
  }

  /**
   * 議論を再開
   */
  async resumeDiscussion(): Promise<void> {
    if (this.currentDiscussionId) {
      const discussion = this.discussions.get(this.currentDiscussionId);
      if (discussion && discussion.status === 'paused') {
        discussion.status = 'active';
        this.isRunning = true;
        this.emit('discussionResumed', { discussionId: this.currentDiscussionId });
        
        // 議論を続行
        await this.runDiscussion(this.currentDiscussionId);
      }
    }
  }

  /**
   * 人間の介入を追加
   */
  async addHumanIntervention(content: string): Promise<void> {
    if (!this.currentDiscussionId) return;

    const discussion = this.discussions.get(this.currentDiscussionId);
    if (!discussion) return;

    const message: AgentMessage = {
      id: uuidv4(),
      agentId: 'human-editor',
      timestamp: new Date(),
      content,
      metadata: {
        emotionalTone: 'authoritative',
      },
    };

    discussion.messages.push(message);

    this.emit('humanIntervention', {
      discussionId: this.currentDiscussionId,
      message,
    });
  }

  /**
   * 議論の取得
   */
  getDiscussion(discussionId: string): Discussion | undefined {
    return this.discussions.get(discussionId);
  }

  /**
   * アクティブな議論の取得
   */
  getActiveDiscussion(): Discussion | undefined {
    return this.currentDiscussionId ? 
      this.discussions.get(this.currentDiscussionId) : 
      undefined;
  }

  /**
   * エージェントの取得
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * エージェントの一覧取得
   */
  getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Perform message summarization
   */
  private async performSummarization(
    discussion: Discussion,
    context: DiscussionContext
  ): Promise<void> {
    try {
      this.emit('summarizationStarted', { discussionId: discussion.id });

      // Summarize messages
      const result = await this.messageSummarizer.summarizeMessages(
        discussion.messages,
        discussion.topic,
        true // Preserve recent messages
      );

      // Store the summary
      discussion.summaries.push(result.summary);

      // Create summary message for the discussion
      const summaryMessage = this.messageSummarizer.createSummaryMessage(result.summary);
      
      // Replace old messages with summary and preserved messages
      discussion.messages = [summaryMessage, ...result.preservedMessages];
      context.previousMessages = [...discussion.messages];

      // Log summarization event
      this.emit('summarizationCompleted', {
        discussionId: discussion.id,
        summarizedCount: result.summarizedMessages.length,
        preservedCount: result.preservedMessages.length,
        summaryTokens: result.summary.tokenCount,
      });

      // Log the event with metadata
      if (discussion.metadata) {
        discussion.metadata.summarizationCount = (discussion.metadata.summarizationCount || 0) + 1;
        discussion.metadata.lastSummarization = new Date().toISOString();
      }

    } catch (error) {
      this.emit('summarizationError', {
        discussionId: discussion.id,
        error,
      });
      // Continue discussion even if summarization fails
      console.error('Summarization failed, continuing discussion:', error);
    }
  }

  /**
   * Get token usage statistics for current discussion
   */
  getTokenUsageStats(): {
    currentTokens: number;
    maxTokens: number;
    usagePercentage: number;
    model: string;
  } | null {
    const discussion = this.getActiveDiscussion();
    if (!discussion) return null;

    const messages = discussion.messages.map(m => ({
      role: 'assistant',
      content: m.content,
    }));

    const model = 'gpt-4-turbo-preview';
    const currentTokens = TokenCounter.countMessagesTokens(messages);
    const limits = TokenCounter.getModelLimits(model);
    
    if (!limits) return null;

    return {
      currentTokens,
      maxTokens: limits.maxContextTokens,
      usagePercentage: (currentTokens / limits.maxContextTokens) * 100,
      model,
    };
  }

  /**
   * Get summarization configuration
   */
  getSummarizationConfig(): SummarizationConfig {
    return this.messageSummarizer.getConfig();
  }

  /**
   * Update summarization configuration
   */
  updateSummarizationConfig(config: Partial<SummarizationConfig>): void {
    this.messageSummarizer.updateConfig(config);
  }
}