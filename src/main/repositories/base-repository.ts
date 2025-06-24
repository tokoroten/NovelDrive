/**
 * リポジトリの基底クラス
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseError } from '../utils/error-handler';
import { ConnectionManager } from '../core/database/connection-manager';

export interface BaseEntity {
  id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export abstract class BaseRepository<T extends BaseEntity> {
  constructor(
    protected connectionManager: ConnectionManager,
    protected tableName: string
  ) {}

  /**
   * IDの生成
   */
  protected generateId(): string {
    return uuidv4();
  }

  /**
   * 現在時刻の取得（ISO形式）
   */
  protected getCurrentTime(): string {
    return new Date().toISOString();
  }

  /**
   * SQLパラメータのエスケープ
   */
  protected escapeParam(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * 結果セットからエンティティへの変換
   */
  protected abstract mapRowToEntity(row: any): T;

  /**
   * エンティティから挿入用データへの変換
   */
  protected abstract mapEntityToInsertData(entity: T): any[];

  /**
   * エンティティから更新用データへの変換
   */
  protected abstract mapEntityToUpdateData(entity: T): any[];

  /**
   * 単一行の実行
   */
  protected async executeQuery<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    try {
      return await this.connectionManager.query<R>(sql, params);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `クエリ実行エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 単一行の取得
   */
  protected async getOne(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.executeQuery(sql, params);
    if (results.length === 0) {
      return null;
    }
    return this.mapRowToEntity(results[0]);
  }

  /**
   * 複数行の取得
   */
  protected async getMany(sql: string, params: any[] = []): Promise<T[]> {
    const results = await this.executeQuery(sql, params);
    return results.map(row => this.mapRowToEntity(row));
  }

  /**
   * IDによる取得
   */
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    return this.getOne(sql, [id]);
  }

  /**
   * 削除
   */
  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.executeQuery(sql, [id]);
  }

  /**
   * 存在チェック
   */
  async exists(id: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const results = await this.executeQuery(sql, [id]);
    return results.length > 0;
  }

  /**
   * トランザクション内で実行
   */
  async withTransaction<R>(callback: () => Promise<R>): Promise<R> {
    return this.connectionManager.transaction(async () => {
      return callback();
    });
  }
}