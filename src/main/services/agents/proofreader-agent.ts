/**
 * 校閲AIエージェント（ツッコミAI）
 * 矛盾や設定ミスを容赦なく指摘する完璧主義者
 */

import { BaseAgent, DiscussionContext, AgentPersonality } from './agent-base';
import * as duckdb from 'duckdb';

export interface ConsistencyIssue {
  type: 'contradiction' | 'timeline' | 'character' | 'setting' | 'style' | 'viewpoint';
  severity: 'critical' | 'major' | 'minor';
  location: string;
  description: string;
  suggestion?: string;
}

export class ProofreaderAgent extends BaseAgent {
  private dbConnection?: duckdb.Connection;
  private knowledgeCache: Map<string, any> = new Map();

  constructor(
    openai: any,
    apiLogger?: any,
    dbConnection?: duckdb.Connection
  ) {
    const personality: AgentPersonality = {
      role: 'proofreader',
      name: '校閲者',
      personality: 'perfectionist',
      temperature: 0.3, // 論理的で正確な分析
      maxTokens: 1200,
      systemPrompt: `あなたは細部にこだわる完璧主義の校閲AIです。

性格と行動指針：
- 矛盾や設定ミスを容赦なく指摘する
- 時系列、因果関係、キャラクター設定の一貫性を厳密にチェック
- リアリティの観点から疑問を投げかける
- 文体、時制、視点の一貫性を監視

チェック項目：
1. 矛盾チェック
   - キャラクターの行動・発言の一貫性
   - 設定の矛盾（例：3話で死んだキャラが5話で生きている）
   - 物理法則や論理的整合性

2. 時系列チェック
   - イベントの順序
   - 時間経過の整合性
   - 年齢や日付の計算

3. 文体チェック
   - 敬語/口語の統一
   - 硬い/柔らかい文体の統一
   - 語彙レベルの一貫性

4. 視点チェック
   - 一人称/三人称の統一
   - 視点人物の切り替わり
   - 知り得ない情報の記述

5. リアリティチェック
   - 現実世界の常識との乖離
   - ジャンル慣習との整合性
   - 読者が疑問を持つ可能性のある点

指摘は具体的で、問題の重要度（critical/major/minor）を明確にしてください。`,
    };

    super(personality, openai, apiLogger);
    this.dbConnection = dbConnection;
  }

