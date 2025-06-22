/**
 * キャラクターリポジトリ
 */

import * as duckdb from 'duckdb';
import { BaseRepository } from './base-repository';
import { Character } from './types';

export class CharacterRepository extends BaseRepository<Character> {
  constructor(conn: duckdb.Connection) {
    super(conn, 'characters');
  }

  protected mapRowToEntity(row: any): Character {
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      profile: row.profile,
      personality: row.personality,
      speech_style: row.speech_style,
      background: row.background,
      dialogue_samples: row.dialogue_samples,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: Character): any[] {
    return [
      entity.id || this.generateId(),
      entity.project_id,
      entity.name,
      entity.profile || null,
      entity.personality || null,
      entity.speech_style || null,
      entity.background || null,
      entity.dialogue_samples || null,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: Character): any[] {
    return [
      entity.name,
      entity.profile || null,
      entity.personality || null,
      entity.speech_style || null,
      entity.background || null,
      entity.dialogue_samples || null,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime()
    ];
  }

  async create(character: Character): Promise<Character> {
    const id = character.id || this.generateId();
    const sql = `
      INSERT INTO characters (
        id, project_id, name, profile, personality, speech_style,
        background, dialogue_samples, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({ ...character, id });
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create character');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<Character>): Promise<Character> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Character not found');
    }

    const updated = { ...existing, ...updates };
    const sql = `
      UPDATE characters 
      SET name = ?, profile = ?, personality = ?, speech_style = ?,
          background = ?, dialogue_samples = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new Error('Failed to update character');
    }
    
    return result;
  }

  async findByProject(projectId: string): Promise<Character[]> {
    const sql = `
      SELECT * FROM characters 
      WHERE project_id = ?
      ORDER BY name ASC
    `;
    return this.getMany(sql, [projectId]);
  }

  async findByName(projectId: string, name: string): Promise<Character | null> {
    const sql = `
      SELECT * FROM characters 
      WHERE project_id = ? AND name = ?
      LIMIT 1
    `;
    return this.getOne(sql, [projectId, name]);
  }

  async getCharacterRelationships(characterId: string): Promise<any[]> {
    // キャラクター関係の取得（将来的に実装）
    return [];
  }
}