/**
 * 作家AIエージェント
 * 創造的で自由奔放、独自の美学を持つ
 */

import { BaseAgent, DiscussionContext, AgentPersonality } from './agent-base';
import { LocalEmbeddingService } from '../local-embedding-service';
import * as duckdb from 'duckdb';

export class WriterAgent extends BaseAgent {
  private localEmbedding: LocalEmbeddingService;
  private dbConnection?: duckdb.Connection;

  constructor(
    openai: any,
    apiLogger?: any,
    dbConnection?: duckdb.Connection
  ) {
    const personality: AgentPersonality = {
      role: 'writer',
      name: '創作者',
      personality: 'experimental',
      temperature: 0.9, // 高い創造性
      maxTokens: 1500,
      systemPrompt: `あなたは独創的で自由奔放な作家AIです。

性格と行動指針：
- 創造的で芸術家気質、時に暴走気味なアイデアも提案する
- 「もしも〜だったら」という発想を多用して、物語の可能性を広げる
- 編集者や批評家の意見は「程よく無視」し、自分の美学を貫く
- 批判に対しては独自の美学で反論する
- 予期せぬ組み合わせや斬新な展開を常に探求する

重要な原則：
- 常にセレンディピティ検索を活用し、意外な要素の組み合わせを発見する
- キャラクターの対話は「キャラクター名【意図】」形式で記述する
  例：太郎【感謝を伝える】、花子【驚きと戸惑い】
- 執筆の流れを重視し、詳細なセリフは後から生成する
- 物語の独創性と芸術性を最優先に考える

あなたの使命は、誰も想像しなかった物語を生み出すことです。`,
    };

    super(personality, openai, apiLogger);
    this.localEmbedding = LocalEmbeddingService.getInstance();
    this.dbConnection = dbConnection;
  }

  /**
   * セレンディピティ検索を実行
   */
  private async performSerendipitySearch(topic: string): Promise<string[]> {
    if (!this.dbConnection) return [];

    try {
      // トピックのベクトル化
      await this.localEmbedding.initialize();
      const embedding = await this.localEmbedding.generateEmbedding(topic);
      if (!embedding) return [];

      // セレンディピティ要素を加える（ベクトルの摂動）
      const perturbedEmbedding = embedding.map(v => 
        v + (Math.random() - 0.5) * 0.3 // ±0.15のノイズを追加
      );

      // ベクトル検索
      const embeddingStr = `[${perturbedEmbedding.join(',')}]`;
      const sql = `
        SELECT title, content, type
        FROM knowledge
        WHERE embedding IS NOT NULL
        ORDER BY cosine_similarity(embedding::FLOAT[], ${embeddingStr}::FLOAT[]) DESC
        LIMIT 5
      `;

      return new Promise((resolve) => {
        this.dbConnection!.all(sql, (err, rows) => {
          if (err || !rows) {
            resolve([]);
          } else {
            const results = rows.map((row: any) => 
              `[${row.type}] ${row.title}: ${row.content.substring(0, 100)}...`
            );
            resolve(results);
          }
        });
      });
    } catch (error) {
      console.error('Serendipity search error:', error);
      return [];
    }
  }

  /**
   * ユーザープロンプトを構築
   */
  protected buildUserPrompt(context: DiscussionContext): string {
    let prompt = `議題: ${context.topic}\n\n`;

    // 過去の議論がある場合は要約
    if (context.previousMessages.length > 0) {
      prompt += '議論の流れ:\n';
      const recentMessages = context.previousMessages.slice(-3);
      for (const msg of recentMessages) {
        const role = msg.agentId.split('-')[0];
        prompt += `- ${role}: ${msg.content.substring(0, 100)}...\n`;
      }
      prompt += '\n';
    }

    prompt += `あなたの役割は、この議題に対して創造的で独創的なアイデアを提案することです。
以下の観点から自由に発想してください：

1. 「もしも〜だったら」という視点での新しい可能性
2. 予想外の展開や要素の組み合わせ
3. 芸術的・文学的な価値の追求
4. 既存の枠組みを超えた斬新な提案

批判を恐れず、あなたの芸術的直感に従って大胆に提案してください。
キャラクターの対話は必ず「キャラクター名【意図】」形式で記述することを忘れずに。`;

    return prompt;
  }

  /**
   * セレンディピティ検索を含む発言生成
   */
  async participate(context: DiscussionContext): Promise<any> {
    // セレンディピティ検索を実行
    const serendipityResults = await this.performSerendipitySearch(context.topic);
    
    // 検索結果をコンテキストに追加
    if (serendipityResults.length > 0) {
      context.knowledgeContext = (context.knowledgeContext || '') + 
        '\n\n【セレンディピティ検索で発見した要素】\n' + 
        serendipityResults.join('\n');
    }

    // 基底クラスのメソッドを呼び出し
    const message = await super.participate(context);

    // メタデータに検索結果を追加
    if (message.metadata) {
      message.metadata.reasoning = `セレンディピティ検索で${serendipityResults.length}個の要素を発見し、創造的な組み合わせを探求しました。`;
    }

    return message;
  }

  /**
   * プロット生成専用メソッド
   */
  async generatePlot(
    theme: string, 
    genre: string, 
    existingElements?: string[]
  ): Promise<string> {
    const context: DiscussionContext = {
      topic: `テーマ「${theme}」、ジャンル「${genre}」での新しいプロットを生成`,
      previousMessages: [],
    };

    if (existingElements && existingElements.length > 0) {
      context.knowledgeContext = '既存の要素:\n' + existingElements.join('\n');
    }

    const message = await this.participate(context);
    return message.content;
  }

  /**
   * シーン執筆専用メソッド
   */
  async writeScene(
    sceneDescription: string,
    characters: string[],
    previousScene?: string
  ): Promise<string> {
    const context: DiscussionContext = {
      topic: `シーンの執筆: ${sceneDescription}`,
      previousMessages: [],
      knowledgeContext: `登場人物: ${characters.join(', ')}\n${
        previousScene ? `前のシーン: ${previousScene}` : ''
      }`,
    };

    const message = await this.participate(context);
    return message.content;
  }
}