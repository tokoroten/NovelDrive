/**
 * 設定リポジトリ
 */

import * as duckdb from 'duckdb';
import { BaseRepository } from './base-repository';

interface Setting {
  key: string;
  value: any;
  created_at?: Date;
  updated_at?: Date;
}

export class SettingsRepository {
  constructor(private conn: duckdb.Connection) {}

  private executeQuery<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as R[]);
        }
      });
    });
  }

  async get(key: string): Promise<any> {
    const sql = `SELECT value FROM settings WHERE key = ?`;
    const results = await this.executeQuery(sql, [key]);
    
    if (results.length === 0) {
      return null;
    }
    
    const value = results[0].value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO settings (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = excluded.updated_at
    `;
    
    await this.executeQuery(sql, [key, stringValue, now, now]);
  }

  async getAll(): Promise<Record<string, any>> {
    const sql = `SELECT key, value FROM settings`;
    const results = await this.executeQuery(sql);
    
    const settings: Record<string, any> = {};
    for (const row of results) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    
    return settings;
  }

  async delete(key: string): Promise<void> {
    const sql = `DELETE FROM settings WHERE key = ?`;
    await this.executeQuery(sql, [key]);
  }

  async exists(key: string): Promise<boolean> {
    const sql = `SELECT 1 FROM settings WHERE key = ? LIMIT 1`;
    const results = await this.executeQuery(sql, [key]);
    return results.length > 0;
  }
}