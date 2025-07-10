import { ipcMain, BrowserWindow } from 'electron'
import { DatabaseInstance } from '../../database'
import { ApiResponse } from '../../../shared/types'
import { Chapter, Plot, Scene, ChapterVersion, WritingStatistics } from '../../../../shared/types/chapter'
import { ChapterRepository } from '../../repositories/chapter-repository'
import { getLogger } from '../../utils/logger'

const logger = getLogger('chapter-handlers')

export function registerChapterHandlers(_mainWindow: BrowserWindow, _db: DatabaseInstance): void {
  const chapterRepo = new ChapterRepository()

  // Plot handlers
  ipcMain.handle('plot:create', async (_, plotData): Promise<ApiResponse<Plot>> => {
    try {
      const plot = chapterRepo.createPlot(plotData)
      return { success: true, data: plot }
    } catch (error: any) {
      logger.error('Failed to create plot:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plot:getById', async (_, { plotId }): Promise<ApiResponse<Plot | undefined>> => {
    try {
      const plot = chapterRepo.getPlot(plotId)
      return { success: true, data: plot }
    } catch (error: any) {
      logger.error('Failed to get plot:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plot:getByProject', async (_, { projectId }): Promise<ApiResponse<Plot[]>> => {
    try {
      const plots = chapterRepo.getPlotsByProject(projectId)
      return { success: true, data: plots }
    } catch (error: any) {
      logger.error('Failed to get plots:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plot:update', async (_, { plotId, updates }): Promise<ApiResponse<Plot | undefined>> => {
    try {
      const plot = chapterRepo.updatePlot(plotId, updates)
      return { success: true, data: plot }
    } catch (error: any) {
      logger.error('Failed to update plot:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('plot:delete', async (_, { plotId }): Promise<ApiResponse<boolean>> => {
    try {
      const result = chapterRepo.deletePlot(plotId)
      return { success: true, data: result }
    } catch (error: any) {
      logger.error('Failed to delete plot:', error)
      return { success: false, error: error.message }
    }
  })

  // Chapter handlers
  ipcMain.handle('chapter:create', async (_, chapterData): Promise<ApiResponse<Chapter>> => {
    try {
      const chapter = chapterRepo.createChapter(chapterData)
      
      // Index for vector search
      import('../../services/vector-indexing-service').then(({ vectorIndexingService }) => {
        vectorIndexingService.indexChapter(chapter.id).catch(error => {
          logger.error('Failed to index chapter:', error)
        })
      })
      
      return { success: true, data: chapter }
    } catch (error: any) {
      logger.error('Failed to create chapter:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chapter:getById', async (_, { chapterId, includeContent = false }): Promise<ApiResponse<Chapter | undefined>> => {
    try {
      const chapter = chapterRepo.getChapter(chapterId, includeContent)
      return { success: true, data: chapter }
    } catch (error: any) {
      logger.error('Failed to get chapter:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chapter:getByPlot', async (_, { plotId, includeContent = false }): Promise<ApiResponse<Chapter[]>> => {
    try {
      const chapters = chapterRepo.getChaptersByPlot(plotId, includeContent)
      return { success: true, data: chapters }
    } catch (error: any) {
      logger.error('Failed to get chapters:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chapter:update', async (_, { chapterId, updates }): Promise<ApiResponse<Chapter | undefined>> => {
    try {
      const chapter = chapterRepo.updateChapter(chapterId, updates)
      
      // Update writing statistics if content changed
      if (updates.content !== undefined && chapter) {
        const plot = chapterRepo.getPlot(chapter.plotId)
        if (plot) {
          const oldWordCount = chapterRepo.getChapter(chapterId)?.wordCount || 0
          const wordsDelta = chapter.wordCount - oldWordCount
          chapterRepo.updateWritingStatistics(plot.projectId, wordsDelta)
        }
        
        // Re-index for vector search
        import('../../services/vector-indexing-service').then(({ vectorIndexingService }) => {
          vectorIndexingService.indexChapter(chapter.id).catch(error => {
            logger.error('Failed to re-index chapter:', error)
          })
        })
      }
      
      return { success: true, data: chapter }
    } catch (error: any) {
      logger.error('Failed to update chapter:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chapter:delete', async (_, { chapterId }): Promise<ApiResponse<boolean>> => {
    try {
      const result = chapterRepo.deleteChapter(chapterId)
      return { success: true, data: result }
    } catch (error: any) {
      logger.error('Failed to delete chapter:', error)
      return { success: false, error: error.message }
    }
  })

  // Scene handlers
  ipcMain.handle('scene:create', async (_, sceneData): Promise<ApiResponse<Scene>> => {
    try {
      const scene = chapterRepo.createScene(sceneData)
      return { success: true, data: scene }
    } catch (error: any) {
      logger.error('Failed to create scene:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('scene:getByChapter', async (_, { chapterId }): Promise<ApiResponse<Scene[]>> => {
    try {
      const scenes = chapterRepo.getScenesByChapter(chapterId)
      return { success: true, data: scenes }
    } catch (error: any) {
      logger.error('Failed to get scenes:', error)
      return { success: false, error: error.message }
    }
  })

  // Version handlers
  ipcMain.handle('chapter:createVersion', async (_, { chapterId, content }): Promise<ApiResponse<ChapterVersion>> => {
    try {
      const version = chapterRepo.createChapterVersion(chapterId, content)
      return { success: true, data: version }
    } catch (error: any) {
      logger.error('Failed to create chapter version:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('chapter:getVersions', async (_, { chapterId }): Promise<ApiResponse<ChapterVersion[]>> => {
    try {
      const versions = chapterRepo.getChapterVersions(chapterId)
      return { success: true, data: versions }
    } catch (error: any) {
      logger.error('Failed to get chapter versions:', error)
      return { success: false, error: error.message }
    }
  })

  // Statistics handlers
  ipcMain.handle('statistics:getWriting', async (_, { projectId }): Promise<ApiResponse<WritingStatistics | undefined>> => {
    try {
      const stats = chapterRepo.getWritingStatistics(projectId)
      return { success: true, data: stats }
    } catch (error: any) {
      logger.error('Failed to get writing statistics:', error)
      return { success: false, error: error.message }
    }
  })

  logger.info('Chapter handlers registered')
}