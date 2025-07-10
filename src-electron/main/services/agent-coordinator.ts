import { EventEmitter } from 'events'
import { Agent, AgentMessage, AgentSession, AgentState } from '../../../shared/types/agent'
import { AgentRepository } from '../repositories/agent-repository'
import { BaseAgent } from './agents/base-agent'
import { WriterAgent } from './agents/writer-agent'
import { EditorAgent } from './agents/editor-agent'
import { DeputyEditorAgent } from './agents/deputy-editor-agent'
import { ProofreaderAgent } from './agents/proofreader-agent'
import { openAIService } from './openai-service'
import { getLogger } from '../utils/logger'

const logger = getLogger('agent-coordinator')

export class AgentCoordinator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map()
  private sessions: Map<string, AgentSession> = new Map()
  private agentStates: Map<string, AgentState> = new Map()
  private messageQueue: Map<string, AgentMessage[]> = new Map()
  private agentRepository: AgentRepository

  constructor() {
    super()
    this.agentRepository = new AgentRepository()
    this.initializeDefaultAgents()
  }

  private initializeDefaultAgents(): void {
    // Create default agents if they don't exist
    const defaultAgents = [
      {
        id: 'deputy_editor',
        name: '副編集長AI',
        type: 'deputy_editor' as const,
        description: '作品の品質評価と構成分析を担当',
        enabled: true
      },
      {
        id: 'writer',
        name: '作家AI',
        type: 'writer' as const,
        description: '創作と執筆を担当。Moderate Ignorance機能により創造性を保持',
        enabled: true
      },
      {
        id: 'editor',
        name: '編集者AI',
        type: 'editor' as const,
        description: '協調的な編集作業を担当',
        enabled: true
      },
      {
        id: 'proofreader',
        name: '校正AI',
        type: 'proofreader' as const,
        description: '矛盾検出と整合性確認を担当',
        enabled: true
      }
    ]

    for (const agentData of defaultAgents) {
      const existing = this.agentRepository.getAgent(agentData.id)
      if (!existing) {
        this.agentRepository.createAgent(agentData)
      }
      
      // Initialize agent instances
      this.createAgentInstance(agentData.id, agentData.type)
      
      // Set initial state
      this.agentStates.set(agentData.id, {
        agentId: agentData.id,
        status: 'idle'
      })
    }

    logger.info('Default agents initialized')
  }

  private createAgentInstance(agentId: string, type: string): void {
    let agent: BaseAgent

    switch (type) {
      case 'writer':
        agent = new WriterAgent(agentId, openAIService)
        break
      case 'editor':
        agent = new EditorAgent(agentId, openAIService)
        break
      case 'deputy_editor':
        agent = new DeputyEditorAgent(agentId, openAIService)
        break
      case 'proofreader':
        agent = new ProofreaderAgent(agentId, openAIService)
        break
      default:
        throw new Error(`Unknown agent type: ${type}`)
    }

    // Set up event listeners
    agent.on('stateChange', (state: AgentState) => {
      this.agentStates.set(agentId, state)
      this.emit('agentStateChange', { agentId, state })
    })

    agent.on('message', (message: Omit<AgentMessage, 'id'>) => {
      const savedMessage = this.agentRepository.createMessage(message)
      this.emit('agentMessage', savedMessage)
    })

    this.agents.set(agentId, agent)
  }

  // Session management
  async createSession(projectId: number, type: AgentSession['type'], participants: string[]): Promise<AgentSession> {
    const session = this.agentRepository.createSession({
      projectId,
      type,
      participants,
      startTime: new Date(),
      status: 'active'
    })

    this.sessions.set(session.id, session)
    this.messageQueue.set(session.id, [])

    // Notify participants
    for (const participantId of participants) {
      const agent = this.agents.get(participantId)
      if (agent) {
        agent.joinSession(session.id, type)
      }
    }

    logger.info(`Created session ${session.id} with participants: ${participants.join(', ')}`)
    return session
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Notify all participants
    for (const participantId of session.participants) {
      const agent = this.agents.get(participantId)
      if (agent) {
        agent.leaveSession(sessionId)
      }
    }

    // Update session status
    const updatedSession = this.agentRepository.updateSession(sessionId, {
      endTime: new Date(),
      status: 'completed'
    })

    if (updatedSession) {
      this.sessions.set(sessionId, updatedSession)
    }

    // Clean up message queue
    this.messageQueue.delete(sessionId)

    logger.info(`Ended session ${sessionId}`)
  }

  // Message handling
  async sendMessage(sessionId: string, senderId: string, content: string, type: AgentMessage['type'] = 'message'): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`)
    }

    // Save the message
    const message = this.agentRepository.createMessage({
      sessionId,
      agentId: senderId,
      content,
      type,
      timestamp: new Date()
    })

    // Add to queue
    const queue = this.messageQueue.get(sessionId) || []
    queue.push(message)
    this.messageQueue.set(sessionId, queue)

    // Notify other participants
    for (const participantId of session.participants) {
      if (participantId !== senderId) {
        const agent = this.agents.get(participantId)
        if (agent) {
          await agent.processMessage(message, session)
        }
      }
    }

    this.emit('message', message)
  }

  // Agent management
  getAgents(): Agent[] {
    return this.agentRepository.getAllAgents()
  }

  getAgentStates(): Map<string, AgentState> {
    return new Map(this.agentStates)
  }

  getSessionMessages(sessionId: string): AgentMessage[] {
    return this.agentRepository.getMessagesBySession(sessionId)
  }

  getSessions(projectId: number): AgentSession[] {
    return this.agentRepository.getSessionsByProject(projectId)
  }

  // Custom agent support
  async createCustomAgent(agentData: Omit<Agent, 'id'>): Promise<Agent> {
    const agent = this.agentRepository.createAgent({
      ...agentData,
      type: 'custom'
    })

    // For now, custom agents use the base agent implementation
    this.createAgentInstance(agent.id, 'custom')

    return agent
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const updatedAgent = this.agentRepository.updateAgent(agentId, updates)
    
    if (updatedAgent && this.agents.has(agentId)) {
      // Update the agent instance with new configuration
      const agent = this.agents.get(agentId)
      if (agent) {
        agent.updateConfiguration(updatedAgent)
      }
    }

    return updatedAgent
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    // Don't allow deletion of default agents
    const defaultAgentIds = ['deputy_editor', 'writer', 'editor', 'proofreader']
    if (defaultAgentIds.includes(agentId)) {
      throw new Error('Cannot delete default agents')
    }

    // Remove from active agents
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.destroy()
      this.agents.delete(agentId)
    }

    // Remove from states
    this.agentStates.delete(agentId)

    // Delete from database
    return this.agentRepository.deleteAgent(agentId)
  }
}

// Singleton instance
export const agentCoordinator = new AgentCoordinator()