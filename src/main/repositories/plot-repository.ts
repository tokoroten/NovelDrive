/**
 * プロットリポジトリ
 */

import * as duckdb from 'duckdb';
import { BaseRepository } from './base-repository';
import { Plot } from './types';

export class PlotRepository extends BaseRepository<Plot> {
  constructor(conn: duckdb.Connection) {
    super(conn, 'plots');
  }

  protected mapRowToEntity(row: any): Plot {
    return {
      id: row.id,
      project_id: row.project_id,
      version: row.version,
      parent_version: row.parent_version,
      title: row.title,
      synopsis: row.synopsis,
      structure: row.structure ? JSON.parse(row.structure) : {},
      status: row.status,
      created_by: row.created_by,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: Plot): any[] {
    return [
      entity.id || this.generateId(),
      entity.project_id,
      entity.version,
      entity.parent_version || null,
      entity.title,
      entity.synopsis,
      JSON.stringify(entity.structure),
      entity.status,
      entity.created_by,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: Plot): any[] {
    return [
      entity.title,
      entity.synopsis,
      JSON.stringify(entity.structure),
      entity.status,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime()
    ];
  }

  async create(plot: Plot): Promise<Plot> {
    const id = plot.id || this.generateId();
    const sql = `
      INSERT INTO plots (
        id, project_id, version, parent_version, title, synopsis,
        structure, status, created_by, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({ ...plot, id });
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create plot');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<Plot>): Promise<Plot> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Plot not found');
    }

    const updated = { ...existing, ...updates };
    const sql = `
      UPDATE plots 
      SET title = ?, synopsis = ?, structure = ?, status = ?, 
          metadata = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new Error('Failed to update plot');
    }
    
    return result;
  }

  async findByProject(projectId: string): Promise<Plot[]> {
    const sql = `
      SELECT * FROM plots 
      WHERE project_id = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [projectId]);
  }

  async findByStatus(projectId: string, status: Plot['status']): Promise<Plot[]> {
    const sql = `
      SELECT * FROM plots 
      WHERE project_id = ? AND status = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [projectId, status]);
  }

  async findByVersion(projectId: string, version: string): Promise<Plot | null> {
    const sql = `
      SELECT * FROM plots 
      WHERE project_id = ? AND version = ?
      LIMIT 1
    `;
    return this.getOne(sql, [projectId, version]);
  }

  async getVersionTree(projectId: string): Promise<Plot[]> {
    const sql = `
      WITH RECURSIVE plot_tree AS (
        SELECT * FROM plots 
        WHERE project_id = ? AND parent_version IS NULL
        
        UNION ALL
        
        SELECT p.* FROM plots p
        INNER JOIN plot_tree pt ON p.parent_version = pt.version
        WHERE p.project_id = ?
      )
      SELECT * FROM plot_tree
      ORDER BY created_at ASC
    `;
    return this.getMany(sql, [projectId, projectId]);
  }

  async getLatestVersion(projectId: string): Promise<Plot | null> {
    const sql = `
      SELECT * FROM plots 
      WHERE project_id = ? AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const approved = await this.getOne(sql, [projectId]);
    
    if (approved) {
      return approved;
    }
    
    // 承認済みがない場合は最新のドラフトを返す
    const draftSql = `
      SELECT * FROM plots 
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return this.getOne(draftSql, [projectId]);
  }
}