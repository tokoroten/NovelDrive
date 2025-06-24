/**
 * プロジェクトリポジトリ
 */

import { BaseRepository } from './base-repository';
import { Project } from './types';
import { ConnectionManager } from '../core/database/connection-manager';
import { NotFoundError } from '../utils/error-handler';

export class ProjectRepository extends BaseRepository<Project> {
  constructor(connectionManager: ConnectionManager) {
    super(connectionManager, 'projects');
  }

  protected mapRowToEntity(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      genre: row.genre,
      status: row.status,
      settings: row.settings ? JSON.parse(row.settings) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: Project): any[] {
    return [
      entity.id || this.generateId(),
      entity.name,
      entity.description || null,
      entity.genre || null,
      entity.status || 'active',
      entity.settings ? JSON.stringify(entity.settings) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: Project): any[] {
    return [
      entity.name,
      entity.description || null,
      entity.genre || null,
      entity.status || 'active',
      entity.settings ? JSON.stringify(entity.settings) : null,
      this.getCurrentTime()
    ];
  }

  async create(project: Project): Promise<Project> {
    const id = project.id || this.generateId();
    const sql = `
      INSERT INTO projects (id, name, description, genre, status, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({ ...project, id });
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new NotFoundError('作成したプロジェクト');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('プロジェクト');
    }

    const updated = { ...existing, ...updates };
    const sql = `
      UPDATE projects 
      SET name = ?, description = ?, genre = ?, status = ?, settings = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundError('更新したプロジェクト');
    }
    
    return result;
  }

  async findAll(): Promise<Project[]> {
    const sql = `
      SELECT * FROM projects 
      ORDER BY created_at DESC
    `;
    return this.getMany(sql);
  }

  async findByStatus(status: Project['status']): Promise<Project[]> {
    const sql = `
      SELECT * FROM projects 
      WHERE status = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [status]);
  }

  async getProjectStats(projectId: string): Promise<any> {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM knowledge WHERE project_id = ?) as knowledge_count,
        (SELECT COUNT(*) FROM characters WHERE project_id = ?) as character_count,
        (SELECT COUNT(*) FROM plots WHERE project_id = ?) as plot_count,
        (SELECT COUNT(*) FROM chapters WHERE project_id = ?) as chapter_count,
        (SELECT SUM(word_count) FROM chapters WHERE project_id = ?) as total_word_count
    `;
    
    const results = await this.executeQuery(sql, [projectId, projectId, projectId, projectId, projectId]);
    return results[0];
  }
}