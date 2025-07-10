import { BaseRepository } from '../repositories/base-repository'
import { localEmbeddingService } from './local-embedding-service'
import { getLogger } from '../utils/logger'

const logger = getLogger('vector-search-service')

export interface VectorDocument {
  id: string
  entityType: 'knowledge' | 'chapter' | 'character' | 'plot'
  entityId: string
  projectId: number
  content: string
  vector: number[]
  magnitude: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface SearchOptions {
  limit?: number
  minSimilarity?: number
  entityTypes?: string[]
  excludeIds?: string[]
  searchMode?: 'exact' | 'similar' | 'serendipity'
}

export interface SearchResult {
  id: string
  entityType: string
  entityId: string
  content: string
  similarity: number
  metadata?: Record<string, any>
}

export class VectorSearchService extends BaseRepository {
  private cache: Map<string, number[]> = new Map()
  private maxCacheSize = 1000

  constructor() {
    super()
    this.createTables()
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_index (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        vector TEXT NOT NULL,
        magnitude REAL NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vector_project ON vector_index(project_id);
      CREATE INDEX IF NOT EXISTS idx_vector_entity ON vector_index(entity_type, entity_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vector_unique ON vector_index(entity_type, entity_id, project_id);
    `)

    logger.info('Vector search tables created successfully')
  }

  async indexDocument(
    entityType: VectorDocument['entityType'],
    entityId: string,
    projectId: number,
    content: string,
    metadata?: Record<string, any>
  ): Promise<VectorDocument> {
    try {
      // Generate embedding
      const vector = await localEmbeddingService.generateEmbedding(content)
      const magnitude = this.calculateMagnitude(vector)

      const id = this.generateId('vec')
      const now = new Date()

      // Insert or update
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO vector_index 
        (id, entity_type, entity_id, project_id, content, vector, magnitude, metadata, created_at, updated_at)
        VALUES (
          COALESCE((SELECT id FROM vector_index WHERE entity_type = ? AND entity_id = ? AND project_id = ?), ?),
          ?, ?, ?, ?, ?, ?, ?,
          COALESCE((SELECT created_at FROM vector_index WHERE entity_type = ? AND entity_id = ? AND project_id = ?), ?),
          ?
        )
      `)

      stmt.run(
        entityType, entityId, projectId, id,
        entityType, entityId, projectId, content,
        JSON.stringify(vector), magnitude,
        metadata ? JSON.stringify(metadata) : null,
        entityType, entityId, projectId, now.toISOString(),
        now.toISOString()
      )

      // Update cache
      this.updateCache(id, vector)

      logger.info(`Indexed document: ${entityType}/${entityId}`)

      return {
        id,
        entityType,
        entityId,
        projectId,
        content,
        vector,
        magnitude,
        metadata,
        createdAt: now,
        updatedAt: now
      }
    } catch (error) {
      logger.error('Failed to index document:', error)
      throw error
    }
  }

