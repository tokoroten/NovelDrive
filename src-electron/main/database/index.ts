import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { getLogger } from '../utils/logger'

const logger = getLogger('database')

export interface DatabaseInstance {
  db: Database.Database
}

let dbInstance: Database.Database | null = null

export async function createDatabase(): Promise<DatabaseInstance> {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'database', 'noveldrive.db')
  
  logger.info(`Opening database at: ${dbPath}`)
  
  const db = new Database(dbPath)
  dbInstance = db
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON')
  
  // Initialize schema
  const schemaPath = join(__dirname, '../../../src/main/database/schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')
  
  try {
    db.exec(schema)
    logger.info('Database schema initialized')
  } catch (error) {
    logger.error('Failed to initialize database schema:', error)
    throw error
  }
  
  return { db }
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }
  return dbInstance
}