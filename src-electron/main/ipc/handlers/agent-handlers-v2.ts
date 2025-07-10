import { ipcMain, BrowserWindow } from 'electron'
import { DatabaseInstance } from '../../database'
import { ApiResponse } from '../../../shared/types'
import { Agent, AgentSession, AgentMessage, AgentState } from '../../../../shared/types/agent'
import { agentCoordinator } from '../../services/agent-coordinator'
import { getLogger } from '../../utils/logger'

const logger = getLogger('agent-handlers')

export function registerAgentHandlers(mainWindow: BrowserWindow, _db: DatabaseInstance): void {
  // Get all agents
  ipcMain.handle('agent:getAll', async (): Promise<ApiResponse<Agent[]>> => {
    try {
      const agents = agentCoordinator.getAgents()
      return { success: true, data: agents }
    } catch (error: any) {
      logger.error('Failed to get agents:', error)
      return { success: false, error: error.message }
    }
  })

  // Get agent states
  ipcMain.handle('agent:getStates', async (): Promise<ApiResponse<Record<string, AgentState>>> => {
    try {
      const states = agentCoordinator.getAgentStates()
      const statesObject: Record<string, AgentState> = {}
      states.forEach((state, agentId) => {
        statesObject[agentId] = state
      })
      return { success: true, data: statesObject }
    } catch (error: any) {
      logger.error('Failed to get agent states:', error)
      return { success: false, error: error.message }
    }
  })

  // Create session
  ipcMain.handle('agent:createSession', async (_, { projectId, type, participants }): Promise<ApiResponse<AgentSession>> => {
    try {
      if (!projectId || !type || !participants || participants.length === 0) {
        throw new Error('Project ID, type, and participants are required')
      }

      const session = await agentCoordinator.createSession(projectId, type, participants)
      return { success: true, data: session }
    } catch (error: any) {
      logger.error('Failed to create session:', error)
      return { success: false, error: error.message }
    }
  })

  // End session
  ipcMain.handle('agent:endSession', async (_, { sessionId }): Promise<ApiResponse<void>> => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      await agentCoordinator.endSession(sessionId)
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to end session:', error)
      return { success: false, error: error.message }
    }
  })

  // Send message
  ipcMain.handle('agent:sendMessage', async (_, { sessionId, senderId, content, type = 'message' }): Promise<ApiResponse<void>> => {
    try {
      if (!sessionId || !senderId || !content) {
        throw new Error('Session ID, sender ID, and content are required')
      }

      await agentCoordinator.sendMessage(sessionId, senderId, content, type)
      return { success: true }
    } catch (error: any) {
      logger.error('Failed to send message:', error)
      return { success: false, error: error.message }
    }
  })

  // Get session messages
  ipcMain.handle('agent:getSessionMessages', async (_, { sessionId }): Promise<ApiResponse<AgentMessage[]>> => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      const messages = agentCoordinator.getSessionMessages(sessionId)
      return { success: true, data: messages }
    } catch (error: any) {
      logger.error('Failed to get session messages:', error)
      return { success: false, error: error.message }
    }
  })

  // Get sessions for project
  ipcMain.handle('agent:getSessionsByProject', async (_, { projectId }): Promise<ApiResponse<AgentSession[]>> => {
    try {
      if (!projectId) {
        throw new Error('Project ID is required')
      }

      const sessions = agentCoordinator.getSessions(projectId)
      return { success: true, data: sessions }
    } catch (error: any) {
      logger.error('Failed to get sessions:', error)
      return { success: false, error: error.message }
    }
  })

  // Create custom agent
  ipcMain.handle('agent:createCustom', async (_, agentData): Promise<ApiResponse<Agent>> => {
    try {
      if (!agentData.name) {
        throw new Error('Agent name is required')
      }

      const agent = await agentCoordinator.createCustomAgent(agentData)
      return { success: true, data: agent }
    } catch (error: any) {
      logger.error('Failed to create custom agent:', error)
      return { success: false, error: error.message }
    }
  })

  // Update agent
  ipcMain.handle('agent:update', async (_, { agentId, updates }): Promise<ApiResponse<Agent | undefined>> => {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required')
      }

      const agent = await agentCoordinator.updateAgent(agentId, updates)
      return { success: true, data: agent }
    } catch (error: any) {
      logger.error('Failed to update agent:', error)
      return { success: false, error: error.message }
    }
  })

  // Delete agent
  ipcMain.handle('agent:delete', async (_, { agentId }): Promise<ApiResponse<boolean>> => {
    try {
      if (!agentId) {
        throw new Error('Agent ID is required')
      }

      const result = await agentCoordinator.deleteAgent(agentId)
      return { success: true, data: result }
    } catch (error: any) {
      logger.error('Failed to delete agent:', error)
      return { success: false, error: error.message }
    }
  })

  // Set up event forwarding to renderer
  agentCoordinator.on('agentStateChange', ({ agentId, state }) => {
    mainWindow.webContents.send('agent:stateChange', { agentId, state })
  })

  agentCoordinator.on('agentMessage', (message: AgentMessage) => {
    mainWindow.webContents.send('agent:message', message)
  })

  agentCoordinator.on('message', (message: AgentMessage) => {
    mainWindow.webContents.send('agent:message', message)
  })

  logger.info('Agent handlers registered')
}