  async search(
    projectId: number,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const {
        limit = 10,
        minSimilarity = 0.5,
        entityTypes = [],
        excludeIds = [],
        searchMode = 'exact'
      } = options

      // Generate query embedding
      const queryVector = await localEmbeddingService.generateEmbedding(query)

      // Apply perturbation based on search mode
      const perturbedVector = this.applyPerturbation(queryVector, searchMode)

      // Build query
      let sql = 'SELECT * FROM vector_index WHERE project_id = ?'
      const params: any[] = [projectId]

      if (entityTypes.length > 0) {
        sql += ` AND entity_type IN (${entityTypes.map(() => '?').join(',')})`
        params.push(...entityTypes)
      }

      if (excludeIds.length > 0) {
        sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`
        params.push(...excludeIds)
      }

      const stmt = this.db.prepare(sql)
      const rows = stmt.all(...params)

      // Calculate similarities
      const results: SearchResult[] = []

      for (const row of rows) {
        const typedRow = row as any
        const vector = this.getVector(typedRow.id, typedRow.vector)
        const similarity = localEmbeddingService.cosineSimilarity(perturbedVector, vector)

        if (similarity >= minSimilarity) {
          results.push({
            id: typedRow.id,
            entityType: typedRow.entity_type,
            entityId: typedRow.entity_id,
            content: typedRow.content,
            similarity,
            metadata: typedRow.metadata ? JSON.parse(typedRow.metadata) : undefined
          })
        }
      }

      // Sort by similarity
      results.sort((a, b) => b.similarity - a.similarity)

      // Apply limit
      return results.slice(0, limit)
    } catch (error) {
      logger.error('Search failed:', error)
      throw error
    }
  }

  async findSimilar(
    projectId: number,
    entityType: string,
    entityId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Get the document's vector
      const stmt = this.db.prepare(
        'SELECT * FROM vector_index WHERE entity_type = ? AND entity_id = ? AND project_id = ?'
      )
      const row = stmt.get(entityType, entityId, projectId) as any

      if (!row) {
        return []
      }

      const vector = this.getVector(row.id, row.vector)

      // Search for similar documents
      const searchOptions: SearchOptions = {
        ...options,
        excludeIds: [...(options.excludeIds || []), row.id]
      }

      return this.searchByVector(projectId, vector, searchOptions)
    } catch (error) {
      logger.error('Find similar failed:', error)
      throw error
    }
  }

  private async searchByVector(
    projectId: number,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      minSimilarity = 0.5,
      entityTypes = [],
      excludeIds = [],
      searchMode = 'exact'
    } = options

    // Apply perturbation
    const perturbedVector = this.applyPerturbation(queryVector, searchMode)

    // Build query
    let sql = 'SELECT * FROM vector_index WHERE project_id = ?'
    const params: any[] = [projectId]

    if (entityTypes.length > 0) {
      sql += ` AND entity_type IN (${entityTypes.map(() => '?').join(',')})`
      params.push(...entityTypes)
    }

    if (excludeIds.length > 0) {
      sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`
      params.push(...excludeIds)
    }

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params)

    // Calculate similarities
    const results: SearchResult[] = []

    for (const row of rows) {
      const typedRow = row as any
      const vector = this.getVector(typedRow.id, typedRow.vector)
      const similarity = localEmbeddingService.cosineSimilarity(perturbedVector, vector)

      if (similarity >= minSimilarity) {
        results.push({
          id: typedRow.id,
          entityType: typedRow.entity_type,
          entityId: typedRow.entity_id,
          content: typedRow.content,
          similarity,
          metadata: typedRow.metadata ? JSON.parse(typedRow.metadata) : undefined
        })
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, limit)
  }

  private getVector(id: string, vectorJson: string): number[] {
    // Check cache
    if (this.cache.has(id)) {
      return this.cache.get(id)!
    }

    // Parse and cache
    const vector = JSON.parse(vectorJson)
    this.updateCache(id, vector)
    return vector
  }

  private updateCache(id: string, vector: number[]): void {
    // LRU cache implementation
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(id)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(id, vector)
  }

  private calculateMagnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  }

  private applyPerturbation(vector: number[], mode: string): number[] {
    if (mode === 'exact') {
      return vector
    }

    const perturbation = mode === 'similar' ? 0.05 : 0.15 // 5% or 15% noise
    return vector.map(val => {
      const noise = (Math.random() - 0.5) * 2 * perturbation
      return val + noise
    })
  }

  async deleteDocument(entityType: string, entityId: string, projectId: number): Promise<boolean> {
    try {
      const stmt = this.db.prepare(
        'DELETE FROM vector_index WHERE entity_type = ? AND entity_id = ? AND project_id = ?'
      )
      const result = stmt.run(entityType, entityId, projectId)

      logger.info(`Deleted vector document: ${entityType}/${entityId}`)
      return result.changes > 0
    } catch (error) {
      logger.error('Failed to delete document:', error)
      throw error
    }
  }

  async clearProjectIndex(projectId: number): Promise<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM vector_index WHERE project_id = ?')
      const result = stmt.run(projectId)

      logger.info(`Cleared vector index for project: ${projectId}`)
      return result.changes
    } catch (error) {
      logger.error('Failed to clear project index:', error)
      throw error
    }
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService()