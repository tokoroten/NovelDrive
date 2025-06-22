import * as duckdb from 'duckdb';
/**
 * コサイン類似度を計算
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
import { getSearchTokens } from './japanese-tokenizer';

/**
 * 検索結果の重み付きリランキングシステム
 */

export interface RankingFactors {
  // ベクトル類似度の重み (0-1)
  vectorSimilarityWeight: number;
  // 全文検索スコアの重み (0-1)
  textMatchWeight: number;
  // 時間的減衰の重み (0-1)
  temporalDecayWeight: number;
  // 多様性の重み (0-1)
  diversityWeight: number;
  // プロジェクト関連性の重み (0-1)
  projectRelevanceWeight: number;
  // タイプ一致の重み (0-1)
  typeMatchWeight: number;
}

export interface ScoredResult {
  id: string;
  title: string;
  content: string;
  type: string;
  projectId?: string;
  embedding?: number[];
  createdAt: Date;
  // スコア詳細
  vectorScore: number;
  textScore: number;
  temporalScore: number;
  projectScore: number;
  typeScore: number;
  finalScore: number;
  // デバッグ情報
  debugInfo?: {
    textMatches: number;
    daysSinceCreation: number;
    diversityPenalty?: number;
  };
}

/**
 * デフォルトのランキング設定
 */
export const DEFAULT_RANKING_FACTORS: RankingFactors = {
  vectorSimilarityWeight: 0.4,
  textMatchWeight: 0.3,
  temporalDecayWeight: 0.1,
  diversityWeight: 0.1,
  projectRelevanceWeight: 0.05,
  typeMatchWeight: 0.05,
};

/**
 * 重み付きリランキングクラス
 */
export class WeightedReranking {
  private conn: duckdb.Connection;
  private factors: RankingFactors;

  constructor(conn: duckdb.Connection, factors: RankingFactors = DEFAULT_RANKING_FACTORS) {
    this.conn = conn;
    this.factors = this.normalizeWeights(factors);
  }

  /**
   * 重みを正規化（合計が1になるように）
   */
  private normalizeWeights(factors: RankingFactors): RankingFactors {
    const total = 
      factors.vectorSimilarityWeight +
      factors.textMatchWeight +
      factors.temporalDecayWeight +
      factors.diversityWeight +
      factors.projectRelevanceWeight +
      factors.typeMatchWeight;

    if (total === 0) return DEFAULT_RANKING_FACTORS;

    return {
      vectorSimilarityWeight: factors.vectorSimilarityWeight / total,
      textMatchWeight: factors.textMatchWeight / total,
      temporalDecayWeight: factors.temporalDecayWeight / total,
      diversityWeight: factors.diversityWeight / total,
      projectRelevanceWeight: factors.projectRelevanceWeight / total,
      typeMatchWeight: factors.typeMatchWeight / total,
    };
  }

  /**
   * ハイブリッド検索（ベクトル検索 + 全文検索）を実行してリランキング
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[] | null,
    options: {
      limit?: number;
      projectId?: string;
      type?: string;
      minScore?: number;
    } = {}
  ): Promise<ScoredResult[]> {
    const { limit = 20, projectId, type, minScore = 0.1 } = options;

    // 1. 検索候補を取得
    const candidates = await this.getCandidates(query, queryEmbedding, {
      limit: limit * 3, // 多めに取得してリランキング
      projectId,
      type,
    });

    // 2. 各候補をスコアリング
    const scoredResults = await this.scoreResults(
      candidates,
      query,
      queryEmbedding,
      { projectId, type }
    );

    // 3. 多様性を考慮したリランキング
    const rerankedResults = this.applyDiversityReranking(scoredResults);

    // 4. 最終的なフィルタリングとソート
    return rerankedResults
      .filter(result => result.finalScore >= minScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  /**
   * 検索候補を取得
   */
  private async getCandidates(
    query: string,
    queryEmbedding: number[] | null,
    options: {
      limit: number;
      projectId?: string;
      type?: string;
    }
  ): Promise<any[]> {
    const candidates: any[] = [];
    const candidateIds = new Set<string>();

    // ベクトル検索による候補
    if (queryEmbedding) {
      const vectorResults = await this.vectorSearch(queryEmbedding, options);
      vectorResults.forEach(result => {
        if (!candidateIds.has(result.id)) {
          candidateIds.add(result.id);
          candidates.push({ ...result, source: 'vector' });
        }
      });
    }

    // 全文検索による候補
    const textResults = await this.textSearch(query, options);
    textResults.forEach(result => {
      if (!candidateIds.has(result.id)) {
        candidateIds.add(result.id);
        candidates.push({ ...result, source: 'text' });
      } else {
        // 既に存在する場合はソース情報を更新
        const existing = candidates.find(c => c.id === result.id);
        if (existing) {
          existing.source = 'both';
          existing.textMatchCount = result.textMatchCount;
        }
      }
    });

    return candidates;
  }

