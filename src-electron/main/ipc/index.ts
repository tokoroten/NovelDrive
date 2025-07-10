import { BrowserWindow } from 'electron'
import { DatabaseInstance } from '../database'
import { registerProjectHandlers } from './handlers/project-handlers-v2'
import { registerKnowledgeHandlers } from './handlers/knowledge-handlers-v2'
import { registerSettingsHandlers } from './handlers/settings-handlers-v2'
import { registerOpenAIHandlers } from './handlers/openai-handlers-v2'
import { registerAgentHandlers } from './handlers/agent-handlers-v2'
import { registerChapterHandlers } from './handlers/chapter-handlers'
import { registerVectorSearchHandlers } from './handlers/vector-search-handlers'
import { getLogger } from '../utils/logger'

const logger = getLogger('ipc')

export async function registerIPCHandlers(
  mainWindow: BrowserWindow,
  db: DatabaseInstance
): Promise<void> {
  logger.info('Registering IPC handlers...')
  
  // Register all handlers
  registerProjectHandlers(db)
  registerKnowledgeHandlers(db)
  registerSettingsHandlers(db)
  registerOpenAIHandlers(mainWindow, db)
  registerAgentHandlers(mainWindow, db)
  registerChapterHandlers(mainWindow, db)
  registerVectorSearchHandlers(mainWindow, db)
  
  logger.info('All IPC handlers registered')
}