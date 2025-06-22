/**
 * セレンディピティ検索サービス
 */

import * as duckdb from 'duckdb';
import { IEmbeddingService } from './interfaces';
import { LocalEmbeddingService } from './local-embedding-service';

export interface SerendipitySearchOptions {
  projectId?: string;
  type?: string;
  limit?: number;
  serendipityLevel?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export class SerendipitySearchService {
  constructor(
    private conn: duckdb.Connection,
    private embeddingService: IEmbeddingService
  ) {}

  /**
   * セレンディピティ検索
   */
  async search(query: string, options: SerendipitySearchOptions = {}): Promise<SearchResult[]> {
    const {
      projectId,
      type,
      limit = 20,
      serendipityLevel = 0.3
    } = options;

    // クエリの埋め込みを生成
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // セレンディピティを注入
    const modifiedEmbedding = this.injectSerendipity(queryEmbedding, serendipityLevel);
    
    // ベクトル検索を実行
    return this.performVectorSearch(modifiedEmbedding, {
      projectId,
      type,
      limit
    });
  }

  /**
   * 関連アイテムの検索
   */
  async findRelated(itemId: string, options: SerendipitySearchOptions = {}): Promise<SearchResult[]> {
    const item = await this.getItem(itemId);
    if (!item || !item.embedding) {
      return [];
    }

    const embedding = JSON.parse(item.embedding);
    const modifiedEmbedding = this.injectSerendipity(
      embedding,
      options.serendipityLevel || 0.2
    );

    const results = await this.performVectorSearch(modifiedEmbedding, {
      ...options,
      excludeId: itemId
    });

    return results;
  }

  /**
   * セレンディピティを注入
   */
  private injectSerendipity(embedding: number[], level: number): number[] {
    return embedding.map(value => {
      // ランダムノイズを追加
      const noise = (Math.random() - 0.5) * 2 * level;
      return value + noise;
    });
  }

  /**
   * ベクトル検索を実行
   */
  private async performVectorSearch(
    embedding: number[],
    options: {
      projectId?: string;
      type?: string;
      limit?: number;
      excludeId?: string;
    }
  ): Promise<SearchResult[]> {
    // TODO: DuckDB VSSを使用した実際のベクトル検索を実装
    // 現在は通常の検索で代替
    
    let sql = 'SELECT id, title, content, type, metadata FROM knowledge WHERE 1=1';
    const params: any[] = [];

    if (options.projectId) {
      sql += ' AND project_id = ?';
      params.push(options.projectId);
    }

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    if (options.excludeId) {
      sql += ' AND id != ?';
      params.push(options.excludeId);
    }

    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(options.limit || 20);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const results = (rows || []).map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            type: row.type,
            similarity: Math.random(), // 仮の類似度
            metadata: JSON.parse(row.metadata || '{}')
          }));
          resolve(results);
        }
      });
    });
  }

  /**
   * アイテムを取得
   */
  private async getItem(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM knowledge WHERE id = ?',
        [id],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows?.[0] || null);
        }
      );
    });
  }
}