import { Database } from 'better-sqlite3'
import { getDatabase } from '../database'

export abstract class BaseRepository {
  protected db: Database

  constructor() {
    this.db = getDatabase()
  }

  protected generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  }
}