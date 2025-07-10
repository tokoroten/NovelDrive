import { vectorSearchService } from './vector-search-service'
import { KnowledgeRepository } from '../repositories/knowledge-repository'
import { ChapterRepository } from '../repositories/chapter-repository'
import { getLogger } from '../utils/logger'

const logger = getLogger('vector-indexing-service')

export class VectorIndexingService {
  private indexingQueue: Map<string, Promise<void>> = new Map()

  constructor() {
    // These need to be initialized with the database instance
    // For now, we'll use a getter pattern
  }

  private getKnowledgeRepo(): KnowledgeRepository {
    const { getDatabase } = require('../database')
    return new KnowledgeRepository(getDatabase())
  }

  private getChapterRepo(): ChapterRepository {
    return new ChapterRepository()
  }

  async indexKnowledge(knowledgeId: string): Promise<void> {
    const key = `knowledge:${knowledgeId}`
    
    // Check if already indexing
    if (this.indexingQueue.has(key)) {
      return this.indexingQueue.get(key)
    }

    const promise = this.performKnowledgeIndexing(knowledgeId)
    this.indexingQueue.set(key, promise)

    try {
      await promise
    } finally {
      this.indexingQueue.delete(key)
    }
  }

  private async performKnowledgeIndexing(knowledgeId: string): Promise<void> {
    try {
      const knowledge = this.getKnowledgeRepo().getById(knowledgeId)
      if (!knowledge) {
        logger.warn(`Knowledge not found: ${knowledgeId}`)
        return
      }

      // Combine title and content for better search
      const searchContent = `${knowledge.title}\n\n${knowledge.content}`

      await vectorSearchService.indexDocument(
        'knowledge',
        knowledgeId,
        knowledge.project_id,
        searchContent,
        {
          type: knowledge.type,
          metadata: knowledge.metadata
        }
      )

      logger.info(`Indexed knowledge: ${knowledgeId}`)
    } catch (error) {
      logger.error(`Failed to index knowledge ${knowledgeId}:`, error)
      throw error
    }
  }

  async indexChapter(chapterId: string): Promise<void> {
    const key = `chapter:${chapterId}`
    
    if (this.indexingQueue.has(key)) {
      return this.indexingQueue.get(key)
    }

    const promise = this.performChapterIndexing(chapterId)
    this.indexingQueue.set(key, promise)

    try {
      await promise
    } finally {
      this.indexingQueue.delete(key)
    }
  }

  private async performChapterIndexing(chapterId: string): Promise<void> {
    try {
      const chapter = this.getChapterRepo().getChapter(chapterId, true)
      if (!chapter) {
        logger.warn(`Chapter not found: ${chapterId}`)
        return
      }

      const plot = this.getChapterRepo().getPlot(chapter.plotId)
      if (!plot) {
        logger.warn(`Plot not found: ${chapter.plotId}`)
        return
      }

      // Include chapter title and content
      const searchContent = `${chapter.title}\n\n${chapter.content || ''}`

      await vectorSearchService.indexDocument(
        'chapter',
        chapterId,
        plot.projectId,
        searchContent,
        {
          plotId: chapter.plotId,
          status: chapter.status,
          wordCount: chapter.wordCount
        }
      )

      logger.info(`Indexed chapter: ${chapterId}`)
    } catch (error) {
      logger.error(`Failed to index chapter ${chapterId}:`, error)
      throw error
    }
  }

  async indexProjectKnowledge(projectId: number): Promise<void> {
    try {
      logger.info(`Starting knowledge indexing for project: ${projectId}`)
      
      const knowledgeList = this.getKnowledgeRepo().listByProject(projectId)
      
      // Index in batches
      const batchSize = 10
      for (let i = 0; i < knowledgeList.length; i += batchSize) {
        const batch = knowledgeList.slice(i, i + batchSize)
        await Promise.all(batch.map(k => this.indexKnowledge(k.id.toString())))
        
        logger.info(`Indexed ${Math.min(i + batchSize, knowledgeList.length)}/${knowledgeList.length} knowledge items`)
      }

      logger.info(`Completed knowledge indexing for project: ${projectId}`)
    } catch (error) {
      logger.error(`Failed to index project knowledge:`, error)
      throw error
    }
  }

  async indexProjectChapters(projectId: number): Promise<void> {
    try {
      logger.info(`Starting chapter indexing for project: ${projectId}`)
      
      const plots = this.getChapterRepo().getPlotsByProject(projectId)
      
      for (const plot of plots) {
        const chapters = this.getChapterRepo().getChaptersByPlot(plot.id)
        
        // Index in batches
        const batchSize = 5
        for (let i = 0; i < chapters.length; i += batchSize) {
          const batch = chapters.slice(i, i + batchSize)
          await Promise.all(batch.map(c => this.indexChapter(c.id)))
          
          logger.info(`Indexed ${Math.min(i + batchSize, chapters.length)}/${chapters.length} chapters in plot: ${plot.title}`)
        }
      }

      logger.info(`Completed chapter indexing for project: ${projectId}`)
    } catch (error) {
      logger.error(`Failed to index project chapters:`, error)
      throw error
    }
  }

  async reindexProject(projectId: number): Promise<void> {
    try {
      logger.info(`Starting full reindex for project: ${projectId}`)
      
      // Clear existing index
      await vectorSearchService.clearProjectIndex(projectId)
      
      // Reindex all content
      await Promise.all([
        this.indexProjectKnowledge(projectId),
        this.indexProjectChapters(projectId)
      ])
      
      logger.info(`Completed full reindex for project: ${projectId}`)
    } catch (error) {
      logger.error(`Failed to reindex project:`, error)
      throw error
    }
  }

  async removeKnowledgeIndex(knowledgeId: string, projectId: number): Promise<void> {
    await vectorSearchService.deleteDocument('knowledge', knowledgeId, projectId)
  }

  async removeChapterIndex(chapterId: string, projectId: number): Promise<void> {
    await vectorSearchService.deleteDocument('chapter', chapterId, projectId)
  }
}

// Export singleton instance
export const vectorIndexingService = new VectorIndexingService()