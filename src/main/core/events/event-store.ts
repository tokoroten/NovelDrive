/**
 * イベントストア実装
 * ドメインイベントの永続化と取得
 */

import * as duckdb from 'duckdb';
import { DomainEvent } from './event-bus';

export interface StoredEvent extends DomainEvent {
  id: number;
  storedAt: Date;
}

export class EventStore {
  constructor(private conn: duckdb.Connection) {}

  /**
   * イベントを保存
   */
  async save(event: DomainEvent): Promise<void> {
    const sql = `
      INSERT INTO domain_events (
        event_id, event_type, aggregate_id, aggregate_type,
        payload, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        event.eventId,
        event.eventType,
        event.aggregateId,
        event.aggregateType,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata),
        event.metadata.timestamp
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 複数のイベントを保存
   */
  async saveMany(events: DomainEvent[]): Promise<void> {
    await this.beginTransaction();
    
    try {
      for (const event of events) {
        await this.save(event);
      }
      await this.commit();
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * 集約のイベントを取得
   */
  async getByAggregateId(
    aggregateId: string,
    fromVersion?: number
  ): Promise<StoredEvent[]> {
    let sql = `
      SELECT * FROM domain_events 
      WHERE aggregate_id = ?
    `;
    const params: any[] = [aggregateId];

    if (fromVersion !== undefined) {
      sql += ' AND id > ?';
      params.push(fromVersion);
    }

    sql += ' ORDER BY id ASC';

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToEvent(row)));
      });
    });
  }

  /**
   * イベントタイプで取得
   */
  async getByEventType(
    eventType: string,
    options?: {
      fromId?: number;
      limit?: number;
    }
  ): Promise<StoredEvent[]> {
    let sql = 'SELECT * FROM domain_events WHERE event_type = ?';
    const params: any[] = [eventType];

    if (options?.fromId !== undefined) {
      sql += ' AND id > ?';
      params.push(options.fromId);
    }

    sql += ' ORDER BY id ASC';

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToEvent(row)));
      });
    });
  }

  /**
   * 時間範囲でイベントを取得
   */
  async getByTimeRange(
    startTime: Date,
    endTime: Date,
    options?: {
      eventTypes?: string[];
      limit?: number;
    }
  ): Promise<StoredEvent[]> {
    let sql = `
      SELECT * FROM domain_events 
      WHERE created_at >= ? AND created_at <= ?
    `;
    const params: any[] = [startTime, endTime];

    if (options?.eventTypes && options.eventTypes.length > 0) {
      sql += ` AND event_type IN (${options.eventTypes.map(() => '?').join(',')})`;
      params.push(...options.eventTypes);
    }

    sql += ' ORDER BY id ASC';

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) return reject(err);
        resolve((rows || []).map(row => this.mapRowToEvent(row)));
      });
    });
  }

  /**
   * 最新のイベントIDを取得
   */
  async getLastEventId(): Promise<number> {
    const sql = 'SELECT MAX(id) as max_id FROM domain_events';

    return new Promise((resolve, reject) => {
      this.conn.all(sql, [], (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows?.[0]?.max_id || 0);
      });
    });
  }

  private mapRowToEvent(row: any): StoredEvent {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
      storedAt: new Date(row.stored_at)
    };
  }

  private async beginTransaction(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async commit(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async rollback(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}