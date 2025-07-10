import { ipcMain } from 'electron'
import { DatabaseInstance } from '../../database'
import { KnowledgeRepository } from '../../repositories/knowledge-repository'
import { ApiResponse, Knowledge } from '../../../shared/types'
import { getLogger } from '../../utils/logger'

const logger = getLogger('knowledge-handlers')

export function registerKnowledgeHandlers(db: DatabaseInstance) {
  const knowledgeRepo = new KnowledgeRepository(db.db)
  
  ipcMain.handle('knowledge:listByProject', async (_, { projectId }): Promise<ApiResponse<Knowledge[]>> => {
    try {
      const knowledge = knowledgeRepo.listByProject(projectId)
      return { success: true, data: knowledge }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('knowledge:create', async (_, knowledgeData): Promise<ApiResponse<Knowledge>> => {
    try {
      const knowledge = knowledgeRepo.create(knowledgeData)
      
      // Index for vector search
      import('../../services/vector-indexing-service').then(({ vectorIndexingService }) => {
        vectorIndexingService.indexKnowledge(knowledge.id.toString()).catch(error => {
          logger.error('Failed to index knowledge:', error)
        })
      })
      
      return { success: true, data: knowledge }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('knowledge:search', async (_, { projectId, query, options }): Promise<ApiResponse<Knowledge[]>> => {
    try {
      const results = knowledgeRepo.search(projectId, query, options?.limit)
      return { success: true, data: results }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}