  /**
   * ベクトル検索
   */
  private async vectorSearch(
    queryEmbedding: number[],
    options: {
      limit: number;
      projectId?: string;
      type?: string;
    }
  ): Promise<any[]> {
    const { limit, projectId, type } = options;
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const whereClauses = ['embedding IS NOT NULL'];
    const params: unknown[] = [];

    if (projectId) {
      whereClauses.push('(project_id = ? OR project_id IS NULL)');
      params.push(projectId);
    }

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        embedding,
        created_at,
        cosine_similarity(embedding::FLOAT[], ${embeddingStr}::FLOAT[]) as vector_similarity
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY vector_similarity DESC
      LIMIT ?
    `;

    params.push(limit);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * 全文検索
   */
  private async textSearch(
    query: string,
    options: {
      limit: number;
      projectId?: string;
      type?: string;
    }
  ): Promise<any[]> {
    const { limit, projectId, type } = options;
    const tokens = getSearchTokens(query);
    
    if (tokens.length === 0) return [];

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    // テキスト検索条件
    const textConditions = tokens.map(() => '(title LIKE ? OR content LIKE ?)').join(' AND ');
    whereClauses.push(`(${textConditions})`);
    tokens.forEach(token => {
      params.push(`%${token}%`, `%${token}%`);
    });

    if (projectId) {
      whereClauses.push('(project_id = ? OR project_id IS NULL)');
      params.push(projectId);
    }

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    // マッチ数のカウント
    const matchCountExpr = tokens.map((_token, _i) => `
      (
        CASE WHEN title LIKE '%' || ? || '%' THEN 2 ELSE 0 END +
        CASE WHEN content LIKE '%' || ? || '%' THEN 1 ELSE 0 END
      )
    `).join(' + ');

    tokens.forEach(token => {
      params.push(token, token);
    });

    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        embedding,
        created_at,
        (${matchCountExpr}) as text_match_count
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY text_match_count DESC
      LIMIT ?
    `;

    params.push(limit);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * 結果をスコアリング
   */
  private async scoreResults(
    candidates: any[],
    query: string,
    queryEmbedding: number[] | null,
    options: {
      projectId?: string;
      type?: string;
    }
  ): Promise<ScoredResult[]> {
    const tokens = getSearchTokens(query);
    const now = new Date();

    return candidates.map(candidate => {
      const result: ScoredResult = {
        id: candidate.id,
        title: candidate.title,
        content: candidate.content,
        type: candidate.type,
        projectId: candidate.project_id,
        embedding: candidate.embedding,
        createdAt: new Date(candidate.created_at),
        vectorScore: 0,
        textScore: 0,
        temporalScore: 0,
        projectScore: 0,
        typeScore: 0,
        finalScore: 0,
      };

      // ベクトルスコア
      if (queryEmbedding && candidate.embedding) {
        const embedding = typeof candidate.embedding === 'string' 
          ? JSON.parse(candidate.embedding) 
          : candidate.embedding;
        
        result.vectorScore = candidate.vector_similarity || 
          cosineSimilarity(queryEmbedding, embedding);
      }

      // テキストマッチスコア
      if (tokens.length > 0) {
        const titleMatches = tokens.filter(token => 
          candidate.title.toLowerCase().includes(token)
        ).length;
        const contentMatches = tokens.filter(token => 
          candidate.content.toLowerCase().includes(token)
        ).length;
        
        // タイトルマッチは重み付け
        result.textScore = (titleMatches * 2 + contentMatches) / (tokens.length * 3);
        
        result.debugInfo = {
          textMatches: titleMatches + contentMatches,
          daysSinceCreation: 0,
        };
      }

      // 時間的スコア（新しいものほど高スコア）
      const daysSinceCreation = (now.getTime() - result.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      result.temporalScore = Math.exp(-daysSinceCreation / 30); // 30日で約37%に減衰
      
      if (result.debugInfo) {
        result.debugInfo.daysSinceCreation = Math.round(daysSinceCreation);
      }

      // プロジェクト関連性スコア
      if (options.projectId) {
        result.projectScore = candidate.project_id === options.projectId ? 1 : 0.5;
      } else {
        result.projectScore = 0.5; // ニュートラル
      }

      // タイプ一致スコア
      if (options.type) {
        result.typeScore = candidate.type === options.type ? 1 : 0;
      } else {
        result.typeScore = 0.5; // ニュートラル
      }

      // 最終スコアの計算
      result.finalScore = 
        result.vectorScore * this.factors.vectorSimilarityWeight +
        result.textScore * this.factors.textMatchWeight +
        result.temporalScore * this.factors.temporalDecayWeight +
        result.projectScore * this.factors.projectRelevanceWeight +
        result.typeScore * this.factors.typeMatchWeight;

      return result;
    });
  }

  /**
   * 多様性を考慮したリランキング
   */
  private applyDiversityReranking(results: ScoredResult[]): ScoredResult[] {
    if (results.length <= 1 || this.factors.diversityWeight === 0) {
      return results;
    }

    const reranked: ScoredResult[] = [];
    const remaining = [...results];

    // 最高スコアのアイテムを選択
    remaining.sort((a, b) => b.finalScore - a.finalScore);
    reranked.push(remaining.shift()!);

    // 残りのアイテムを多様性を考慮して選択
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        let adjustedScore = item.finalScore;

        // 既に選択されたアイテムとの類似度をペナルティとして適用
        for (const selected of reranked) {
          // ベクトル類似度に基づくペナルティ
          if (item.embedding && selected.embedding) {
            const similarity = cosineSimilarity(
              item.embedding as number[],
              selected.embedding as number[]
            );
            adjustedScore -= similarity * this.factors.diversityWeight;
          }

          // タイプの重複に対するペナルティ
          if (item.type === selected.type) {
            adjustedScore -= 0.1 * this.factors.diversityWeight;
          }
        }

        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestIdx = i;
        }
      }

      const selected = remaining.splice(bestIdx, 1)[0];
      
      // デバッグ情報に多様性ペナルティを記録
      if (selected.debugInfo) {
        selected.debugInfo.diversityPenalty = selected.finalScore - bestScore;
      }
      
      reranked.push(selected);
    }

    return reranked;
  }

  /**
   * ランキング要因の重みを更新
   */
  updateWeights(factors: Partial<RankingFactors>): void {
    this.factors = this.normalizeWeights({
      ...this.factors,
      ...factors,
    });
  }

  /**
   * 現在の重み設定を取得
   */
  getWeights(): RankingFactors {
    return { ...this.factors };
  }
}