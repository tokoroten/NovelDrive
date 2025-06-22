/**
 * プロットリポジトリ実装
 */

import { Plot } from '../../domain/entities';
import { IPlotRepository } from '../../domain/repositories';
import { ConnectionPool, withPooledConnection } from '../../core/database/connection-pool';
import { retry } from '../../core/async/retry';
import { EventBus } from '../../core/events/event-bus';
import { PlotCreated, PlotForked, PlotStatusChanged } from '../../core/events/domain-events';

export class PlotRepository implements IPlotRepository {
  constructor(
    private pool: ConnectionPool,
    private eventBus: EventBus
  ) {}

  async findById(id: string): Promise<Plot | null> {
    return retry(async () => {
      return withPooledConnection(this.pool, async (conn) => {
        return new Promise<Plot | null>((resolve, reject) => {
          conn.all(
            'SELECT * FROM plots WHERE id = ?',
            [id],
            (err, rows: any[]) => {
              if (err) return reject(err);
              const row = rows?.[0];
              if (!row) return resolve(null);
              resolve(this.mapRowToPlot(row));
            }
          );
        });
      });
    }, { maxAttempts: 3 });
  }

  async findByProjectId(projectId: string): Promise<Plot[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM plots WHERE project_id = ? ORDER BY created_at DESC',
          [projectId],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToPlot(row)));
          }
        );
      });
    });
  }

  async findByStatus(status: string): Promise<Plot[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM plots WHERE status = ? ORDER BY updated_at DESC',
          [status],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToPlot(row)));
          }
        );
      });
    });
  }

  async findByVersion(projectId: string, version: string): Promise<Plot | null> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM plots WHERE project_id = ? AND version = ? LIMIT 1',
          [projectId, version],
          (err, rows: any[]) => {
            if (err) return reject(err);
            const row = rows?.[0];
            if (!row) return resolve(null);
            resolve(this.mapRowToPlot(row));
          }
        );
      });
    });
  }

  async findChildren(parentId: string): Promise<Plot[]> {
    return withPooledConnection(this.pool, async (conn) => {
      const sql = `
        SELECT p.* FROM plots p
        WHERE p.parent_version = (
          SELECT version FROM plots WHERE id = ?
        )
        ORDER BY p.created_at ASC
      `;

      return new Promise((resolve, reject) => {
        conn.all(sql, [parentId], (err, rows: any[]) => {
          if (err) return reject(err);
          resolve((rows || []).map(row => this.mapRowToPlot(row)));
        });
      });
    });
  }

  async save(plot: Plot): Promise<void> {
    return retry(async () => {
      return withPooledConnection(this.pool, async (conn) => {
        const exists = await this.exists(plot.id);
        
        return new Promise<void>((resolve, reject) => {
          conn.run('BEGIN TRANSACTION', async (err) => {
            if (err) return reject(err);

            try {
              if (exists) {
                // 更新前の状態を取得
                const oldPlot = await this.findById(plot.id);
                
                await this.updateInTransaction(conn, plot);
                
                // ステータス変更イベントを発行
                if (oldPlot && oldPlot.status !== plot.status) {
                  await this.eventBus.publish(
                    new PlotStatusChanged(plot.id, {
                      oldStatus: oldPlot.status,
                      newStatus: plot.status
                    })
                  );
                }
              } else {
                await this.insertInTransaction(conn, plot);
                
                // 作成イベントを発行
                if (plot.parentVersion) {
                  await this.eventBus.publish(
                    new PlotForked(plot.id, {
                      parentPlotId: '', // TODO: 親IDの取得
                      parentVersion: plot.parentVersion,
                      newVersion: plot.version
                    })
                  );
                } else {
                  await this.eventBus.publish(
                    new PlotCreated(plot.id, {
                      projectId: plot.projectId,
                      version: plot.version,
                      title: plot.title
                    })
                  );
                }
              }

              conn.run('COMMIT', (err) => {
                if (err) {
                  conn.run('ROLLBACK', () => reject(err));
                } else {
                  resolve();
                }
              });
            } catch (error) {
              conn.run('ROLLBACK', () => reject(error));
            }
          });
        });
      });
    }, { 
      maxAttempts: 3,
      shouldRetry: (error) => {
        // データベースロックエラーの場合はリトライ
        const message = error?.message || '';
        return message.includes('SQLITE_BUSY') || message.includes('database is locked');
      }
    });
  }

  async delete(id: string): Promise<void> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise<void>((resolve, reject) => {
        conn.run('DELETE FROM plots WHERE id = ?', [id], (err) => {
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
          'SELECT 1 FROM plots WHERE id = ? LIMIT 1',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows && rows.length > 0);
          }
        );
      });
    });
  }

  async getVersionTree(projectId: string): Promise<any> {
    const plots = await this.findByProjectId(projectId);
    return this.buildVersionTree(plots);
  }

  private buildVersionTree(plots: Plot[]): any {
    const plotMap = new Map(plots.map(p => [p.version, p]));
    const roots: any[] = [];
    const children = new Map<string, any[]>();

    // 親子関係を構築
    for (const plot of plots) {
      if (!plot.parentVersion) {
        roots.push(plot);
      } else {
        if (!children.has(plot.parentVersion)) {
          children.set(plot.parentVersion, []);
        }
        children.get(plot.parentVersion)!.push(plot);
      }
    }

    // ツリーを構築
    const buildNode = (plot: Plot): any => {
      const node: any = {
        id: plot.id,
        version: plot.version,
        title: plot.title,
        status: plot.status,
        createdAt: plot.createdAt,
        createdBy: plot.createdBy,
        children: []
      };

      const plotChildren = children.get(plot.version) || [];
      node.children = plotChildren.map(child => buildNode(child));

      return node;
    };

    return roots.map(root => buildNode(root));
  }

  private async insertInTransaction(conn: any, plot: Plot): Promise<void> {
    const sql = `
      INSERT INTO plots (
        id, project_id, version, parent_version, title, synopsis,
        structure, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        plot.id,
        plot.projectId,
        plot.version,
        plot.parentVersion,
        plot.title,
        plot.synopsis,
        JSON.stringify(plot.structure),
        plot.status,
        plot.createdAt.toISOString(),
        plot.updatedAt.toISOString(),
        plot.createdBy
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async updateInTransaction(conn: any, plot: Plot): Promise<void> {
    const sql = `
      UPDATE plots SET
        title = ?, synopsis = ?, structure = ?,
        status = ?, updated_at = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        plot.title,
        plot.synopsis,
        JSON.stringify(plot.structure),
        plot.status,
        plot.updatedAt.toISOString(),
        plot.id
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
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
      row.created_by
    );
  }
}