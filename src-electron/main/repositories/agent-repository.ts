import { BaseRepository } from './base-repository'
import { Agent, AgentSession, AgentMessage, PlotElement } from '../../../shared/types/agent'
import { getLogger } from '../utils/logger'

const logger = getLogger('agent-repository')

export class AgentRepository extends BaseRepository {
  constructor() {
    super()
    this.createTables()
  }

  private createTables(): void {
    // Agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        personality TEXT,
        enabled INTEGER DEFAULT 1,
        custom_instructions TEXT,
        model TEXT,
        temperature REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Agent sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        participants TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        status TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Agent messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `)

    // Plot elements table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plot_elements (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_messages_agent ON agent_messages(agent_id);
      CREATE INDEX IF NOT EXISTS idx_plot_elements_project ON plot_elements(project_id);
    `)

    logger.info('Agent tables created successfully')
  }

  // Agent methods
  createAgent(agent: Omit<Agent, 'id'>): Agent {
    const id = this.generateId('agent')
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, type, description, personality, enabled, custom_instructions, model, temperature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      agent.name,
      agent.type,
      agent.description || null,
      agent.personality || null,
      agent.enabled ? 1 : 0,
      agent.customInstructions || null,
      agent.model || null,
      agent.temperature || null
    )

    logger.info(`Created agent: ${id}`)
    return { ...agent, id }
  }

  getAgent(id: string): Agent | undefined {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    const row = stmt.get(id)
    
    if (!row) return undefined
    
    return this.mapRowToAgent(row)
  }

  getAllAgents(): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at')
    const rows = stmt.all()
    
    return rows.map(row => this.mapRowToAgent(row))
  }

  updateAgent(id: string, updates: Partial<Agent>): Agent | undefined {
    const fields: string[] = []
    const values: any[] = []
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id') {
        const dbField = this.camelToSnake(key)
        fields.push(`${dbField} = ?`)
        values.push(value)
      }
    })
    
    if (fields.length === 0) return this.getAgent(id)
    
    values.push(id)
    const stmt = this.db.prepare(`
      UPDATE agents 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    
    stmt.run(...values)
    logger.info(`Updated agent: ${id}`)
    
    return this.getAgent(id)
  }

  deleteAgent(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?')
    const result = stmt.run(id)
    
    logger.info(`Deleted agent: ${id}`)
    return result.changes > 0
  }

  // Session methods
  createSession(session: Omit<AgentSession, 'id'>): AgentSession {
    const id = this.generateId('session')
    const stmt = this.db.prepare(`
      INSERT INTO agent_sessions (id, project_id, type, participants, start_time, end_time, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      session.projectId,
      session.type,
      JSON.stringify(session.participants),
      session.startTime.toISOString(),
      session.endTime?.toISOString() || null,
      session.status,
      session.metadata ? JSON.stringify(session.metadata) : null
    )

    logger.info(`Created session: ${id}`)
    return { ...session, id }
  }

  getSession(id: string): AgentSession | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_sessions WHERE id = ?')
    const row = stmt.get(id)
    
    if (!row) return undefined
    
    return this.mapRowToSession(row)
  }

  getSessionsByProject(projectId: number): AgentSession[] {
    const stmt = this.db.prepare('SELECT * FROM agent_sessions WHERE project_id = ? ORDER BY start_time DESC')
    const rows = stmt.all(projectId)
    
    return rows.map(row => this.mapRowToSession(row))
  }

  updateSession(id: string, updates: Partial<AgentSession>): AgentSession | undefined {
    const fields: string[] = []
    const values: any[] = []
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id') {
        const dbField = this.camelToSnake(key)
        if (key === 'participants') {
          fields.push(`${dbField} = ?`)
          values.push(JSON.stringify(value))
        } else if (key === 'startTime' || key === 'endTime') {
          fields.push(`${dbField} = ?`)
          values.push(value ? new Date(value as string | number | Date).toISOString() : null)
        } else if (key === 'metadata') {
          fields.push(`${dbField} = ?`)
          values.push(value ? JSON.stringify(value) : null)
        } else {
          fields.push(`${dbField} = ?`)
          values.push(value)
        }
      }
    })
    
    if (fields.length === 0) return this.getSession(id)
    
    values.push(id)
    const stmt = this.db.prepare(`
      UPDATE agent_sessions 
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    
    stmt.run(...values)
    logger.info(`Updated session: ${id}`)
    
    return this.getSession(id)
  }

  // Message methods
  createMessage(message: Omit<AgentMessage, 'id'>): AgentMessage {
    const id = this.generateId('msg')
    const stmt = this.db.prepare(`
      INSERT INTO agent_messages (id, session_id, agent_id, content, type, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      message.sessionId,
      message.agentId,
      message.content,
      message.type,
      message.timestamp.toISOString(),
      message.metadata ? JSON.stringify(message.metadata) : null
    )

    logger.info(`Created message: ${id}`)
    return { ...message, id }
  }

  getMessagesBySession(sessionId: string): AgentMessage[] {
    const stmt = this.db.prepare('SELECT * FROM agent_messages WHERE session_id = ? ORDER BY timestamp')
    const rows = stmt.all(sessionId)
    
    return rows.map(row => this.mapRowToMessage(row))
  }

  // Plot element methods
  createPlotElement(element: Omit<PlotElement, 'id' | 'createdAt' | 'updatedAt'>): PlotElement {
    const id = this.generateId('plot')
    const now = new Date()
    const stmt = this.db.prepare(`
      INSERT INTO plot_elements (id, project_id, session_id, type, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
      element.projectId,
      element.sessionId,
      element.type,
      element.content,
      element.metadata ? JSON.stringify(element.metadata) : null
    )

    logger.info(`Created plot element: ${id}`)
    return { ...element, id, createdAt: now, updatedAt: now }
  }

  getPlotElementsByProject(projectId: number): PlotElement[] {
    const stmt = this.db.prepare('SELECT * FROM plot_elements WHERE project_id = ? ORDER BY created_at')
    const rows = stmt.all(projectId)
    
    return rows.map(row => this.mapRowToPlotElement(row))
  }

  // Helper methods
  private mapRowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      personality: row.personality,
      enabled: row.enabled === 1,
      customInstructions: row.custom_instructions,
      model: row.model,
      temperature: row.temperature
    }
  }

  private mapRowToSession(row: any): AgentSession {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      participants: JSON.parse(row.participants),
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }

  private mapRowToMessage(row: any): AgentMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      agentId: row.agent_id,
      content: row.content,
      type: row.type,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }

  private mapRowToPlotElement(row: any): PlotElement {
    return {
      id: row.id,
      projectId: row.project_id,
      sessionId: row.session_id,
      type: row.type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }


}