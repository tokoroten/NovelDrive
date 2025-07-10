import { EventEmitter } from 'events'
import { Agent, AgentMessage, AgentSession, AgentState } from '../../../../shared/types/agent'
import { OpenAIService } from '../openai-service'
import { getLogger } from '../../utils/logger'

const logger = getLogger('base-agent')

export abstract class BaseAgent extends EventEmitter {
  protected id: string
  protected openAIService: OpenAIService
  protected currentSessions: Set<string> = new Set()
  protected configuration: Agent | null = null
  protected state: AgentState

  constructor(id: string, openAIService: OpenAIService) {
    super()
    this.id = id
    this.openAIService = openAIService
    this.state = {
      agentId: id,
      status: 'idle'
    }
  }

  // Abstract methods that must be implemented by subclasses
  abstract getSystemPrompt(): string
  abstract getCapabilities(): string[]
  abstract processSpecificMessage(message: AgentMessage, session: AgentSession): Promise<string>

  // Common methods
  async processMessage(message: AgentMessage, session: AgentSession): Promise<void> {
    try {
      this.updateState('thinking', `Processing message from ${message.agentId}`)
      
      // Get agent-specific response
      const response = await this.processSpecificMessage(message, session)
      
      if (response) {
        this.updateState('responding')
        
        // Emit the response as a new message
        this.emit('message', {
          sessionId: session.id,
          agentId: this.id,
          content: response,
          type: 'message',
          timestamp: new Date()
        })
      }
      
      this.updateState('idle')
    } catch (error) {
      logger.error(`Error processing message in agent ${this.id}:`, error)
      this.updateState('error', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  joinSession(sessionId: string, type: AgentSession['type']): void {
    this.currentSessions.add(sessionId)
    logger.info(`Agent ${this.id} joined session ${sessionId} (${type})`)
  }

  leaveSession(sessionId: string): void {
    this.currentSessions.delete(sessionId)
    logger.info(`Agent ${this.id} left session ${sessionId}`)
  }

  updateConfiguration(config: Agent): void {
    this.configuration = config
    logger.info(`Agent ${this.id} configuration updated`)
  }

  protected updateState(status: AgentState['status'], currentTask?: string): void {
    this.state = {
      agentId: this.id,
      status,
      currentTask,
      lastActivity: new Date()
    }
    this.emit('stateChange', this.state)
  }

  protected async generateResponse(prompt: string, context?: string): Promise<string> {
    const systemPrompt = this.getSystemPrompt()
    const fullPrompt = context ? `${systemPrompt}\n\nContext: ${context}\n\n${prompt}` : `${systemPrompt}\n\n${prompt}`
    
    const options = {
      model: this.configuration?.model,
      temperature: this.configuration?.temperature,
      maxTokens: 1000
    }
    
    return await this.openAIService.generateText(fullPrompt, options)
  }

  destroy(): void {
    this.currentSessions.clear()
    this.removeAllListeners()
    logger.info(`Agent ${this.id} destroyed`)
  }
}