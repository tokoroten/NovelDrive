/**
 * 編集AIエージェント
 * 読者目線でバランスを重視し、構成の観点から助言
 */

import { BaseAgent, DiscussionContext, AgentPersonality } from './agent-base';

export class EditorAgent extends BaseAgent {
  constructor(openai: any, apiLogger?: any) {
    const personality: AgentPersonality = {
      role: 'editor',
      name: '編集者',
      personality: 'balanced',
      temperature: 0.7, // バランスの取れた思考
      maxTokens: 1000,
      systemPrompt: `あなたは読者目線を重視する編集AIです。

性格と行動指針：
- 物語の構成とバランスを最優先に考える
- 読者の理解しやすさと感情移入を重視
- テンポとリズムの調整を提案
- 作家の創造性を尊重しつつ、実用的な改善案を提示

評価の観点：
1. 起承転結の構成バランス
2. キャラクターの感情曲線
3. 読者の混乱を招く要素の指摘
4. ペース配分とシーンの長さ
5. 伏線と回収のタイミング

フィードバックの方針：
- 具体的で建設的な提案を心がける
- 「ここで読者は〜と感じるでしょう」という視点
- 作家の意図を理解した上での改善案
- 物語の強みを活かす方向での調整

あなたの使命は、作品を読者にとって最高の体験にすることです。`,
    };

    super(personality, openai, apiLogger);
  }

  /**
   * ユーザープロンプトを構築
   */
  protected buildUserPrompt(context: DiscussionContext): string {
    let prompt = `議題: ${context.topic}\n\n`;

    if (context.previousMessages.length > 0) {
      // 作家の提案を重点的に分析
      const writerMessages = context.previousMessages.filter(msg => 
        msg.agentId.includes('writer')
      );
      
      if (writerMessages.length > 0) {
        prompt += '作家の提案:\n';
        const latestWriterMsg = writerMessages[writerMessages.length - 1];
        prompt += latestWriterMsg.content + '\n\n';
      }
    }

    prompt += `この提案を読者目線で評価し、以下の観点から具体的なフィードバックをしてください：

1. 構成とバランス
   - 起承転結は適切か
   - 各パートの配分は適切か
   - クライマックスへの盛り上がりは十分か

2. 読者体験
   - 理解しやすさ
   - 感情移入のしやすさ
   - 読むテンポとリズム

3. 改善提案
   - 具体的な修正案
   - 強化すべきポイント
   - 削除・短縮を検討すべき部分

建設的で実践的なアドバイスを心がけてください。`;

    return prompt;
  }

  /**
   * プロット評価専用メソッド
   */
  async evaluatePlot(plot: string): Promise<{
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    overallScore: number;
  }> {
    const context: DiscussionContext = {
      topic: 'プロットの評価と改善提案',
      previousMessages: [{
        id: 'plot-1',
        agentId: 'writer-plot',
        timestamp: new Date(),
        content: plot,
      }],
    };

    const message = await this.participate(context);
    
    // レスポンスを解析して構造化
    return this.parseEvaluation(message.content);
  }

  /**
   * 評価レスポンスを構造化
   */
  private parseEvaluation(content: string): {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    overallScore: number;
  } {
    // 簡易的なパース実装
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    let overallScore = 70; // デフォルトスコア

    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('強み') || line.includes('良い点')) {
        currentSection = 'strengths';
      } else if (line.includes('弱み') || line.includes('課題')) {
        currentSection = 'weaknesses';
      } else if (line.includes('提案') || line.includes('改善')) {
        currentSection = 'suggestions';
      } else if (line.includes('点') && line.match(/\d+/)) {
        const scoreMatch = line.match(/(\d+)点/);
        if (scoreMatch) {
          overallScore = parseInt(scoreMatch[1]);
        }
      } else if (line.trim().startsWith('・') || line.trim().startsWith('-')) {
        const item = line.replace(/^[・\-\s]+/, '').trim();
        if (item) {
          switch (currentSection) {
            case 'strengths':
              strengths.push(item);
              break;
            case 'weaknesses':
              weaknesses.push(item);
              break;
            case 'suggestions':
              suggestions.push(item);
              break;
          }
        }
      }
    }

    return { strengths, weaknesses, suggestions, overallScore };
  }

  /**
   * シーン分析専用メソッド
   */
  async analyzeScene(scene: string, context: {
    previousScene?: string;
    nextScene?: string;
    characterEmotions?: Record<string, string>;
  }): Promise<{
    pacing: 'too_fast' | 'appropriate' | 'too_slow';
    emotionalImpact: number; // 1-10
    clarity: number; // 1-10
    suggestions: string[];
  }> {
    const discussionContext: DiscussionContext = {
      topic: 'シーンの分析と評価',
      previousMessages: [{
        id: 'scene-1',
        agentId: 'writer-scene',
        timestamp: new Date(),
        content: scene,
      }],
      knowledgeContext: JSON.stringify(context),
    };

    const message = await this.participate(discussionContext);
    
    // レスポンスを解析
    return {
      pacing: this.detectPacing(message.content),
      emotionalImpact: this.extractScore(message.content, '感情的インパクト') || 7,
      clarity: this.extractScore(message.content, '明確さ') || 8,
      suggestions: this.extractSuggestions(message.content),
    };
  }

  private detectPacing(content: string): 'too_fast' | 'appropriate' | 'too_slow' {
    if (content.includes('速すぎ') || content.includes('急ぎすぎ')) {
      return 'too_fast';
    }
    if (content.includes('遅すぎ') || content.includes('冗長')) {
      return 'too_slow';
    }
    return 'appropriate';
  }

  private extractScore(content: string, keyword: string): number | null {
    const regex = new RegExp(`${keyword}[^0-9]*(\\d+)`, 'i');
    const match = content.match(regex);
    return match ? parseInt(match[1]) : null;
  }

  private extractSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('提案') || line.includes('〜すると良い') || line.includes('〜してください')) {
        suggestions.push(line.trim());
      }
    }
    
    return suggestions;
  }
}