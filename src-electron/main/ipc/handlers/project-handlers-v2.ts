import { ipcMain } from 'electron'
import { DatabaseInstance } from '../../database'
import { ProjectRepository } from '../../repositories/project-repository'
import { ApiResponse, Project } from '../../../shared/types'

export function registerProjectHandlers(db: DatabaseInstance) {
  const projectRepo = new ProjectRepository(db.db)
  
  ipcMain.handle('project:getAll', async (): Promise<ApiResponse<Project[]>> => {
    try {
      const projects = projectRepo.getAll()
      return { success: true, data: projects }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('project:getById', async (_, { projectId }): Promise<ApiResponse<Project>> => {
    try {
      const project = projectRepo.getById(projectId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }
      return { success: true, data: project }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('project:create', async (_, projectData): Promise<ApiResponse<Project>> => {
    try {
      const { name, description, metadata } = projectData
      const project = projectRepo.create(name, description, metadata)
      return { success: true, data: project }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('project:update', async (_, { projectId, updates }): Promise<ApiResponse<Project>> => {
    try {
      const project = projectRepo.update(projectId, updates)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }
      return { success: true, data: project }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('project:delete', async (_, { projectId }): Promise<ApiResponse<void>> => {
    try {
      const success = projectRepo.delete(projectId)
      if (!success) {
        return { success: false, error: 'Project not found' }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('project:getContext', async (_, { projectId }): Promise<ApiResponse<any>> => {
    try {
      const project = projectRepo.getById(projectId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }
      
      // TODO: Get chapters, characters, plot, knowledge
      return {
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            wordCount: 0,
            chapterCount: 0
          },
          chapters: [],
          characters: [],
          plot: null,
          knowledge: []
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}