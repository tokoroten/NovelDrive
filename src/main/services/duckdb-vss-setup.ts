import * as duckdb from 'duckdb';
import { generateEmbedding } from './openai-service';

/**
 * DuckDB VSS (Vector Similarity Search) のセットアップと管理
 */
export class DuckDBVSSSetup {
  private conn: duckdb.Connection;

  constructor(conn: duckdb.Connection) {
    this.conn = conn;
  }

  /**
   * VSS拡張機能のセットアップ
   */
  async setupVSS(): Promise<void> {
    console.log('Setting up DuckDB VSS extension...');

    try {
      // VSS拡張機能のインストール（本番環境では事前にインストール済みを想定）
      await this.execute('INSTALL vss');
      await this.execute('LOAD vss');
      console.log('✓ VSS extension installed and loaded');
    } catch (error) {
      console.warn('VSS extension might already be installed:', error);
    }

    // ベクトルインデックスの作成
    await this.createVectorIndices();
    
    // ベクトル検索関数の登録
    await this.registerVectorFunctions();
    
    console.log('✓ DuckDB VSS setup completed');
  }

  /**
   * ベクトルインデックスの作成
   */
  private async createVectorIndices(): Promise<void> {
    console.log('Creating vector indices...');

    // knowledgeテーブルのベクトルインデックス
    try {
      // 既存のインデックスを削除（存在する場合）
      await this.execute('DROP INDEX IF EXISTS idx_knowledge_embedding');
      
      // HNSWインデックスの作成
      // 注：DuckDBのVSS拡張機能の実装状況により、構文が異なる可能性があります
      await this.execute(`
        CREATE INDEX idx_knowledge_embedding 
        ON knowledge 
        USING HNSW (embedding) 
        WITH (
          m = 16,
          ef_construction = 200,
          metric = 'cosine'
        )
      `);
      
      console.log('✓ Vector index created on knowledge.embedding');
    } catch (error) {
      console.warn('Vector index creation failed (might not be supported yet):', error);
      // フォールバック：通常のインデックスを作成
      await this.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge(embedding)');
    }
  }

  /**
   * ベクトル検索関数の登録
   */
  private async registerVectorFunctions(): Promise<void> {
    console.log('Registering vector functions...');

    // コサイン類似度関数の作成（SQL UDFとして）
    await this.execute(`
      CREATE OR REPLACE MACRO cosine_similarity(vec1, vec2) AS (
        list_reduce(
          list_zip(vec1, vec2),
          (acc, x) -> acc + (x[1] * x[2]),
          0.0
        ) / (
          sqrt(list_reduce(vec1, (acc, x) -> acc + (x * x), 0.0)) *
          sqrt(list_reduce(vec2, (acc, x) -> acc + (x * x), 0.0))
        )
      )
    `);

    // ユークリッド距離関数
    await this.execute(`
      CREATE OR REPLACE MACRO euclidean_distance(vec1, vec2) AS (
        sqrt(
          list_reduce(
            list_zip(vec1, vec2),
            (acc, x) -> acc + pow(x[1] - x[2], 2),
            0.0
          )
        )
      )
    `);

    console.log('✓ Vector functions registered');
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

    // クエリベクトルを文字列化
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // WHERE句の構築
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

    // ベクトル検索クエリ
    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        metadata,
        cosine_similarity(embedding::FLOAT[], ${embeddingStr}::FLOAT[]) as similarity
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
        AND cosine_similarity(embedding::FLOAT[], ${embeddingStr}::FLOAT[]) >= ?
      ORDER BY similarity DESC
      LIMIT ?
    `;

    params.push(threshold, limit);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
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

    // クエリベクトルを文字列化
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // WHERE句の構築
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

    // k-NN検索クエリ
    const sql = `
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        metadata,
        cosine_similarity(embedding::FLOAT[], ${embeddingStr}::FLOAT[]) as similarity
      FROM knowledge
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY similarity DESC
      LIMIT ?
    `;

    params.push(k);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * ベクトルの更新
   */
  async updateEmbedding(knowledgeId: string, embedding: number[]): Promise<void> {
    const sql = 'UPDATE knowledge SET embedding = ?::FLOAT[] WHERE id = ?';
    const embeddingStr = `[${embedding.join(',')}]`;
    
    await this.execute(sql, [embeddingStr, knowledgeId]);
  }

  /**
   * バッチでベクトルを生成・更新
   */
  async generateMissingEmbeddings(batchSize: number = 10): Promise<number> {
    console.log('Generating missing embeddings...');

    // 埋め込みが未生成の知識を取得
    const missingEmbeddings = await this.query(`
      SELECT id, title, content 
      FROM knowledge 
      WHERE embedding IS NULL
      LIMIT ?
    `, [batchSize]);

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
        }
        generated++;
        
        console.log(`✓ Generated embedding for: ${item.title}`);
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
    
    await this.execute(
      'INSERT INTO knowledge (id, title, content, type, embedding) VALUES (?, ?, ?, ?, ?::FLOAT[])',
      [
        testId,
        'VSS Test Item',
        'This is a test item for vector search',
        'test',
        `[${testEmbedding.join(',')}]`
      ]
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
    await this.execute('DELETE FROM knowledge WHERE id = ?', [testId]);
    
    console.log('✓ Vector search test completed');
  }

  /**
   * SQLの実行（結果を返す）
   */
  private query(sql: string, params: unknown[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * SQLの実行（結果を返さない）
   */
  private execute(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/**
 * DuckDB VSSのセットアップを実行
 */
export async function setupDuckDBVSS(conn: duckdb.Connection): Promise<DuckDBVSSSetup> {
  const vssSetup = new DuckDBVSSSetup(conn);
  await vssSetup.setupVSS();
  return vssSetup;
}