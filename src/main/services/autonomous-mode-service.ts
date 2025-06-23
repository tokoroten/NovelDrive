import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as duckdb from 'duckdb';
import { MultiAgentOrchestrator } from './multi-agent-system';
import { performSerendipitySearch } from './serendipity-search';

/**
 * 24時間自律モードの設定
 */
export interface AutonomousModeConfig {
  enabled: boolean;
  projectId: string;
  schedule: {
    writingInterval: number; // 執筆間隔（分）
    ideaGenerationInterval: number; // アイデア生成間隔（分）
    discussionInterval: number; // 議論間隔（分）
  };
  quality: {
    minQualityScore: number; // 最小品質スコア（0-100）
    autoSaveThreshold: number; // 自動保存閾値
    requireHumanApproval: boolean; // 人間の承認が必要か
  };
  limits: {
    maxChaptersPerDay: number; // 1日の最大章数
    maxWordsPerSession: number; // 1セッションの最大文字数
    maxTokensPerDay: number; // 1日の最大トークン数
  };
}

/**
 * 自律モードの活動ログ
 */
export interface AutonomousActivity {
  id: string;
  timestamp: string;
  type: 'idea_generation' | 'plot_development' | 'chapter_writing' | 'discussion' | 'quality_check';
  projectId: string;
  status: 'success' | 'failed' | 'pending_approval';
  content: any;
  qualityScore?: number;
  tokensUsed?: number;
  error?: string;
}

/**
 * 24時間自律モードサービス
 */
export class AutonomousModeService extends EventEmitter {
  private static instance: AutonomousModeService;
  private config: AutonomousModeConfig;
  private isRunning: boolean = false;
  private orchestrator: MultiAgentOrchestrator;
  private conn: duckdb.Connection;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private dailyTokenUsage: number = 0;
  private lastResetDate: string;

