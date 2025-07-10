import { ipcMain, BrowserWindow } from 'electron'
import { DatabaseInstance } from '../../database'
import { SettingsRepository } from '../../repositories/settings-repository'
import { openAIService } from '../../services/openai-service'
import { ApiResponse } from '../../../shared/types'
import { getLogger } from '../../utils/logger'

const logger = getLogger('openai-handlers')

export function registerOpenAIHandlers(_mainWindow: BrowserWindow, _db: DatabaseInstance): void {
  const settingsRepo = new SettingsRepository()
  
  // Initialize service with saved settings
  initializeOpenAIService(settingsRepo)
  
  ipcMain.handle('openai:setApiKey', async (_, { apiKey }): Promise<ApiResponse<void>> => {
    try {
      if (!apiKey) {
        throw new Error('API key is required')
      }
      
      if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
        throw new Error('Invalid API key format')
      }
      
      openAIService.setApiKey(apiKey)
      
      const settings = await settingsRepo.load()
      settings.api.openai.apiKey = apiKey
      await settingsRepo.save(settings)
      
      logger.info('OpenAI API key updated')
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to set API key:', error)
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('openai:getConfig', async (): Promise<ApiResponse<any>> => {
    try {
      const settings = await settingsRepo.load()
      const apiKey = settings.api.openai.apiKey
      
      return {
        success: true,
        data: {
          isConfigured: openAIService.isConfigured(),
          hasApiKey: !!apiKey && apiKey.length > 0,
          model: settings.api.openai.model || 'gpt-4o',
          temperature: settings.api.openai.temperature || 0.7
        }
      }
    } catch (error: any) {
      logger.error('Failed to get OpenAI config:', error)
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('openai:generateText', async (_, { prompt, options }): Promise<ApiResponse<{ text: string }>> => {
    try {
      if (!prompt) {
        throw new Error('Prompt is required')
      }
      
      const text = await openAIService.generateText(prompt, options)
      return { success: true, data: { text } }
    } catch (error: any) {
      logger.error('Failed to generate text:', error)
      return { success: false, error: error.message }
    }
  })
  
  ipcMain.handle('openai:testConnection', async (_, { apiKey, model, temperature }): Promise<ApiResponse<any>> => {
    try {
      const originalApiKey = openAIService['apiKey']
      
      if (apiKey) {
        openAIService.setApiKey(apiKey)
      }
      
      const startTime = Date.now()
      const testMessage = model?.startsWith('o1-') 
        ? "小説創作において、魅力的なキャラクターを作るための3つの重要な要素を分析してください。"
        : "こんにちは。短く挨拶を返してください。"
      
      const result = await openAIService.generateText(testMessage, {
        model,
        temperature,
        maxTokens: model?.startsWith('o1-') ? 200 : 50
      })
      
      const responseTime = Date.now() - startTime
      
      if (apiKey) {
        openAIService.setApiKey(originalApiKey)
      }
      
      return {
        success: true,
        data: {
          success: true,
          model: model || 'gpt-4o',
          testMessage: result,
          responseTime,
          tokensUsed: result.length
        }
      }
    } catch (error: any) {
      logger.error('OpenAI API test failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })
}

async function initializeOpenAIService(settingsRepo: SettingsRepository) {
  try {
    const settings = await settingsRepo.load()
    
    if (settings.api.openai.apiKey) {
      openAIService.setApiKey(settings.api.openai.apiKey)
      logger.info('OpenAI API key loaded from settings')
    }
    
    if (settings.api.openai.model) {
      openAIService.setModel(settings.api.openai.model)
    }
    
    if (settings.api.openai.temperature !== undefined) {
      openAIService.setTemperature(settings.api.openai.temperature)
    }
    
    logger.info('OpenAI service initialized with saved settings')
  } catch (error) {
    logger.error('Failed to initialize OpenAI service:', error)
  }
}