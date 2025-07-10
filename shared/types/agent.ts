// Agent-related type definitions

export interface Agent {
  id: string
  name: string
  type: 'deputy_editor' | 'writer' | 'editor' | 'proofreader' | 'custom'
  description: string
  personality?: string
  enabled: boolean
  customInstructions?: string
  model?: string
  temperature?: number
}

export interface AgentSession {
  id: string
  projectId: number
  type: 'discussion' | 'plot_creation' | 'task' | 'feedback' | 'query'
  participants: string[]
  startTime: Date
  endTime?: Date
  status: 'active' | 'completed' | 'cancelled'
  metadata?: Record<string, any>
}

export interface AgentMessage {
  id: string
  sessionId: string
  agentId: string
  content: string
  type: 'message' | 'thinking' | 'action' | 'system'
  timestamp: Date
  metadata?: Record<string, any>
}

export interface AgentState {
  agentId: string
  status: 'idle' | 'thinking' | 'responding' | 'error'
  currentTask?: string
  lastActivity?: Date
}

export interface PlotElement {
  id: string
  projectId: number
  sessionId: string
  type: 'theme' | 'premise' | 'character' | 'setting' | 'conflict' | 'resolution'
  content: string
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentCapability {
  canCreatePlot: boolean
  canEdit: boolean
  canProofread: boolean
  canAnalyze: boolean
  customCapabilities?: string[]
}

export interface AgentPersonality {
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'creative'
  creativity: number // 0-1
  criticalThinking: number // 0-1
  collaborativeness: number // 0-1
  moderateIgnorance?: boolean // For writer agent
  customTraits?: Record<string, any>
}

export interface SessionStatistics {
  sessionId: string
  messageCount: number
  wordCount: number
  duration: number // in milliseconds
  participantStats: Record<string, {
    messageCount: number
    wordCount: number
    averageResponseTime: number
  }>
}