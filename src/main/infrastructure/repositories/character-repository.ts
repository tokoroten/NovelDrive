/**
 * キャラクターリポジトリ実装
 */

import { Character } from '../../domain/entities';
import { ICharacterRepository } from '../../domain/repositories';
import { ConnectionPool, withPooledConnection } from '../../core/database/connection-pool';
import { BatchProcessor } from '../../core/async/batch-processor';
import { EventBus } from '../../core/events/event-bus';

export class CharacterRepository implements ICharacterRepository {
  private batchProcessor: BatchProcessor<Character, void>;

  constructor(
    private pool: ConnectionPool,
    private eventBus: EventBus
  ) {
    // バッチ保存プロセッサーを初期化
    this.batchProcessor = new BatchProcessor(
      (items) => this.saveBatch(items),
      {
        batchSize: 50,
        flushInterval: 3000,
        maxRetries: 3,
        retryDelay: 500
      }
    );
  }

  async findById(id: string): Promise<Character | null> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM characters WHERE id = ?',
          [id],
          (err, rows: any[]) => {
            if (err) return reject(err);
            const row = rows?.[0];
            if (!row) return resolve(null);
            resolve(this.mapRowToCharacter(row));
          }
        );
      });
    });
  }

  async findByProjectId(projectId: string): Promise<Character[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM characters WHERE project_id = ? ORDER BY name',
          [projectId],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToCharacter(row)));
          }
        );
      });
    });
  }

  async findByRole(projectId: string, role: string): Promise<Character[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM characters WHERE project_id = ? AND role = ? ORDER BY name',
          [projectId, role],
          (err, rows: any[]) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => this.mapRowToCharacter(row)));
          }
        );
      });
    });
  }

  async findByName(projectId: string, name: string): Promise<Character | null> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.all(
          'SELECT * FROM characters WHERE project_id = ? AND name = ? LIMIT 1',
          [projectId, name],
          (err, rows: any[]) => {
            if (err) return reject(err);
            const row = rows?.[0];
            if (!row) return resolve(null);
            resolve(this.mapRowToCharacter(row));
          }
        );
      });
    });
  }

  async save(character: Character): Promise<void> {
    await this.batchProcessor.add(character);
  }

  private async saveBatch(characters: Character[]): Promise<void[]> {
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise((resolve, reject) => {
        conn.run('BEGIN TRANSACTION', async (err) => {
          if (err) return reject(err);

          try {
            const results: void[] = [];
            
            for (const character of characters) {
              const exists = await this.existsInTransaction(conn, character.id);
              
              if (exists) {
                await this.updateInTransaction(conn, character);
              } else {
                await this.insertInTransaction(conn, character);
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
    return withPooledConnection(this.pool, async (conn) => {
      return new Promise<void>((resolve, reject) => {
        conn.run('DELETE FROM characters WHERE id = ?', [id], (err) => {
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
          'SELECT 1 FROM characters WHERE id = ? LIMIT 1',
          [id],
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
        'SELECT 1 FROM characters WHERE id = ? LIMIT 1',
        [id],
        (err: any, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows && rows.length > 0);
        }
      );
    });
  }

  private async insertInTransaction(conn: any, character: Character): Promise<void> {
    const sql = `
      INSERT INTO characters (
        id, project_id, name, role, age, gender, personality,
        background, appearance, relationships, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        character.id,
        character.projectId,
        character.name,
        character.role,
        character.age,
        character.gender,
        JSON.stringify(character.personality),
        character.background,
        JSON.stringify(character.appearance),
        JSON.stringify(character.relationships),
        JSON.stringify(character.metadata),
        character.createdAt.toISOString(),
        character.updatedAt.toISOString()
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async updateInTransaction(conn: any, character: Character): Promise<void> {
    const sql = `
      UPDATE characters SET
        name = ?, role = ?, age = ?, gender = ?, personality = ?,
        background = ?, appearance = ?, relationships = ?,
        metadata = ?, updated_at = ?
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, [
        character.name,
        character.role,
        character.age,
        character.gender,
        JSON.stringify(character.personality),
        character.background,
        JSON.stringify(character.appearance),
        JSON.stringify(character.relationships),
        JSON.stringify(character.metadata),
        character.updatedAt.toISOString(),
        character.id
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private mapRowToCharacter(row: any): Character {
    return new Character(
      row.id,
      row.project_id,
      row.name,
      row.role,
      row.age,
      row.gender,
      JSON.parse(row.personality),
      row.background,
      JSON.parse(row.appearance),
      JSON.parse(row.relationships),
      JSON.parse(row.metadata),
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }

  async close(): Promise<void> {
    await this.batchProcessor.close();
  }
}