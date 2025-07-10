import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { api } from '../lib/api'
import { Agent, AgentSession, AgentMessage, AgentState } from '../../shared/types/agent'
import '../styles/agent-meeting.css'

export function AgentMeetingPage() {
  const { currentProjectId } = useStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
  const [currentSession, setCurrentSession] = useState<AgentSession | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [sessionType, setSessionType] = useState<AgentSession['type']>('discussion')
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAgents()
    loadAgentStates()
    
    // Set up event listeners
    window.electronAPI.on('agent:stateChange', handleAgentStateChange)
    window.electronAPI.on('agent:message', handleNewMessage)

    return () => {
      window.electronAPI.off('agent:stateChange', handleAgentStateChange)
      window.electronAPI.off('agent:message', handleNewMessage)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadAgents = async () => {
    const response = await api.agent.getAll()
    if (response.success && response.data) {
      setAgents(response.data)
      // Select all agents by default
      setSelectedAgents(response.data.map(a => a.id))
    }
  }

  const loadAgentStates = async () => {
    const response = await api.agent.getStates()
    if (response.success && response.data) {
      setAgentStates(response.data)
    }
  }

  const handleAgentStateChange = (_event: any, data: { agentId: string; state: AgentState }) => {
    setAgentStates(prev => ({
      ...prev,
      [data.agentId]: data.state
    }))
  }

  const handleNewMessage = (_event: any, message: AgentMessage) => {
    setMessages(prev => [...prev, message])
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const startSession = async () => {
    if (!currentProjectId || selectedAgents.length === 0) return

    setLoading(true)
    try {
      const response = await api.agent.createSession(
        currentProjectId.toString(),
        sessionType,
        selectedAgents
      )
      
      if (response.success && response.data) {
        setCurrentSession(response.data)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    } finally {
      setLoading(false)
    }
  }

  const endSession = async () => {
    if (!currentSession) return

    setLoading(true)
    try {
      await api.agent.endSession(currentSession.id)
      setCurrentSession(null)
      setMessages([])
    } catch (error) {
      console.error('Failed to end session:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!currentSession || !inputMessage.trim()) return

    const message = inputMessage.trim()
    setInputMessage('')

    try {
      await api.agent.sendMessage(
        currentSession.id,
        'user',
        message,
        'message'
      )
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId)
      } else {
        return [...prev, agentId]
      }
    })
  }

  const getAgentStatusClass = (status: AgentState['status']) => {
    switch (status) {
      case 'thinking':
        return 'thinking'
      case 'responding':
        return 'responding'
      case 'error':
        return 'error'
      default:
        return 'idle'
    }
  }

  if (!currentProjectId) {
    return (
      <div className="agent-meeting-page">
        <div className="no-project-message">
          プロジェクトを選択してください
        </div>
      </div>
    )
  }

  return (
    <div className="agent-meeting-page">
      <div className="agent-meeting-container">
        {/* Agents Panel */}
        <div className="agents-panel">
          <h3>エージェント</h3>
          <div className="agents-list">
            {agents.map(agent => {
              const state = agentStates[agent.id]
              const isSelected = selectedAgents.includes(agent.id)
              
              return (
                <div
                  key={agent.id}
                  className={`agent-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => !currentSession && toggleAgentSelection(agent.id)}
                >
                  <div className="agent-header">
                    <h4>{agent.name}</h4>
                    <div className={`agent-status ${getAgentStatusClass(state?.status || 'idle')}`}>
                      {state?.status === 'thinking' && '🤔'}
                      {state?.status === 'responding' && '💬'}
                      {state?.status === 'error' && '❌'}
                      {state?.status === 'idle' && '✓'}
                    </div>
                  </div>
                  <p className="agent-description">{agent.description}</p>
                  {state?.currentTask && (
                    <p className="agent-task">{state.currentTask}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-area">
          {/* Session Controls */}
          <div className="session-controls">
            {!currentSession ? (
              <>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as AgentSession['type'])}
                  className="session-type-select"
                >
                  <option value="discussion">ディスカッション</option>
                  <option value="plot_creation">プロット作成</option>
                  <option value="task">タスク実行</option>
                  <option value="feedback">フィードバック</option>
                  <option value="query">質問</option>
                </select>
                <button
                  onClick={startSession}
                  disabled={loading || selectedAgents.length === 0}
                  className="start-session-btn"
                >
                  セッション開始
                </button>
              </>
            ) : (
              <>
                <div className="session-info">
                  <span>セッション: {sessionType}</span>
                  <span>参加者: {currentSession.participants.length}名</span>
                </div>
                <button
                  onClick={endSession}
                  disabled={loading}
                  className="end-session-btn"
                >
                  セッション終了
                </button>
              </>
            )}
          </div>

          {/* Messages Area */}
          <div className="messages-container">
            {messages.map((message, index) => {
              const agent = agents.find(a => a.id === message.agentId)
              const isUser = message.agentId === 'user'
              
              return (
                <div
                  key={index}
                  className={`message ${isUser ? 'user-message' : 'agent-message'} ${message.type}`}
                >
                  <div className="message-header">
                    <span className="message-sender">
                      {isUser ? 'あなた' : agent?.name || message.agentId}
                    </span>
                    <span className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content">
                    {message.content}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {currentSession && (
            <div className="input-area">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="メッセージを入力..."
                className="message-input"
                rows={3}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim()}
                className="send-btn"
              >
                送信
              </button>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          <div className="panel-section">
            <h3>セッション履歴</h3>
            <div className="session-history">
              {/* TODO: Load and display session history */}
              <p className="placeholder">履歴はまだありません</p>
            </div>
          </div>
          
          <div className="panel-section">
            <h3>統計情報</h3>
            <div className="statistics">
              <div className="stat-item">
                <span className="stat-label">総メッセージ数:</span>
                <span className="stat-value">{messages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}