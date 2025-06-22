/**
 * 副編集長AIエージェント
 * 現実的で商業主義的、品質評価の最終判定者
 */

import { BaseAgent, DiscussionContext, AgentPersonality } from './agent-base';

export interface QualityEvaluation {
  narrativeCompleteness: number;  // 物語の完成度 (0-100)
  marketability: number;          // 市場性 (0-100)
  originality: number;            // 独創性 (0-100)
  overallScore: number;           // 総合評価 (0-100)
  recommendation: 'accept' | 'revise' | 'reject';
  reasons: string[];
  suggestions: string[];
}

export class DeputyEditorAgent extends BaseAgent {
  private readonly ACCEPTANCE_THRESHOLD = 65;  // 総合評価の合格ライン
  private readonly NARRATIVE_THRESHOLD = 70;   // 物語完成度の合格ライン
  private readonly MARKET_THRESHOLD = 60;      // 市場性の合格ライン
  private readonly ORIGINALITY_THRESHOLD = 50; // 独創性の合格ライン

  constructor(openai: any, apiLogger?: any) {
    const personality: AgentPersonality = {
      role: 'deputy_editor',
      name: '副編集長',
      personality: 'pragmatic',
      temperature: 0.5, // 現実的でバランスの取れた判断
      maxTokens: 1500,
      systemPrompt: `あなたは現実的で商業主義的な副編集長AIです。

性格と行動指針：
- 市場性と読者受けを重視する現実主義者
- 因果応報性と読者の納得感を重要視
- ジャンルの慣習と期待値を理解
- 品質基準に基づく客観的な評価
- 24時間稼働モードでの最終判定者

評価基準：
1. 物語としての完成度（70点以上）
   - プロットの論理性
   - キャラクターの魅力
   - 起承転結の構成
   - 感情的な満足度

2. 市場性（60点以上）
   - ターゲット読者層への訴求力
   - ジャンル内での競争力
   - 商業的な成功可能性
   - トレンドとの適合性

3. 独創性（50点以上）
   - 新しい要素の有無
   - 既存作品との差別化
   - 意外性と驚き
   - 記憶に残る要素

総合評価が65点を超えたもののみ採用推奨とします。

フィードバック方針：
- 具体的な数値評価を提示
- 市場での成功可能性を予測
- 改善により採用可能かを明確に判断
- ジャンルの読者が期待する要素を指摘

あなたの使命は、商業的に成功し、読者に愛される作品を選別することです。`,
    };

    super(personality, openai, apiLogger);
  }

  /**
   * ユーザープロンプトを構築
   */
  protected buildUserPrompt(context: DiscussionContext): string {
    let prompt = `議題: ${context.topic}\n\n`;

    // 各エージェントの意見を整理
    const agentOpinions: Record<string, string> = {};
    for (const msg of context.previousMessages) {
      const role = msg.agentId.split('-')[0];
      if (!agentOpinions[role] || msg.timestamp > new Date(agentOpinions[role])) {
        agentOpinions[role] = msg.content;
      }
    }

    if (Object.keys(agentOpinions).length > 0) {
      prompt += 'これまでの議論:\n';
      if (agentOpinions.writer) {
        prompt += `【作家AI】\n${agentOpinions.writer.substring(0, 300)}...\n\n`;
      }
      if (agentOpinions.editor) {
        prompt += `【編集AI】\n${agentOpinions.editor.substring(0, 200)}...\n\n`;
      }
      if (agentOpinions.proofreader) {
        prompt += `【校閲AI】\n${agentOpinions.proofreader.substring(0, 200)}...\n\n`;
      }
    }

    prompt += `この提案を商業的・現実的な観点から評価してください。

評価項目と配点：
1. 物語としての完成度（100点満点）
   - プロットの完成度
   - キャラクターの魅力
   - 読者の感情的満足度

2. 市場性（100点満点）
   - ターゲット層への訴求力
   - 売れる可能性
   - ジャンルでの競争力

3. 独創性（100点満点）
   - 新規性
   - 差別化要素
   - 記憶に残る度合い

各項目を点数で評価し、総合評価を算出してください。
合格基準：総合65点以上、物語完成度70点以上、市場性60点以上、独創性50点以上

評価フォーマット：
【物語完成度】X点/100点
- 評価理由

【市場性】Y点/100点
- 評価理由

【独創性】Z点/100点
- 評価理由

【総合評価】平均点/100点
【判定】採用推奨/要改善/不採用

【理由】
- 判定の主な理由

【改善提案】
- 具体的な改善案（要改善の場合）`;

    return prompt;
  }

  /**
   * 作品の品質評価
   */
  async evaluateQuality(
    plot: string,
    genre: string,
    targetAudience: string,
    otherAgentOpinions?: Record<string, string>
  ): Promise<QualityEvaluation> {
    const messages: any[] = [];
    
    // 他のエージェントの意見を追加
    if (otherAgentOpinions) {
      for (const [role, opinion] of Object.entries(otherAgentOpinions)) {
        messages.push({
          id: `${role}-opinion`,
          agentId: `${role}-agent`,
          timestamp: new Date(),
          content: opinion,
        });
      }
    }

    const context: DiscussionContext = {
      topic: `ジャンル「${genre}」、ターゲット「${targetAudience}」の作品評価`,
      previousMessages: messages,
      knowledgeContext: `評価対象プロット:\n${plot}`,
    };

    const message = await this.participate(context);
    return this.parseEvaluation(message.content);
  }

