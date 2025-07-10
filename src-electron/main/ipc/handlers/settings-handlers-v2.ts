import { ipcMain } from 'electron'
import { DatabaseInstance } from '../../database'
import { SettingsRepository } from '../../repositories/settings-repository'
import { ApiResponse } from '../../../shared/types'

export function registerSettingsHandlers(_db: DatabaseInstance) {
  const settingsRepo = new SettingsRepository()
  
  ipcMain.handle('settings:get', async (): Promise<ApiResponse<any>> => {
    try {
      const settings = await settingsRepo.load()
      return { success: true, data: settings }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('settings:save', async (_, settings): Promise<ApiResponse<void>> => {
    try {
      await settingsRepo.save(settings)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('settings:reset', async (): Promise<ApiResponse<void>> => {
    try {
      await settingsRepo.reset()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}