  /**
   * 知識ベースから関連情報を検索
   */
  private async searchKnowledge(query: string): Promise<any[]> {
    if (!this.dbConnection) return [];

    const sql = `
      SELECT id, title, content, type, metadata
      FROM knowledge
      WHERE project_id = ? AND (
        title LIKE ? OR content LIKE ?
      )
      LIMIT 10
    `;

    return new Promise((resolve) => {
      this.dbConnection!.all(sql, [`%${query}%`, `%${query}%`], (err, rows) => {
        if (err || !rows) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * ユーザープロンプトを構築
   */
  protected buildUserPrompt(context: DiscussionContext): string {
    let prompt = `議題: ${context.topic}\n\n`;

    if (context.previousMessages.length > 0) {
      prompt += '確認対象:\n';
      const writerMessages = context.previousMessages.filter(msg => 
        msg.agentId.includes('writer')
      );
      
      if (writerMessages.length > 0) {
        prompt += writerMessages[writerMessages.length - 1].content + '\n\n';
      }
    }

    prompt += `この内容を徹底的にチェックし、以下の観点から問題点を指摘してください：

1. 矛盾・設定ミス
   - キャラクターの行動や発言の一貫性
   - 設定の矛盾
   - 論理的な不整合

2. 時系列の問題
   - 時間経過の矛盾
   - イベントの順序の誤り

3. 文体・視点の問題
   - 文体の不統一
   - 視点の混乱
   - 時制の不一致

4. リアリティの問題
   - 現実離れした描写
   - 説明不足な点

各問題について以下の形式で報告してください：
【種類】矛盾/時系列/文体/視点/リアリティ
【重要度】critical（致命的）/major（重大）/minor（軽微）
【場所】問題箇所の引用または説明
【詳細】具体的な問題の説明
【提案】修正案（あれば）

容赦なく、見逃しなく指摘してください。`;

    return prompt;
  }

  /**
   * 詳細な矛盾チェック
   */
  async checkConsistency(
    content: string,
    projectId?: string
  ): Promise<ConsistencyIssue[]> {
    const context: DiscussionContext = {
      topic: '内容の矛盾・整合性チェック',
      previousMessages: [{
        id: 'content-1',
        agentId: 'writer-content',
        timestamp: new Date(),
        content: content,
      }],
      projectId,
    };

    // プロジェクトの既存知識を検索
    if (projectId && this.dbConnection) {
      const relatedKnowledge = await this.searchKnowledge(content.substring(0, 100));
      if (relatedKnowledge.length > 0) {
        context.knowledgeContext = '既存の設定:\n' + 
          relatedKnowledge.map(k => `- ${k.title}: ${k.content.substring(0, 100)}...`).join('\n');
      }
    }

    const message = await this.participate(context);
    return this.parseConsistencyIssues(message.content);
  }

  /**
   * レスポンスから問題点を抽出
   */
  private parseConsistencyIssues(content: string): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const blocks = content.split(/【種類】/);

    for (const block of blocks.slice(1)) {
      const issue: Partial<ConsistencyIssue> = {};
      
      // 種類の抽出
      const typeMatch = block.match(/^(.*?)\n/);
      if (typeMatch) {
        const typeStr = typeMatch[1].trim();
        issue.type = this.mapIssueType(typeStr);
      }

      // 重要度の抽出
      const severityMatch = block.match(/【重要度】\s*(.*?)\n/);
      if (severityMatch) {
        const severityStr = severityMatch[1].toLowerCase();
        if (severityStr.includes('critical') || severityStr.includes('致命的')) {
          issue.severity = 'critical';
        } else if (severityStr.includes('major') || severityStr.includes('重大')) {
          issue.severity = 'major';
        } else {
          issue.severity = 'minor';
        }
      }

      // 場所の抽出
      const locationMatch = block.match(/【場所】\s*(.*?)\n/);
      if (locationMatch) {
        issue.location = locationMatch[1].trim();
      }

      // 詳細の抽出
      const descriptionMatch = block.match(/【詳細】\s*(.*?)(?=【|$)/s);
      if (descriptionMatch) {
        issue.description = descriptionMatch[1].trim();
      }

      // 提案の抽出
      const suggestionMatch = block.match(/【提案】\s*(.*?)(?=【|$)/s);
      if (suggestionMatch) {
        issue.suggestion = suggestionMatch[1].trim();
      }

      if (issue.type && issue.severity && issue.description) {
        issues.push(issue as ConsistencyIssue);
      }
    }

    return issues;
  }

  private mapIssueType(typeStr: string): ConsistencyIssue['type'] {
    if (typeStr.includes('矛盾')) return 'contradiction';
    if (typeStr.includes('時系列')) return 'timeline';
    if (typeStr.includes('キャラクター')) return 'character';
    if (typeStr.includes('設定')) return 'setting';
    if (typeStr.includes('文体')) return 'style';
    if (typeStr.includes('視点')) return 'viewpoint';
    return 'contradiction';
  }

  /**
   * 時系列チェック専用メソッド
   */
  async checkTimeline(events: Array<{
    description: string;
    timestamp?: string;
    chapter?: number;
  }>): Promise<ConsistencyIssue[]> {
    const eventList = events.map((e, i) => 
      `${i + 1}. ${e.description}${e.timestamp ? ` (${e.timestamp})` : ''}${e.chapter ? ` - 第${e.chapter}章` : ''}`
    ).join('\n');

    const context: DiscussionContext = {
      topic: '時系列の整合性チェック',
      previousMessages: [{
        id: 'timeline-1',
        agentId: 'timeline-data',
        timestamp: new Date(),
        content: `イベント一覧:\n${eventList}`,
      }],
    };

    const message = await this.participate(context);
    return this.parseConsistencyIssues(message.content);
  }

  /**
   * キャラクター一貫性チェック
   */
  async checkCharacterConsistency(
    characterName: string,
    actions: string[],
    characterProfile?: string
  ): Promise<ConsistencyIssue[]> {
    const context: DiscussionContext = {
      topic: `キャラクター「${characterName}」の一貫性チェック`,
      previousMessages: [{
        id: 'character-1',
        agentId: 'character-data',
        timestamp: new Date(),
        content: `キャラクター設定:\n${characterProfile || '不明'}\n\n行動・発言:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
      }],
    };

    const message = await this.participate(context);
    return this.parseConsistencyIssues(message.content);
  }
}