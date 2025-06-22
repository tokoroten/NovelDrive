/**
 * ディスカッションリポジトリ
 */

import * as duckdb from 'duckdb';
import { BaseRepository } from './base-repository';
import { AgentDiscussion, AgentMessage } from './types';

export class DiscussionRepository extends BaseRepository<AgentDiscussion> {
  constructor(conn: duckdb.Connection) {
    super(conn, 'agent_discussions');
  }

  protected mapRowToEntity(row: any): AgentDiscussion {
    return {
      id: row.id,
      project_id: row.project_id,
      plot_id: row.plot_id,
      chapter_id: row.chapter_id,
      topic: row.topic,
      status: row.status,
      thread_id: row.thread_id,
      participants: row.participants ? JSON.parse(row.participants) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    };
  }

  protected mapEntityToInsertData(entity: AgentDiscussion): any[] {
    return [
      entity.id || this.generateId(),
      entity.project_id || null,
      entity.plot_id || null,
      entity.chapter_id || null,
      entity.topic,
      entity.status,
      entity.thread_id,
      JSON.stringify(entity.participants),
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
  }

  protected mapEntityToUpdateData(entity: AgentDiscussion): any[] {
    return [
      entity.topic,
      entity.status,
      JSON.stringify(entity.participants),
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      this.getCurrentTime()
    ];
  }

  async create(discussion: AgentDiscussion): Promise<AgentDiscussion> {
    const id = discussion.id || this.generateId();
    const sql = `
      INSERT INTO agent_discussions (
        id, project_id, plot_id, chapter_id, topic, status,
        thread_id, participants, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = this.mapEntityToInsertData({ ...discussion, id });
    await this.executeQuery(sql, data);
    
    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create discussion');
    }
    
    return created;
  }

  async update(id: string, updates: Partial<AgentDiscussion>): Promise<AgentDiscussion> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Discussion not found');
    }

    const updated = { ...existing, ...updates };
    const sql = `
      UPDATE agent_discussions 
      SET topic = ?, status = ?, participants = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `;
    
    const data = [...this.mapEntityToUpdateData(updated), id];
    await this.executeQuery(sql, data);
    
    const result = await this.findById(id);
    if (!result) {
      throw new Error('Failed to update discussion');
    }
    
    return result;
  }

  async findByProject(projectId: string): Promise<AgentDiscussion[]> {
    const sql = `
      SELECT * FROM agent_discussions 
      WHERE project_id = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [projectId]);
  }

  async findByStatus(status: AgentDiscussion['status']): Promise<AgentDiscussion[]> {
    const sql = `
      SELECT * FROM agent_discussions 
      WHERE status = ?
      ORDER BY created_at DESC
    `;
    return this.getMany(sql, [status]);
  }

  async addMessage(message: AgentMessage): Promise<AgentMessage> {
    const id = message.id || this.generateId();
    const sql = `
      INSERT INTO agent_messages (
        id, discussion_id, agent_role, agent_name, message,
        message_type, metadata, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const data = [
      id,
      message.discussion_id,
      message.agent_role,
      message.agent_name || null,
      message.message,
      message.message_type,
      message.metadata ? JSON.stringify(message.metadata) : null,
      this.getCurrentTime(),
      this.getCurrentTime()
    ];
    
    await this.executeQuery(sql, data);
    
    return { ...message, id };
  }

  async getMessages(discussionId: string): Promise<AgentMessage[]> {
    const sql = `
      SELECT * FROM agent_messages 
      WHERE discussion_id = ?
      ORDER BY created_at ASC
    `;
    
    const results = await this.executeQuery(sql, [discussionId]);
    
    return results.map(row => ({
      id: row.id,
      discussion_id: row.discussion_id,
      agent_role: row.agent_role,
      agent_name: row.agent_name,
      message: row.message,
      message_type: row.message_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined
    }));
  }

  async getMessageCount(discussionId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count
      FROM agent_messages
      WHERE discussion_id = ?
    `;
    const results = await this.executeQuery(sql, [discussionId]);
    return results[0]?.count || 0;
  }
}