/**
 * 章リポジトリ
 */

import { BaseRepository } from './base-repository';
import { Chapter } from './types';
import { ConnectionManager } from '../core/database/connection-manager';
import { NotFoundError } from '../utils/error-handler';

export class ChapterRepository extends BaseRepository<Chapter> {
  constructor(connectionManager: ConnectionManager) {
    super(connectionManager, 'chapters');
  }

  protected mapRowToEntity(row: any): Chapter {
    return {
      id: row.id,
      project_id: row.project_id,
      plot_id: row.plot_id,
      chapter_number: row.chapter_number,
      title: row.title,
      content: row.content,
      word_count: row.word_count,
      status: row.status,
      version: row.version,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: Chapter): any[] {
    return [
      entity.id || this.generateId(),
      entity.project_id,
      entity.plot_id,
      entity.chapter_number,
      entity.title,
      entity.content,
      entity.word_count || this.calculateWordCount(entity.content),
      entity.status,
      entity.version || 1,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: Chapter): any[] {
    return [
      entity.title,
      entity.content,
      entity.word_count || this.calculateWordCount(entity.content),
      entity.status,
      entity.version || 1,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime()
    ];
  }

  private calculateWordCount(content: string): number {
    // 日本語の文字数カウント（簡易版）
    return content.replace(/\s/g, '').length;
  }

  async create(chapter: Chapter): Promise<Chapter> {
    const id = chapter.id || this.generateId();
    const sql = `
      INSERT INTO chapters (
        id, project_id, plot_id, chapter_number, title, content,
        word_count, status, version, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({ ...chapter, id });
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new NotFoundError('作成した章');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<Chapter>): Promise<Chapter> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('章');
    }

    const updated = { ...existing, ...updates };
    
    // バージョンを自動インクリメント
    if (updates.content && updates.content !== existing.content) {
      updated.version = (existing.version || 1) + 1;
    }

    const sql = `
      UPDATE chapters 
      SET title = ?, content = ?, word_count = ?, status = ?, 
          version = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundError('更新した章');
    }
    
    return result;
  }

  async findByProject(projectId: string): Promise<Chapter[]> {
    const sql = `
      SELECT * FROM chapters 
      WHERE project_id = ?
      ORDER BY chapter_number ASC
    `;
    return this.getMany(sql, [projectId]);
  }

  async findByPlot(plotId: string): Promise<Chapter[]> {
    const sql = `
      SELECT * FROM chapters 
      WHERE plot_id = ?
      ORDER BY chapter_number ASC
    `;
    return this.getMany(sql, [plotId]);
  }

  async findByStatus(projectId: string, status: Chapter['status']): Promise<Chapter[]> {
    const sql = `
      SELECT * FROM chapters 
      WHERE project_id = ? AND status = ?
      ORDER BY chapter_number ASC
    `;
    return this.getMany(sql, [projectId, status]);
  }

  async getProjectWordCount(projectId: string): Promise<number> {
    const sql = `
      SELECT SUM(word_count) as total_word_count
      FROM chapters
      WHERE project_id = ?
    `;
    const results = await this.executeQuery(sql, [projectId]);
    return results[0]?.total_word_count || 0;
  }

  async getNextChapterNumber(plotId: string): Promise<number> {
    const sql = `
      SELECT MAX(chapter_number) as max_number
      FROM chapters
      WHERE plot_id = ?
    `;
    const results = await this.executeQuery(sql, [plotId]);
    const maxNumber = results[0]?.max_number || 0;
    return maxNumber + 1;
  }
}