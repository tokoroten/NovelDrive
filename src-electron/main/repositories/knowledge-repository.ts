import { Database } from 'better-sqlite3'
import { Knowledge } from '../../shared/types'

export class KnowledgeRepository {
  constructor(private db: Database) {}

  listByProject(projectId: number): Knowledge[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `)
    return stmt.all(projectId) as Knowledge[]
  }

  getById(id: number | string): Knowledge | undefined {
    const stmt = this.db.prepare('SELECT * FROM knowledge WHERE id = ?')
    return stmt.get(id) as Knowledge | undefined
  }

  create(data: {
    project_id: number
    type: 'text' | 'url' | 'image' | 'note'
    title?: string
    content: string
    embeddings?: number[]
    metadata?: any
  }): Knowledge {
    const stmt = this.db.prepare(`
      INSERT INTO knowledge (project_id, type, title, content, embeddings, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      data.project_id,
      data.type,
      data.title || null,
      data.content,
      data.embeddings ? JSON.stringify(data.embeddings) : null,
      data.metadata ? JSON.stringify(data.metadata) : null
    )
    
    return this.getById(result.lastInsertRowid as number)!
  }

  update(id: number, updates: Partial<Knowledge>): Knowledge | undefined {
    const fields: string[] = []
    const values: any[] = []
    
    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
    }
    
    if (updates.content !== undefined) {
      fields.push('content = ?')
      values.push(updates.content)
    }
    
    if (updates.embeddings !== undefined) {
      fields.push('embeddings = ?')
      values.push(updates.embeddings)
    }
    
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?')
      values.push(updates.metadata)
    }
    
    if (fields.length === 0) {
      return this.getById(id)
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    
    const stmt = this.db.prepare(`
      UPDATE knowledge 
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)
    
    return this.getById(id)
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM knowledge WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  search(projectId: number, query: string, limit: number = 10): Knowledge[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge 
      WHERE project_id = ? AND (
        title LIKE ? OR 
        content LIKE ?
      )
      ORDER BY created_at DESC
      LIMIT ?
    `)
    
    const searchTerm = `%${query}%`
    return stmt.all(projectId, searchTerm, searchTerm, limit) as Knowledge[]
  }
}