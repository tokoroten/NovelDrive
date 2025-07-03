import Database from 'better-sqlite3';
import { generateEmbedding } from './openai-service';

/**
 * SQLite3でのベクトル検索サービス
 * DuckDB VSSの代替実装
 */
export class VectorSearchService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * コサイン類似度の計算
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * ベクトル検索の実行
   */
  async vectorSearch(
    queryEmbedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      projectId?: string;
      type?: string;
    } = {}
  ): Promise<any[]> {
    const { limit = 10, threshold = 0.7, projectId, type } = options;

    // WHERE句の構築
    const whereClauses = ['embedding IS NOT NULL'];
    const params: any[] = [];
    
    if (projectId) {
      whereClauses.push('(project_id = ? OR project_id IS NULL)');
      params.push(projectId);
    }
    
    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    // 候補を取得
    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        metadata,
        embedding
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    // メモリ内で類似度計算とフィルタリング
    const results = rows
      .map(row => {
        try {
          const embedding = JSON.parse(row.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          return {
            ...row,
            similarity,
            embedding: undefined // レスポンスから除外
          };
        } catch (error) {
          console.error('Failed to parse embedding:', error);
          return null;
        }
      })
      .filter(row => row !== null && row.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  /**
   * k-NN検索（k近傍法）
   */
  async knnSearch(
    queryEmbedding: number[],
    k: number,
    options: {
      projectId?: string;
      type?: string;
    } = {}
  ): Promise<any[]> {
    const { projectId, type } = options;

    // WHERE句の構築
    const whereClauses = ['embedding IS NOT NULL'];
    const params: any[] = [];
    
    if (projectId) {
      whereClauses.push('(project_id = ? OR project_id IS NULL)');
      params.push(projectId);
    }
    
    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    // 候補を取得
    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        metadata,
        embedding
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    // メモリ内で類似度計算とソート
    const results = rows
      .map(row => {
        try {
          const embedding = JSON.parse(row.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          return {
            ...row,
            similarity,
            embedding: undefined // レスポンスから除外
          };
        } catch (error) {
          console.error('Failed to parse embedding:', error);
          return null;
        }
      })
      .filter(row => row !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    return results;
  }

  /**
   * ベクトルの更新
   */
  async updateEmbedding(knowledgeId: string, embedding: number[]): Promise<void> {
    const stmt = this.db.prepare('UPDATE knowledge SET embedding = ? WHERE id = ?');
    stmt.run(JSON.stringify(embedding), knowledgeId);
  }

  /**
   * バッチでベクトルを生成・更新
   */
  async generateMissingEmbeddings(batchSize: number = 10): Promise<number> {
    console.log('Generating missing embeddings...');

    // 埋め込みが未生成の知識を取得
    const stmt = this.db.prepare(`
      SELECT id, title, content 
      FROM knowledge 
      WHERE embedding IS NULL OR embedding = ''
      LIMIT ?
    `);
    const missingEmbeddings = stmt.all(batchSize) as Array<{id: string; title: string; content: string}>;

    if (missingEmbeddings.length === 0) {
      console.log('No missing embeddings found');
      return 0;
    }

    let generated = 0;
    for (const item of missingEmbeddings) {
      try {
        // テキストを結合して埋め込みを生成
        const text = `${item.title}\n\n${item.content}`;
        const embedding = await generateEmbedding(text);
        
        // 埋め込みを更新
        if (embedding) {
          await this.updateEmbedding(item.id, embedding);
          generated++;
          console.log(`✓ Generated embedding for: ${item.title}`);
        }
      } catch (error) {
        console.error(`Failed to generate embedding for ${item.id}:`, error);
      }
    }

    console.log(`Generated ${generated} embeddings`);
    return generated;
  }

  /**
   * ベクトル検索のテスト
   */
  async testVectorSearch(): Promise<void> {
    console.log('\nTesting vector search...');

    // テスト用の知識を作成
    const testId = 'vss-test-' + Date.now();
    const testEmbedding = Array(1536).fill(0).map(() => Math.random());
    
    const stmt = this.db.prepare(
      'INSERT INTO knowledge (id, title, content, type, embedding) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(
      testId,
      'VSS Test Item',
      'This is a test item for vector search',
      'test',
      JSON.stringify(testEmbedding)
    );

    // 類似度の高いクエリベクトル（少しノイズを追加）
    const queryEmbedding = testEmbedding.map(v => v + (Math.random() - 0.5) * 0.1);
    
    // ベクトル検索を実行
    const results = await this.vectorSearch(queryEmbedding, { limit: 5 });
    
    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
      console.log(`Top result: ${results[0].title} (similarity: ${results[0].similarity.toFixed(4)})`);
    }

    // クリーンアップ
    const deleteStmt = this.db.prepare('DELETE FROM knowledge WHERE id = ?');
    deleteStmt.run(testId);
    
    console.log('✓ Vector search test completed');
  }
}