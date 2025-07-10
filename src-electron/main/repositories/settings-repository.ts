import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { getLogger } from '../utils/logger'

const logger = getLogger('settings-repository')

export interface Settings {
  api: {
    openai: {
      apiKey: string
      model: string
      temperature: number
    }
  }
  ai: {
    writerModerateIgnorance: boolean
    responseLength: 'short' | 'medium' | 'long'
    language: string
    serendipityDistance: number
    serendipityNoise: number
  }
  editor: {
    fontSize: number
    lineHeight: number
    showLineNumbers: boolean
    wordWrap: boolean
    autoSave: boolean
    autoSaveInterval: number
    backupCount: number
  }
  export: {
    defaultFormat: string
    includeMetadata: boolean
    includeNotes: boolean
    filenamePattern: string
  }
  advanced: {
    dataLocation: string
    enable24hMode: boolean
    debugMode: boolean
  }
}

export class SettingsRepository {
  private settingsPath: string
  private defaultSettings: Settings

  constructor() {
    const userDataPath = app.getPath('userData')
    this.settingsPath = join(userDataPath, 'settings.json')
    this.defaultSettings = this.getDefaultSettings()
  }

  private getDefaultSettings(): Settings {
    return {
      api: {
        openai: {
          apiKey: '',
          model: 'gpt-4o',
          temperature: 0.7
        }
      },
      ai: {
        writerModerateIgnorance: true,
        responseLength: 'medium',
        language: 'ja',
        serendipityDistance: 0.5,
        serendipityNoise: 0.2
      },
      editor: {
        fontSize: 16,
        lineHeight: 1.6,
        showLineNumbers: false,
        wordWrap: true,
        autoSave: true,
        autoSaveInterval: 30,
        backupCount: 10
      },
      export: {
        defaultFormat: 'txt',
        includeMetadata: true,
        includeNotes: false,
        filenamePattern: '{project}_{date}_{time}'
      },
      advanced: {
        dataLocation: app.getPath('userData'),
        enable24hMode: false,
        debugMode: false
      }
    }
  }

  async load(): Promise<Settings> {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf8')
        const settings = JSON.parse(data)
        return { ...this.defaultSettings, ...settings }
      }
      return this.defaultSettings
    } catch (error) {
      logger.error('Failed to load settings:', error)
      return this.defaultSettings
    }
  }

  async save(settings: Settings): Promise<void> {
    try {
      const dir = join(this.settingsPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      
      writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8')
      logger.info('Settings saved successfully')
    } catch (error) {
      logger.error('Failed to save settings:', error)
      throw error
    }
  }

  async get(key: string): Promise<any> {
    const settings = await this.load()
    const keys = key.split('.')
    let value: any = settings
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return null
      }
    }
    
    return value
  }

  async set(key: string, value: any): Promise<void> {
    const settings = await this.load()
    const keys = key.split('.')
    let obj: any = settings
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {}
      }
      obj = obj[k]
    }
    
    obj[keys[keys.length - 1]] = value
    await this.save(settings)
  }

  async reset(): Promise<void> {
    await this.save(this.defaultSettings)
    logger.info('Settings reset to defaults')
  }
}