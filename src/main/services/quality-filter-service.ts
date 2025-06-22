import * as duckdb from 'duckdb';
import { 
  QualityAssessment, 
  QualityCriterion, 
  AutonomousContentType 
} from '../../shared/types';
import { createAssistant, createThread, addMessageToThread, runAssistant, deleteThread } from './openai-service';

export class QualityFilterService {
  private conn: duckdb.Connection;
  private assistantId: string | null = null;

  constructor(conn: duckdb.Connection) {
    this.conn = conn;
  }

  async initialize(): Promise<void> {
    // Create quality assessment assistant
    this.assistantId = await createAssistant(
      '品質評価アシスタント',
      this.getQualityAssessmentPrompt(),
      'gpt-4-turbo-preview',
      0.3 // Low temperature for consistent assessments
    );
  }

  async assessQuality(content: any, type: AutonomousContentType): Promise<QualityAssessment> {
    try {
      switch (type) {
        case 'plot':
          return await this.assessPlotQuality(content);
        case 'character':
          return await this.assessCharacterQuality(content);
        case 'worldSetting':
          return await this.assessWorldSettingQuality(content);
        case 'inspiration':
          return await this.assessInspirationQuality(content);
        default:
          throw new Error(`Unknown content type: ${type}`);
      }
    } catch (error) {
      // Fallback assessment if AI evaluation fails
      return {
        overallScore: 50,
        criteria: [{
          name: 'システムエラー',
          score: 50,
          weight: 1.0,
          details: `評価中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
        }],
        recommendation: 'review',
        reasoning: 'システムエラーのため人間による確認が必要です。'
      };
    }
  }

  private async assessPlotQuality(content: any): Promise<QualityAssessment> {
    const criteria = [
      { name: '独創性', weight: 1.0 },
      { name: '物語構造', weight: 1.2 },
      { name: '感情曲線', weight: 0.8 },
      { name: '論理性', weight: 1.0 },
      { name: '読者への訴求力', weight: 1.1 },
      { name: '商業性', weight: 0.7 }
    ];

    const assessment = await this.performAIAssessment(content, 'plot', criteria);
    return this.compileFinalAssessment(assessment, criteria);
  }

  private async assessCharacterQuality(content: any): Promise<QualityAssessment> {
    const criteria = [
      { name: '個性の明確さ', weight: 1.2 },
      { name: '背景の一貫性', weight: 1.0 },
      { name: '対話の自然さ', weight: 1.1 },
      { name: '成長可能性', weight: 0.9 },
      { name: '読者共感度', weight: 1.0 },
      { name: '独自性', weight: 0.8 }
    ];

    const assessment = await this.performAIAssessment(content, 'character', criteria);
    return this.compileFinalAssessment(assessment, criteria);
  }

  private async assessWorldSettingQuality(content: any): Promise<QualityAssessment> {
    const criteria = [
      { name: '世界観の一貫性', weight: 1.3 },
      { name: '設定の詳細度', weight: 1.0 },
      { name: '独創性', weight: 1.1 },
      { name: '物語への活用可能性', weight: 1.2 },
      { name: '読者理解度', weight: 0.9 },
      { name: '実現可能性', weight: 0.7 }
    ];

    const assessment = await this.performAIAssessment(content, 'worldSetting', criteria);
    return this.compileFinalAssessment(assessment, criteria);
  }

  private async assessInspirationQuality(content: any): Promise<QualityAssessment> {
    const criteria = [
      { name: 'セレンディピティ度', weight: 1.4 },
      { name: '創作への活用可能性', weight: 1.2 },
      { name: '独自性', weight: 1.0 },
      { name: '記憶に残りやすさ', weight: 0.8 },
      { name: '組み合わせの妙', weight: 1.1 }
    ];

    const assessment = await this.performAIAssessment(content, 'inspiration', criteria);
    return this.compileFinalAssessment(assessment, criteria);
  }

  private async performAIAssessment(
    content: any, 
    type: AutonomousContentType, 
    criteria: { name: string; weight: number }[]
  ): Promise<{ [key: string]: number }> {
    if (!this.assistantId) {
      throw new Error('Quality assessment assistant not initialized');
    }

    const threadId = await createThread({ purpose: 'quality_assessment' });
    
    try {
      const prompt = this.buildAssessmentPrompt(content, type, criteria);
      await addMessageToThread(threadId, prompt, 'user');
      
      const messages = await runAssistant(threadId, this.assistantId);
      const response = messages.find(msg => msg.role === 'assistant');
      
      if (!response || typeof response.content[0] !== 'object' || !('text' in response.content[0])) {
        throw new Error('No assessment response received');
      }

      const responseText = response.content[0].text.value;
      return this.parseAssessmentResponse(responseText, criteria);
      
    } finally {
      await deleteThread(threadId);
    }
  }

  private buildAssessmentPrompt(
    content: any, 
    type: AutonomousContentType, 
    criteria: { name: string; weight: number }[]
  ): string {
    const contentText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const criteriaList = criteria.map(c => `- ${c.name}`).join('\n');

    return `以下の${this.getTypeDisplayName(type)}を品質評価してください。

【評価対象】
${contentText}

【評価基準】
${criteriaList}

【評価方法】
各基準について0-100点で評価し、以下の形式で回答してください：

<評価結果>
${criteria.map(c => `${c.name}: [点数] - [理由]`).join('\n')}
</評価結果>

<総合判定>
推奨アクション: [save/discard/review]
総合理由: [200文字以内で総合的な判断理由]
</総合判定>

※客観的で一貫した評価をお願いします。`;
  }

  private parseAssessmentResponse(
    response: string, 
    criteria: { name: string; weight: number }[]
  ): { [key: string]: number } {
    const scores: { [key: string]: number } = {};
    
    // Try to parse structured response
    const evaluationMatch = response.match(/<評価結果>(.*?)<\/評価結果>/s);
    if (evaluationMatch) {
      const evaluationText = evaluationMatch[1];
      
      criteria.forEach(criterion => {
        const regex = new RegExp(`${criterion.name}:\\s*(\\d+)`, 'i');
        const match = evaluationText.match(regex);
        if (match) {
          scores[criterion.name] = parseInt(match[1]);
        } else {
          scores[criterion.name] = 50; // Default fallback
        }
      });
    } else {
      // Fallback parsing for unstructured responses
      criteria.forEach(criterion => {
        const regex = new RegExp(`${criterion.name}[：:](\\d+)`, 'i');
        const match = response.match(regex);
        scores[criterion.name] = match ? parseInt(match[1]) : 50;
      });
    }

    return scores;
  }

  private compileFinalAssessment(
    scores: { [key: string]: number }, 
    criteria: { name: string; weight: number }[]
  ): QualityAssessment {
    const qualityCriteria: QualityCriterion[] = criteria.map(criterion => ({
      name: criterion.name,
      score: Math.max(0, Math.min(100, scores[criterion.name] || 50)),
      weight: criterion.weight,
      details: `スコア: ${scores[criterion.name] || 50}/100`
    }));

    // Calculate weighted average
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const weightedScore = qualityCriteria.reduce((sum, qc) => {
      return sum + (qc.score * qc.weight);
    }, 0) / totalWeight;

    const overallScore = Math.round(weightedScore);

    // Determine recommendation
    let recommendation: 'save' | 'discard' | 'review';
    if (overallScore >= 70) {
      recommendation = 'save';
    } else if (overallScore >= 50) {
      recommendation = 'review';
    } else {
      recommendation = 'discard';
    }

    const reasoning = this.generateReasoning(overallScore, qualityCriteria, recommendation);

    return {
      overallScore,
      criteria: qualityCriteria,
      recommendation,
      reasoning
    };
  }

  private generateReasoning(
    overallScore: number,
    criteria: QualityCriterion[],
    recommendation: 'save' | 'discard' | 'review'
  ): string {
    const topCriteria = criteria
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(c => `${c.name}(${c.score}点)`);

    const bottomCriteria = criteria
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map(c => `${c.name}(${c.score}点)`);

    let reasoning = `総合スコア${overallScore}点。`;
    
    if (recommendation === 'save') {
      reasoning += `高品質な内容です。特に${topCriteria.join('、')}で優秀な評価を得ています。保存して活用価値があります。`;
    } else if (recommendation === 'review') {
      reasoning += `中程度の品質です。${topCriteria.join('、')}は良好ですが、${bottomCriteria.join('、')}で改善の余地があります。人間による確認を推奨します。`;
    } else {
      reasoning += `品質が基準を下回っています。${bottomCriteria.join('、')}で課題があり、再生成が必要です。`;
    }

    return reasoning;
  }

  private getTypeDisplayName(type: AutonomousContentType): string {
    const displayNames = {
      'plot': 'プロット',
      'character': 'キャラクター',
      'worldSetting': '世界設定',
      'inspiration': 'インスピレーション'
    };
    return displayNames[type] || type;
  }

  private getQualityAssessmentPrompt(): string {
    return `あなたは創作物の品質評価を行う専門AIです。

【役割】
- 小説、キャラクター、世界設定、インスピレーションなどの創作コンテンツを客観的に評価
- 一貫した基準で0-100点のスコアを付与
- 保存価値の判定（save/discard/review）

【評価原則】
1. 独創性：既存作品との差別化度
2. 一貫性：設定や論理の矛盾がないか
3. 魅力度：読者・ユーザーへの訴求力
4. 実用性：実際の創作活動での活用可能性
5. 完成度：内容の詳細さと具体性

【スコア基準】
- 90-100点：優秀、他者にも推薦できるレベル
- 70-89点：良好、そのまま使用可能
- 50-69点：普通、改善や確認が必要
- 30-49点：不十分、大幅な修正が必要
- 0-29点：不適切、使用不可

常に建設的で客観的な評価を心がけ、改善点も具体的に指摘してください。`;
  }

  async getQualityStats(days = 30): Promise<{
    totalAssessed: number;
    averageScore: number;
    saveRate: number;
    discardRate: number;
    reviewRate: number;
    scoreDistribution: { range: string; count: number }[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_assessed,
          AVG(JSON_EXTRACT(result, '$.qualityScore')) as average_score,
          COUNT(CASE WHEN JSON_EXTRACT(result, '$.saved') = true THEN 1 END) as saved_count,
          COUNT(CASE WHEN JSON_EXTRACT(result, '$.saved') = false THEN 1 END) as not_saved_count
        FROM autonomous_operations 
        WHERE created_at >= ? AND status = 'completed' AND result IS NOT NULL
      `;

      this.conn.all(sql, [cutoffDate], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const row = rows?.[0] || {};
          const total = row.total_assessed || 0;
          const saved = row.saved_count || 0;
          const notSaved = row.not_saved_count || 0;

          resolve({
            totalAssessed: total,
            averageScore: Math.round(row.average_score || 0),
            saveRate: total > 0 ? Math.round((saved / total) * 100) : 0,
            discardRate: total > 0 ? Math.round((notSaved / total) * 100) : 0,
            reviewRate: 0, // Would need more detailed tracking
            scoreDistribution: [] // Would need more complex query
          });
        }
      });
    });
  }
}