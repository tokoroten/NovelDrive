import { ipcMain, BrowserWindow } from 'electron'
import { DatabaseInstance } from '../../database'
import { ApiResponse } from '../../../shared/types'
import { vectorSearchService, SearchResult } from '../../services/vector-search-service'
import { vectorIndexingService } from '../../services/vector-indexing-service'
import { localEmbeddingService } from '../../services/local-embedding-service'
import { getLogger } from '../../utils/logger'

const logger = getLogger('vector-search-handlers')

export function registerVectorSearchHandlers(_mainWindow: BrowserWindow, _db: DatabaseInstance): void {
  // Initialize embedding service on startup
  localEmbeddingService.initialize().catch(error => {
    logger.error('Failed to initialize embedding service:', error)
  })

  // Search handlers
  ipcMain.handle('vector:search', async (_, { projectId, query, options }): Promise<ApiResponse<SearchResult[]>> => {
    try {
      if (!projectId || !query) {
        throw new Error('Project ID and query are required')
      }

      const results = await vectorSearchService.search(projectId, query, options)
      return { success: true, data: results }
    } catch (error: any) {
      logger.error('Vector search failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vector:findSimilar', async (_, { projectId, entityType, entityId, options }): Promise<ApiResponse<SearchResult[]>> => {
    try {
      if (!projectId || !entityType || !entityId) {
        throw new Error('Project ID, entity type, and entity ID are required')
      }

      const results = await vectorSearchService.findSimilar(projectId, entityType, entityId, options)
      return { success: true, data: results }
    } catch (error: any) {
      logger.error('Find similar failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Indexing handlers
  ipcMain.handle('vector:indexKnowledge', async (_, { knowledgeId }): Promise<ApiResponse<void>> => {
    try {
      if (!knowledgeId) {
        throw new Error('Knowledge ID is required')
      }

      await vectorIndexingService.indexKnowledge(knowledgeId)
      return { success: true }
    } catch (error: any) {
      logger.error('Knowledge indexing failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vector:indexChapter', async (_, { chapterId }): Promise<ApiResponse<void>> => {
    try {
      if (!chapterId) {
        throw new Error('Chapter ID is required')
      }

      await vectorIndexingService.indexChapter(chapterId)
      return { success: true }
    } catch (error: any) {
      logger.error('Chapter indexing failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('vector:reindexProject', async (_, { projectId }): Promise<ApiResponse<void>> => {
    try {
      if (!projectId) {
        throw new Error('Project ID is required')
      }

      await vectorIndexingService.reindexProject(projectId)
      return { success: true }
    } catch (error: any) {
      logger.error('Project reindexing failed:', error)
      return { success: false, error: error.message }
    }
  })

  // Utility handlers
  ipcMain.handle('vector:calculateSimilarity', async (_, { text1, text2 }): Promise<ApiResponse<number>> => {
    try {
      if (!text1 || !text2) {
        throw new Error('Both texts are required')
      }

      const similarity = await localEmbeddingService.calculateTextSimilarity(text1, text2)
      return { success: true, data: similarity }
    } catch (error: any) {
      logger.error('Similarity calculation failed:', error)
      return { success: false, error: error.message }
    }
  })

  logger.info('Vector search handlers registered')
}