/**
 * 世界設定リポジトリ実装
 */

import { WorldSetting } from '../../domain/entities';
import { IWorldSettingRepository } from '../../domain/repositories';
import { ConnectionPool, withPooledConnection } from '../../core/database/connection-pool';
import { EventBus } from '../../core/events/event-bus';

export class WorldSettingRepository implements IWorldSettingRepository {
  constructor(
    private pool: ConnectionPool,
    private eventBus: EventBus
  ) {}

  async findById(id: string): Promise<WorldSetting | null> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM world_settings WHERE id = ?',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            const row = rows?.[0];
            if (!row) return resolve(null);
            resolve(this.mapRowToWorldSetting(row));
          }
        );
      });
    });
  }

  async findByProjectId(projectId: string): Promise<WorldSetting[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM world_settings WHERE project_id = ? ORDER BY category, name',
          [projectId],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToWorldSetting(row)));
          }
        );
      });
    });
  }

  async findByCategory(projectId: string, category: string): Promise<WorldSetting[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM world_settings WHERE project_id = ? AND category = ? ORDER BY name',
          [projectId, category],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToWorldSetting(row)));
          }
        );
      });
    });
  }

  async save(worldSetting: WorldSetting): Promise<void> {
    return withPooledConnection(this.pool, async (conn) => {
      const exists = await this.exists(worldSetting.id);
      
      return new Promise<void>((resolve, reject) => {
        const sql = exists
          ? `UPDATE world_settings SET
              name = ?, category = ?, description = ?, rules = ?,
              metadata = ?, updated_at = ?
             WHERE id = ?`
          : `INSERT INTO world_settings (
              id, project_id, name, category, description, rules,
              metadata, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = exists
          ? [
              worldSetting.name,
              worldSetting.category,
              worldSetting.description,
              JSON.stringify(worldSetting.rules),
              JSON.stringify(worldSetting.metadata),
              worldSetting.updatedAt.toISOString(),
              worldSetting.id
            ]
          : [
              worldSetting.id,
              worldSetting.projectId,
              worldSetting.name,
              worldSetting.category,
              worldSetting.description,
              JSON.stringify(worldSetting.rules),
              JSON.stringify(worldSetting.metadata),
              worldSetting.createdAt.toISOString(),
              worldSetting.updatedAt.toISOString()
            ];

        conn.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async delete(id: string): Promise<void> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise<void>((resolve, reject) => {
        conn.run('DELETE FROM world_settings WHERE id = ?', [id], (err) => {
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
          'SELECT 1 FROM world_settings WHERE id = ? LIMIT 1',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows && rows.length > 0);
          }
        );
      });
    });
  }

  private mapRowToWorldSetting(row: any): WorldSetting {
    return new WorldSetting(
      row.id,
      row.project_id,
      row.name,
      row.category,
      row.description,
      JSON.parse(row.rules),
      JSON.parse(row.metadata),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}