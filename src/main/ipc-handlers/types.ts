/**
 * IPC通信の共通型定義
 */

export interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface AgentSession {
  id: string;
  topic: string;
  status: string;
  messageCount: number;
  startTime: string;
  endTime?: string;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  agentRole: string;
  content: string;
  timestamp: string;
}

export interface AgentParticipant {
  role: string;
  name?: string;
}

export interface FullAgentSession extends AgentSession {
  messages: AgentMessage[];
  participants: AgentParticipant[];
}

export interface TaskOptions {
  priority?: 'low' | 'normal' | 'high';
  maxRetries?: number;
}

export interface SystemStats {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  uptime: number;
}