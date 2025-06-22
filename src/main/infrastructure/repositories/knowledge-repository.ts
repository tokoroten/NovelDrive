/**
 * 知識リポジトリ実装
 */

import { Knowledge } from '../../domain/entities';
import { IKnowledgeRepository } from '../../domain/repositories';
import { ConnectionPool, withPooledConnection } from '../../core/database/connection-pool';
import { BatchProcessor } from '../../core/async/batch-processor';
import { retry } from '../../core/async/retry';
import { EventBus } from '../../core/events/event-bus';
import { KnowledgeCreated, KnowledgeUpdated, KnowledgeDeleted } from '../../core/events/domain-events';

export class KnowledgeRepository implements IKnowledgeRepository {
  private batchProcessor: BatchProcessor<Knowledge, void>;

  constructor(
    private pool: ConnectionPool,
    private eventBus: EventBus
  ) {
    // バッチ保存プロセッサーを初期化
    this.batchProcessor = new BatchProcessor(
      (items) => this.saveBatch(items),
      {
        batchSize: 100,
        flushInterval: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        concurrency: 2
      }
    );
  }

  async findById(id: string): Promise<Knowledge | null> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM knowledge WHERE id = ?',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            const row = rows?.[0];
            if (!row) return resolve(null);
            resolve(this.mapRowToKnowledge(row));
          }
        );
      });
    });
  }

  async findByIds(ids: string[]): Promise<Knowledge[]> {
    if (ids.length === 0) return [];

    return withPooledConnection(this.pool, async (conn) => {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM knowledge WHERE id IN (${placeholders})`;

      return new Promise((resolve, reject) => {
        conn.all(sql, ids, (err, rows: any[]) => {
          if (err) return reject(err);
          resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
        });
      });
    });
  }

  async findByProjectId(projectId: string): Promise<Knowledge[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM knowledge WHERE project_id = ? ORDER BY updated_at DESC',
          [projectId],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
          }
        );
      });
    });
  }

  async findByType(type: string): Promise<Knowledge[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM knowledge WHERE type = ? ORDER BY updated_at DESC',
          [type],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
          }
        );
      });
    });
  }

  async search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
  }): Promise<Knowledge[]> {
    return withPooledConnection(this.pool, async (conn) => {
      let sql = `
        SELECT * FROM knowledge 
        WHERE (title LIKE ? OR content LIKE ?)
      `;
      const params: any[] = [`%${query}%`, `%${query}%`];

      if (options?.projectId) {
        sql += ' AND project_id = ?';
        params.push(options.projectId);
      }

      if (options?.type) {
        sql += ' AND type = ?';
        params.push(options.type);
      }

      sql += ' ORDER BY updated_at DESC';

      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      return new Promise((resolve, reject) => {
        conn.all(sql, params, (err, rows: any[]) => {
          if (err) return reject(err);
          resolve((rows || []).map(row => this.mapRowToKnowledge(row)));
        });
      });
    });
  }

  async save(knowledge: Knowledge): Promise<void> {
    // バッチプロセッサーを使用
    await this.batchProcessor.add(knowledge);
  }

  private async saveBatch(knowledgeItems: Knowledge[]): Promise<void[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.run('BEGIN TRANSACTION', async (err) => {
          if (err) return reject(err);

          try {
            const results: void[] = [];
            
            for (const knowledge of knowledgeItems) {
              const exists = await this.existsInTransaction(conn, knowledge.id);
              
              if (exists) {
                await this.updateInTransaction(conn, knowledge);
                await this.eventBus.publish(
                  new KnowledgeUpdated(knowledge.id, {
                    changes: {
                      title: knowledge.title,
                      content: knowledge.content,
                      metadata: knowledge.metadata
                    }
                  })
                );
              } else {
                await this.insertInTransaction(conn, knowledge);
                await this.eventBus.publish(
                  new KnowledgeCreated(knowledge.id, {
                    title: knowledge.title,
                    type: knowledge.type,
                    projectId: knowledge.projectId || undefined
                  })
                );
              }
              
              results.push();
            }

            conn.run('COMMIT', (err) => {
              if (err) {
                conn.run('ROLLBACK', () => reject(err));
              } else {
                resolve(results);
              }
            });
          } catch (error) {
            conn.run('ROLLBACK', () => reject(error));
          }
        });
      });
    });
  }

  async delete(id: string): Promise<void> {
    return retry(async () => {
      return withPooledConnection(this.pool, async (conn) => {
        return new Promise<void>((resolve, reject) => {
          conn.run('DELETE FROM knowledge WHERE id = ?', [id], async (err) => {
            if (err) return reject(err);
            
            await this.eventBus.publish(new KnowledgeDeleted(id));
            resolve();
          });
        });
      });
    }, { maxAttempts: 3 });
  }

  async exists(id: string): Promise<boolean> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT 1 FROM knowledge WHERE id = ? LIMIT 1',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows && rows.length > 0);
          }
        );
      });
    });
  }

  async existsByUrl(url: string): Promise<boolean> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          `SELECT 1 FROM knowledge 
           WHERE json_extract(metadata, '$.url') = ? 
           OR json_extract(metadata, '$.sourceUrl') = ? 
           LIMIT 1`,
          [url, url],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows && rows.length > 0);
          }
        );
      });
    });
  }

  private async existsInTransaction(conn: any, id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      conn.all(
        'SELECT 1 FROM knowledge WHERE id = ? LIMIT 1',
        [id],
        (err: any, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows && rows.length > 0);
        }
      );
    });
  }

  private async insertInTransaction(conn: any, knowledge: Knowledge): Promise<void> {
    const sql = `
      INSERT INTO knowledge (
        id, title, content, type, project_id, embedding, 
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId,
        knowledge.embedding ? JSON.stringify(knowledge.embedding) : null,
        JSON.stringify(knowledge.metadata),
        knowledge.createdAt.toISOString(),
        knowledge.updatedAt.toISOString()
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async updateInTransaction(conn: any, knowledge: Knowledge): Promise<void> {
    const sql = `
      UPDATE knowledge SET
        title = ?, content = ?, type = ?, project_id = ?,
        embedding = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId,
        knowledge.embedding ? JSON.stringify(knowledge.embedding) : null,
        JSON.stringify(knowledge.metadata),
        knowledge.updatedAt.toISOString(),
        knowledge.id
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private mapRowToKnowledge(row: any): Knowledge {
    return new Knowledge(
      row.id,
      row.title,
      row.content,
      row.type,
      row.project_id,
      row.embedding ? JSON.parse(row.embedding) : null,
      JSON.parse(row.metadata),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }

  async close(): Promise<void> {
    await this.batchProcessor.close();
  }
}