  /**
   * 評価結果をパース
   */
  private parseEvaluation(content: string): QualityEvaluation {
    const evaluation: QualityEvaluation = {
      narrativeCompleteness: 0,
      marketability: 0,
      originality: 0,
      overallScore: 0,
      recommendation: 'reject',
      reasons: [],
      suggestions: [],
    };

    // スコアの抽出
    const narrativeMatch = content.match(/【物語完成度】\s*(\d+)点/);
    if (narrativeMatch) {
      evaluation.narrativeCompleteness = parseInt(narrativeMatch[1]);
    }

    const marketMatch = content.match(/【市場性】\s*(\d+)点/);
    if (marketMatch) {
      evaluation.marketability = parseInt(marketMatch[1]);
    }

    const originalityMatch = content.match(/【独創性】\s*(\d+)点/);
    if (originalityMatch) {
      evaluation.originality = parseInt(originalityMatch[1]);
    }

    const overallMatch = content.match(/【総合評価】\s*(\d+(?:\.\d+)?)/);
    if (overallMatch) {
      evaluation.overallScore = parseFloat(overallMatch[1]);
    } else {
      // 手動計算
      evaluation.overallScore = Math.round(
        (evaluation.narrativeCompleteness + evaluation.marketability + evaluation.originality) / 3
      );
    }

    // 判定の抽出
    if (content.includes('採用推奨')) {
      evaluation.recommendation = 'accept';
    } else if (content.includes('要改善')) {
      evaluation.recommendation = 'revise';
    } else {
      evaluation.recommendation = 'reject';
    }

    // 理由の抽出
    const reasonMatch = content.match(/【理由】\s*([\s\S]*?)(?=【|$)/);
    if (reasonMatch) {
      const reasonText = reasonMatch[1].trim();
      evaluation.reasons = reasonText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());
    }

    // 改善提案の抽出
    const suggestionMatch = content.match(/【改善提案】\s*([\s\S]*?)$/);
    if (suggestionMatch) {
      const suggestionText = suggestionMatch[1].trim();
      evaluation.suggestions = suggestionText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());
    }

    return evaluation;
  }

  /**
   * 24時間稼働モードでの自動評価
   */
  async autoEvaluate(content: {
    plot: string;
    genre: string;
    writerProposal: string;
    editorFeedback?: string;
    proofreaderIssues?: string;
  }): Promise<{
    shouldSave: boolean;
    evaluation: QualityEvaluation;
    summary: string;
  }> {
    const otherOpinions: Record<string, string> = {
      writer: content.writerProposal,
    };

    if (content.editorFeedback) {
      otherOpinions.editor = content.editorFeedback;
    }
    if (content.proofreaderIssues) {
      otherOpinions.proofreader = content.proofreaderIssues;
    }

    const evaluation = await this.evaluateQuality(
      content.plot,
      content.genre,
      'general', // デフォルトターゲット
      otherOpinions
    );

    // 採用基準の判定
    const shouldSave = 
      evaluation.overallScore >= this.ACCEPTANCE_THRESHOLD &&
      evaluation.narrativeCompleteness >= this.NARRATIVE_THRESHOLD &&
      evaluation.marketability >= this.MARKET_THRESHOLD &&
      evaluation.originality >= this.ORIGINALITY_THRESHOLD;

    const summary = this.generateSummary(evaluation, shouldSave);

    return { shouldSave, evaluation, summary };
  }

  /**
   * 評価サマリーの生成
   */
  private generateSummary(evaluation: QualityEvaluation, shouldSave: boolean): string {
    const status = shouldSave ? '採用' : '不採用';
    
    return `【評価結果: ${status}】
総合評価: ${evaluation.overallScore}点
- 物語完成度: ${evaluation.narrativeCompleteness}点 ${evaluation.narrativeCompleteness >= this.NARRATIVE_THRESHOLD ? '✓' : '✗'}
- 市場性: ${evaluation.marketability}点 ${evaluation.marketability >= this.MARKET_THRESHOLD ? '✓' : '✗'}
- 独創性: ${evaluation.originality}点 ${evaluation.originality >= this.ORIGINALITY_THRESHOLD ? '✓' : '✗'}

${evaluation.reasons.length > 0 ? '主な理由:\n' + evaluation.reasons.map(r => `・${r}`).join('\n') : ''}
${evaluation.suggestions.length > 0 ? '\n改善案:\n' + evaluation.suggestions.map(s => `・${s}`).join('\n') : ''}`;
  }

  /**
   * ジャンル別評価基準の調整
   */
  adjustCriteriaForGenre(genre: string): void {
    // ジャンルによって評価基準を調整
    switch (genre.toLowerCase()) {
      case 'ライトノベル':
      case 'なろう系':
        // 市場性重視
        this.personality.systemPrompt += '\n\n【ジャンル特性】Web小説・ライトノベル読者の期待に応える要素を重視してください。';
        break;
      case '純文学':
        // 独創性重視
        this.personality.systemPrompt += '\n\n【ジャンル特性】文学的価値と独創性を特に重視してください。';
        break;
      case 'ミステリー':
        // 論理性重視
        this.personality.systemPrompt += '\n\n【ジャンル特性】謎解きの論理性と伏線回収を重視してください。';
        break;
      default:
        // デフォルト基準
        break;
    }
  }
}