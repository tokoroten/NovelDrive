import { Database } from 'better-sqlite3'
import { Project } from '../../shared/types'

export class ProjectRepository {
  constructor(private db: Database) {}

  getAll(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    return stmt.all() as Project[]
  }

  getById(id: number): Project | undefined {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?')
    return stmt.get(id) as Project | undefined
  }

  create(name: string, description?: string, metadata?: any): Project {
    const stmt = this.db.prepare(`
      INSERT INTO projects (name, description, metadata)
      VALUES (?, ?, ?)
    `)
    const result = stmt.run(name, description || null, JSON.stringify(metadata || {}))
    
    return this.getById(result.lastInsertRowid as number)!
  }

  update(id: number, updates: Partial<Project>): Project | undefined {
    const fields: string[] = []
    const values: any[] = []
    
    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
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
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)
    
    return this.getById(id)
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }
}