  private constructor(conn: duckdb.Connection) {
    super();
    this.conn = conn;
    this.orchestrator = new MultiAgentOrchestrator(conn);
    this.lastResetDate = new Date().toISOString().split('T')[0];
    
    // デフォルト設定
    this.config = {
      enabled: false,
      projectId: '',
      schedule: {
        writingInterval: 120, // 2時間ごと
        ideaGenerationInterval: 60, // 1時間ごと
        discussionInterval: 180, // 3時間ごと
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

  static getInstance(conn: duckdb.Connection): AutonomousModeService {
    if (!AutonomousModeService.instance) {
      AutonomousModeService.instance = new AutonomousModeService(conn);
    }
    return AutonomousModeService.instance;
  }

  /**
   * 設定を更新
   */
  async updateConfig(config: Partial<AutonomousModeConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // 設定をデータベースに保存
    await this.saveConfig();
    
    // 実行中の場合は再スケジュール
    if (this.isRunning) {
      this.stop();
      await this.start();
    }
    
    this.emit('configUpdated', this.config);
  }

  /**
   * 自律モードを開始
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.emit('started');

    // 各タスクをスケジュール
    this.scheduleTask('writing', this.config.schedule.writingInterval);
    this.scheduleTask('ideaGeneration', this.config.schedule.ideaGenerationInterval);
    this.scheduleTask('discussion', this.config.schedule.discussionInterval);

    // 日次リセットをスケジュール
    this.scheduleDailyReset();

    this.logActivity({
      type: 'idea_generation',
      status: 'success',
      content: { message: '24時間自律モードを開始しました' },
    });
  }

  /**
   * 自律モードを停止
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // すべてのタイマーをクリア
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
    
    this.emit('stopped');
  }

  /**
   * タスクをスケジュール
   */
  private scheduleTask(taskType: string, intervalMinutes: number): void {
    const timer = setInterval(async () => {
      if (!this.checkTokenLimit()) {
        return;
      }

      try {
        switch (taskType) {
          case 'writing':
            await this.performWritingSession();
            break;
          case 'ideaGeneration':
            await this.performIdeaGeneration();
            break;
          case 'discussion':
            await this.performDiscussion();
            break;
        }
      } catch (error) {
        console.error(`Autonomous task failed: ${taskType}`, error);
        this.logActivity({
          type: taskType as any,
          status: 'failed',
          content: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    }, intervalMinutes * 60 * 1000);

    this.timers.set(taskType, timer);
  }

  /**
   * 執筆セッションを実行
   */
  private async performWritingSession(): Promise<void> {
    const chaptersToday = await this.getChaptersWrittenToday();
    if (chaptersToday >= this.config.limits.maxChaptersPerDay) {
      return;
    }

    // 最新のプロットを取得
    const plot = await this.getLatestPlot();
    if (!plot) {
      return;
    }

    // 執筆するチャプターを決定
    const nextChapter = await this.determineNextChapter(plot.id);
    if (!nextChapter) {
      return;
    }

    // セレンディピティ検索でインスピレーションを取得
    const inspirations = await performSerendipitySearch(this.conn, nextChapter.title, {
      projectId: this.config.projectId,
      limit: 10,
      serendipityLevel: 0.7,
    });

    // マルチエージェントで執筆
    const agents = await this.createWritingAgents();
    const writingSession = await this.orchestrator.startDiscussion(
      `${nextChapter.title}の執筆`,
      agents,
      {
        projectId: this.config.projectId,
        maxRounds: 3,
      }
    );

    // 品質評価
    const qualityScore = await this.evaluateContent(writingSession.summary || '');
    
    const activity: Partial<AutonomousActivity> = {
      type: 'chapter_writing',
      content: {
        chapterId: nextChapter.id,
        sessionId: writingSession.id,
        content: writingSession.summary,
        wordCount: writingSession.summary?.length || 0,
      },
      qualityScore,
      tokensUsed: this.estimateTokens(writingSession),
    };

    if (qualityScore >= this.config.quality.minQualityScore) {
      if (qualityScore >= this.config.quality.autoSaveThreshold && !this.config.quality.requireHumanApproval) {
        // 自動保存
        await this.saveChapterContent(nextChapter.id, writingSession.summary || '');
        activity.status = 'success';
      } else {
        // 人間の承認待ち
        activity.status = 'pending_approval';
      }
    } else {
      activity.status = 'failed';
    }

    this.logActivity(activity as AutonomousActivity);
    this.dailyTokenUsage += activity.tokensUsed || 0;
  }

  /**
   * アイデア生成セッションを実行
   */
  private async performIdeaGeneration(): Promise<void> {
    // ランダムなキーワードでセレンディピティ検索
    const randomKeywords = await this.getRandomKeywords();
    const searchResults = await performSerendipitySearch(this.conn, randomKeywords.join(' '), {
      projectId: this.config.projectId,
      limit: 20,
      serendipityLevel: 0.9, // 高いセレンディピティレベル
    });

    // アイデア生成エージェントを作成
    const agents = await this.createIdeaGenerationAgents();
    const ideaSession = await this.orchestrator.startDiscussion(
      '新しいプロットアイデアの探索',
      agents,
      {
        projectId: this.config.projectId,
        maxRounds: 2,
      }
    );

    const activity: AutonomousActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'idea_generation',
      projectId: this.config.projectId,
      status: 'success',
      content: {
        keywords: randomKeywords,
        ideas: ideaSession.summary,
        searchResults: searchResults.map(r => ({ id: r.id, title: r.title })),
      },
      tokensUsed: this.estimateTokens(ideaSession),
    };

    this.logActivity(activity);
    this.dailyTokenUsage += activity.tokensUsed || 0;
  }

  /**
   * 議論セッションを実行
   */
  private async performDiscussion(): Promise<void> {
    // 最近の活動から議論トピックを決定
    const recentActivities = await this.getRecentActivities();
    const discussionTopic = this.generateDiscussionTopic(recentActivities);

    // 議論エージェントを作成
    const agents = await this.createDiscussionAgents();
    const discussionSession = await this.orchestrator.startDiscussion(
      discussionTopic,
      agents,
      {
        projectId: this.config.projectId,
        maxRounds: 4,
      }
    );

    const activity: AutonomousActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'discussion',
      projectId: this.config.projectId,
      status: 'success',
      content: {
        topic: discussionTopic,
        summary: discussionSession.summary,
        decisions: discussionSession.decisions,
      },
      tokensUsed: this.estimateTokens(discussionSession),
    };

    this.logActivity(activity);
    this.dailyTokenUsage += activity.tokensUsed || 0;
  }

  /**
   * 執筆用エージェントを作成
   */
  private async createWritingAgents() {
    return [
      await this.orchestrator.createAgent('writer', 'experimental', {
        name: '深夜の作家AI',
        temperature: 0.8,
      }),
      await this.orchestrator.createAgent('editor', 'logical', {
        name: '夜間編集AI',
        temperature: 0.5,
      }),
    ];
  }

  /**
   * アイデア生成用エージェントを作成
   */
  private async createIdeaGenerationAgents() {
    return [
      await this.orchestrator.createAgent('writer', 'experimental', {
        name: '夢見る作家AI',
        temperature: 0.9,
      }),
      await this.orchestrator.createAgent('writer', 'emotional', {
        name: '感性作家AI',
        temperature: 0.8,
      }),
    ];
  }

  /**
   * 議論用エージェントを作成
   */
  private async createDiscussionAgents() {
    return [
      await this.orchestrator.createAgent('deputy_editor', 'logical'),
      await this.orchestrator.createAgent('editor', 'commercial'),
      await this.orchestrator.createAgent('proofreader', 'traditional'),
    ];
  }

  /**
   * コンテンツの品質を評価
   */
  private async evaluateContent(content: string): Promise<number> {
    // 簡易的な品質評価
    let score = 50; // 基本スコア

    // 文字数
    if (content.length > 1000) score += 10;
    if (content.length > 3000) score += 10;

    // 段落数
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 3) score += 10;

    // 会話文の存在
    if (content.includes('「') && content.includes('」')) score += 10;

    // 描写の豊かさ（形容詞的表現）
    const descriptivePatterns = ['ような', 'ように', 'まるで', 'あたかも'];
    const descriptiveCount = descriptivePatterns.filter(p => content.includes(p)).length;
    score += descriptiveCount * 5;

    return Math.min(100, score);
  }

  /**
   * トークン数を推定
   */
  private estimateTokens(session: any): number {
    // 簡易的なトークン推定（日本語は1文字≒2トークン）
    const totalText = session.messages?.reduce((acc: string, msg: any) => acc + msg.content, '') || '';
    return Math.floor(totalText.length * 2);
  }

  /**
   * トークン制限をチェック
   */
  private checkTokenLimit(): boolean {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailyTokenUsage = 0;
      this.lastResetDate = today;
    }

    return this.dailyTokenUsage < this.config.limits.maxTokensPerDay;
  }

  /**
   * 日次リセットをスケジュール
   */
  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.dailyTokenUsage = 0;
      this.emit('dailyReset');
      
      // 次の日のリセットをスケジュール
      this.scheduleDailyReset();
    }, msUntilMidnight);
  }

  /**
   * 最新のプロットを取得
   */
  private async getLatestPlot(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT * FROM plots 
         WHERE project_id = ? AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [this.config.projectId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }

  /**
   * 次に執筆する章を決定
   */
  private async determineNextChapter(plotId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT * FROM chapters 
         WHERE plot_id = ? AND status IN ('draft', 'writing')
         ORDER BY "order" ASC LIMIT 1`,
        [plotId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }

  /**
   * 今日書いた章数を取得
   */
  private async getChaptersWrittenToday(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT COUNT(*) as count FROM autonomous_activities 
         WHERE type = 'chapter_writing' 
         AND status = 'success'
         AND DATE(timestamp) = ?`,
        [today],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows[0]?.count || 0);
        }
      );
    });
  }

  /**
   * ランダムなキーワードを取得
   */
  private async getRandomKeywords(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT title FROM knowledge 
         WHERE project_id = ? 
         ORDER BY RANDOM() LIMIT 5`,
        [this.config.projectId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.title));
        }
      );
    });
  }

  /**
   * 最近の活動を取得
   */
  private async getRecentActivities(): Promise<AutonomousActivity[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        `SELECT * FROM autonomous_activities 
         WHERE project_id = ? 
         ORDER BY timestamp DESC LIMIT 10`,
        [this.config.projectId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => ({
            ...r,
            content: JSON.parse(r.content || '{}'),
          })));
        }
      );
    });
  }

  /**
   * 議論トピックを生成
   */
  private generateDiscussionTopic(activities: AutonomousActivity[]): string {
    const recentWriting = activities.find(a => a.type === 'chapter_writing');
    if (recentWriting) {
      return `最近執筆した章の改善点について`;
    }

    const recentIdeas = activities.filter(a => a.type === 'idea_generation');
    if (recentIdeas.length > 0) {
      return `新しいアイデアの実現可能性について`;
    }

    return `物語全体の方向性について`;
  }

  /**
   * 章の内容を保存
   */
  private async saveChapterContent(chapterId: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(
        `UPDATE chapters 
         SET content = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [content, chapterId],
        (err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        }
      );
    });
  }

  /**
   * 活動をログに記録
   */
  private async logActivity(activity: Partial<AutonomousActivity>): Promise<void> {
    const fullActivity: AutonomousActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      projectId: this.config.projectId,
      ...activity,
    } as AutonomousActivity;

    await new Promise((resolve, reject) => {
      this.conn.run(
        `INSERT INTO autonomous_activities 
         (id, timestamp, type, project_id, status, content, quality_score, tokens_used, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullActivity.id,
          fullActivity.timestamp,
          fullActivity.type,
          fullActivity.projectId,
          fullActivity.status,
          JSON.stringify(fullActivity.content),
          fullActivity.qualityScore,
          fullActivity.tokensUsed,
          fullActivity.error,
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        }
      );
    });

    this.emit('activity', fullActivity);
  }

  /**
   * 設定を保存
   */
  private async saveConfig(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(
        `INSERT OR REPLACE INTO autonomous_config 
         (project_id, config, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [this.config.projectId, JSON.stringify(this.config)],
        (err: any) => {
          if (err) reject(err);
          else resolve(undefined);
        }
      );
    });
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): AutonomousModeConfig {
    return { ...this.config };
  }

  /**
   * 実行状態を取得
   */
  getStatus(): {
    isRunning: boolean;
    config: AutonomousModeConfig;
    dailyTokenUsage: number;
    tokenLimitRemaining: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.getConfig(),
      dailyTokenUsage: this.dailyTokenUsage,
      tokenLimitRemaining: this.config.limits.maxTokensPerDay - this.dailyTokenUsage,
    };
  }
}