/**
 * プロジェクトリポジトリ実装
 */

import { Project } from '../../domain/entities';
import { IProjectRepository } from '../../domain/repositories';
import { ConnectionPool, withPooledConnection } from '../../core/database/connection-pool';
import { retry } from '../../core/async/retry';
import { EventBus } from '../../core/events/event-bus';

export class ProjectRepository implements IProjectRepository {
  constructor(
    private pool: ConnectionPool,
    private eventBus: EventBus
  ) {}

  async findById(id: string): Promise<Project | null> {
    return retry(async () => {
      return withPooledConnection(this.pool, async (conn) => {
        return new Promise<Project | null>((resolve, reject) => {
          conn.all(
            'SELECT * FROM projects WHERE id = ?',
            [id],
            (err, rows: any[]) => {
              if (err) return reject(err);
              const row = rows?.[0];
              if (!row) return resolve(null);
              resolve(this.mapRowToProject(row));
            }
          );
        });
      });
    }, { maxAttempts: 3 });
  }

  async findAll(): Promise<Project[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM projects ORDER BY updated_at DESC',
          [],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToProject(row)));
          }
        );
      });
    });
  }

  async findByStatus(status: string): Promise<Project[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC',
          [status],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToProject(row)));
          }
        );
      });
    });
  }

  async save(project: Project): Promise<void> {
    return retry(async () => {
      return withPooledConnection(this.pool, async (conn) => {
        const exists = await this.exists(project.id);
        
        return new Promise<void>((resolve, reject) => {
          const sql = exists
            ? `UPDATE projects SET
                name = ?, description = ?, genre = ?, target_audience = ?,
                writing_style = ?, themes = ?, metadata = ?, status = ?,
                updated_at = ?
               WHERE id = ?`
            : `INSERT INTO projects (
                id, name, description, genre, target_audience,
                writing_style, themes, metadata, status,
                created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          const params = exists
            ? [
                project.name,
                project.description,
                project.genre,
                project.targetAudience,
                project.writingStyle,
                JSON.stringify(project.themes),
                JSON.stringify(project.metadata),
                project.status,
                project.updatedAt.toISOString(),
                project.id
              ]
            : [
                project.id,
                project.name,
                project.description,
                project.genre,
                project.targetAudience,
                project.writingStyle,
                JSON.stringify(project.themes),
                JSON.stringify(project.metadata),
                project.status,
                project.createdAt.toISOString(),
                project.updatedAt.toISOString()
              ];

          conn.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }, { maxAttempts: 3 });
  }

  async delete(id: string): Promise<void> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise<void>((resolve, reject) => {
        conn.run('DELETE FROM projects WHERE id = ?', [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  async exists(id: string): Promise<boolean> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT 1 FROM projects WHERE id = ? LIMIT 1',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows && rows.length > 0);
          }
        );
      });
    });
  }

  private mapRowToProject(row: any): Project {
    return new Project(
      row.id,
      row.name,
      row.description,
      row.genre,
      row.target_audience,
      row.writing_style,
      JSON.parse(row.themes),
      JSON.parse(row.metadata),
      row.status,
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}