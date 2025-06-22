/**
 * DuckDB実装のプロットリポジトリ
 */

import * as duckdb from 'duckdb';
import { Plot } from '../../../domain/entities';
import { IPlotRepository } from '../../../domain/repositories';

export class DuckDBPlotRepository implements IPlotRepository {
  constructor(private conn: duckdb.Connection) {}

  async save(plot: Plot): Promise<void> {
    const sql = `
      INSERT INTO plots (
        id, project_id, version, parent_version, title, synopsis,
        structure, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        synopsis = excluded.synopsis,
        structure = excluded.structure,
        status = excluded.status,
        updated_at = excluded.updated_at
    `;

    const structureJson = JSON.stringify(plot.structure);

    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        plot.id,
        plot.projectId,
        plot.version,
        plot.parentVersion,
        plot.title,
        plot.synopsis,
        structureJson,
        plot.status,
        plot.createdAt,
        plot.updatedAt,
        plot.createdBy
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async findById(id: string): Promise<Plot | null> {
    const sql = 'SELECT * FROM plots WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [id], (err, rows: any[]) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve(null);
        
        const row = rows[0];
        resolve(this.mapRowToPlot(row));
      });
    });
  }

  async findByProjectId(projectId: string): Promise<Plot[]> {
    const sql = 'SELECT * FROM plots WHERE project_id = ? ORDER BY created_at DESC';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [projectId], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToPlot(row)));
      });
    });
  }

  async findByVersion(projectId: string, version: string): Promise<Plot | null> {
    const sql = 'SELECT * FROM plots WHERE project_id = ? AND version = ?';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [projectId, version], (err, rows: any[]) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve(null);
        
        const row = rows[0];
        resolve(this.mapRowToPlot(row));
      });
    });
  }

  async findChildren(plotId: string): Promise<Plot[]> {
    const sql = `
      SELECT * FROM plots 
      WHERE parent_version = (SELECT version FROM plots WHERE id = ?)
      ORDER BY version
    `;
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [plotId], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToPlot(row)));
      });
    });
  }

  async delete(id: string): Promise<void> {
    const sql = 'DELETE FROM plots WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async exists(id: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM plots WHERE id = ? LIMIT 1';
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, [id], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows && rows.length > 0);
      });
    });
  }

  private mapRowToPlot(row: any): Plot {
    return new Plot(
      row.id,
      row.project_id,
      row.version,
      row.parent_version,
      row.title,
      row.synopsis,
      JSON.parse(row.structure),
      row.status,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.created_by || 'unknown'
    );
  }
}