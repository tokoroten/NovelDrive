/**
 * DuckDB実装の知識リポジトリ
 */

import * as duckdb from 'duckdb';
import { Knowledge } from '../../../domain/entities';
import { IKnowledgeRepository } from '../../../domain/repositories';

export class DuckDBKnowledgeRepository implements IKnowledgeRepository {
  constructor(private conn: duckdb.Connection) {}

  async save(knowledge: Knowledge): Promise<void> {
    const sql = `
      INSERT INTO knowledge (
        id, title, content, type, project_id, embedding, metadata, 
        search_tokens, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        type = excluded.type,
        project_id = excluded.project_id,
        embedding = excluded.embedding,
        metadata = excluded.metadata,
        search_tokens = excluded.search_tokens,
        updated_at = excluded.updated_at
    `;

    const searchTokens = this.generateSearchTokens(knowledge.title, knowledge.content);
    const embeddingJson = knowledge.embedding ? JSON.stringify(knowledge.embedding) : null;
    const metadataJson = JSON.stringify(knowledge.metadata);

    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId,
        embeddingJson,
        metadataJson,
        searchTokens,
        knowledge.createdAt,
        knowledge.updatedAt
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async findById(id: string): Promise<Knowledge | null> {
    const sql = 'SELECT * FROM knowledge WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [id], (err, rows: any[]) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve(null);
        
        const row = rows[0];
        resolve(this.mapRowToKnowledge(row));
      });
    });
  }

  async findByProjectId(projectId: string): Promise<Knowledge[]> {
    const sql = 'SELECT * FROM knowledge WHERE project_id = ? ORDER BY updated_at DESC';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [projectId], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
      });
    });
  }

  async findByType(type: string): Promise<Knowledge[]> {
    const sql = 'SELECT * FROM knowledge WHERE type = ? ORDER BY updated_at DESC';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [type], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
      });
    });
  }

  async search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
  }): Promise<Knowledge[]> {
    let sql = 'SELECT * FROM knowledge WHERE search_tokens LIKE ?';
    const params: any[] = [`%${query}%`];

    if (options?.projectId) {
      sql += ' AND (project_id = ? OR project_id IS NULL)';
      params.push(options.projectId);
    }

    if (options?.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(options?.limit || 20);

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
      });
    });
  }

  async delete(id: string): Promise<void> {
    const sql = 'DELETE FROM knowledge WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async exists(id: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM knowledge WHERE id = ? LIMIT 1';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [id], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows && rows.length > 0);
      });
    });
  }

  async existsByUrl(url: string): Promise<boolean> {
    const sql = `SELECT 1 FROM knowledge WHERE JSON_EXTRACT(metadata, '$.url') = ? LIMIT 1`;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [url], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows && rows.length > 0);
      });
    });
  }

  async findByIds(ids: string[]): Promise<Knowledge[]> {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM knowledge WHERE id IN (${placeholders})`;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ids, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
      });
    });
  }

  async searchSimilar(embedding: number[], options?: {
    limit?: number;
    threshold?: number;
  }): Promise<Knowledge[]> {
    // TODO: Implement vector similarity search with DuckDB VSS extension
    // For now, return empty array
    return [];
  }

  private mapRowToKnowledge(row: any): Knowledge {
    return new Knowledge(
      row.id,
      row.title,
      row.content,
      row.type,
      row.project_id,
      row.embedding ? JSON.parse(row.embedding) : null,
      JSON.parse(row.metadata || '{}'),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }

  private generateSearchTokens(title: string, content: string): string {
    // Simple tokenization - in production, use proper Japanese tokenizer
    const text = `${title} ${content}`.toLowerCase();
    const tokens = text.split(/\s+/).filter(token => token.length > 1);
    return [...new Set(tokens)].join(' ');
  }
}