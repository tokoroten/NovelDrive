/**
 * 知識リポジトリ
 */

import { BaseRepository } from './base-repository';
import { Knowledge, SearchResult, SearchOptions } from './types';
import { LocalEmbeddingService } from '../services/local-embedding-service';
import { getSearchTokens } from '../services/japanese-tokenizer';
import { ConnectionManager } from '../core/database/connection-manager';
import { NotFoundError } from '../utils/error-handler';

export class KnowledgeRepository extends BaseRepository<Knowledge> {
  private embeddingService: LocalEmbeddingService;

  constructor(connectionManager: ConnectionManager) {
    super(connectionManager, 'knowledge');
    this.embeddingService = LocalEmbeddingService.getInstance();
  }

  protected mapRowToEntity(row: any): Knowledge {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      project_id: row.project_id,
      source_url: row.source_url,
      source_id: row.source_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      search_tokens: row.search_tokens,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: Knowledge): any[] {
    return [
      entity.id || this.generateId(),
      entity.title,
      entity.content,
      entity.type,
      entity.project_id || null,
      entity.source_url || null,
      entity.source_id || null,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      entity.embedding ? JSON.stringify(entity.embedding) : null,
      entity.search_tokens || null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: Knowledge): any[] {
    return [
      entity.title,
      entity.content,
      entity.type,
      entity.project_id || null,
      entity.source_url || null,
      entity.source_id || null,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      entity.embedding ? JSON.stringify(entity.embedding) : null,
      entity.search_tokens || null,
      this.getCurrentTime()
    ];
  }

  async create(knowledge: Knowledge): Promise<Knowledge> {
    // 埋め込みベクトルと検索トークンの生成
    const embedding = await this.embeddingService.generateEmbedding(
      `${knowledge.title} ${knowledge.content}`
    );
    const searchTokens = getSearchTokens(`${knowledge.title} ${knowledge.content}`);

    const id = knowledge.id || this.generateId();
    const sql = `
      INSERT INTO knowledge (
        id, title, content, type, project_id, source_url, source_id, 
        metadata, embedding, search_tokens, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({
      ...knowledge,
      id,
      embedding,
      search_tokens: searchTokens.join(' ')
    });
    
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new NotFoundError('作成した知識');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<Knowledge>): Promise<Knowledge> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('知識');
    }

    const updated = { ...existing, ...updates };

    // 内容が変更された場合は埋め込みと検索トークンを再生成
    if (updates.title || updates.content) {
      updated.embedding = await this.embeddingService.generateEmbedding(
        `${updated.title} ${updated.content}`
      );
      updated.search_tokens = getSearchTokens(`${updated.title} ${updated.content}`).join(' ');
    }

    const sql = `
      UPDATE knowledge 
      SET title = ?, content = ?, type = ?, project_id = ?, 
          source_url = ?, source_id = ?, metadata = ?, 
          embedding = ?, search_tokens = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundError('更新した知識');
    }
    
    return result;
  }

  async findByProject(projectId: string): Promise<Knowledge[]> {
    const sql = `
      SELECT * FROM knowledge 
      WHERE project_id = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [projectId]);
  }

  async findByType(type: string, projectId?: string): Promise<Knowledge[]> {
    let sql = `SELECT * FROM knowledge WHERE type = ?`;
    const params = [type];
    
    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }
    
    sql += ` ORDER BY created_at DESC`;
    return this.getMany(sql, params);
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, mode, projectId, types, limit = 20, threshold = 0.5 } = options;

    // 検索クエリの埋め込みベクトル生成
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    const queryTokens = getSearchTokens(query);

    let sql = `
      WITH search_results AS (
        SELECT 
          id,
          title,
          content,
          type,
          project_id,
          embedding,
          search_tokens,
          0.0 as semantic_score,
          0.0 as keyword_score
        FROM knowledge
        WHERE 1=1
    `;

    const params: any[] = [];

    // プロジェクトフィルター
    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }

    // タイプフィルター
    if (types && types.length > 0) {
      sql += ` AND type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    sql += `)
      SELECT 
        id,
        title,
        content,
        type,
        project_id,
        semantic_score + keyword_score as score
      FROM search_results
      WHERE semantic_score + keyword_score > ?
      ORDER BY score DESC
      LIMIT ?
    `;

    params.push(threshold, limit);

    // 実際のベクトル検索とキーワード検索の実装は
    // DuckDB VSS拡張機能のセットアップ後に実装
    const results = await this.executeQuery<SearchResult>(sql, params);
    
    return results;
  }

  async getRelatedKnowledge(knowledgeId: string, limit = 10): Promise<Knowledge[]> {
    // セマンティック類似度に基づく関連知識の取得
    // 実装はDuckDB VSS拡張機能のセットアップ後
    const sql = `
      SELECT * FROM knowledge 
      WHERE id != ? 
      LIMIT ?
    `;
    
    return this.getMany(sql, [knowledgeId, limit]);
  }
}