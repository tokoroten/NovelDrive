/**
 * エージェント会議室の型定義
 */

export interface AgentConfig {
  role: 'writer' | 'editor' | 'proofreader' | 'deputy_editor';
  personality: 'experimental' | 'traditional' | 'logical' | 'emotional' | 'commercial';
  name?: string;
}

export interface Message {
  id: string;
  agentId: string;
  agentRole: string;
  agentName?: string;
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    emotionalTone?: string;
    thinkingTime?: number;
    replyTo?: string;
  };
}

export interface AgentStatus {
  id: string;
  role: string;
  name?: string;
  status: 'active' | 'thinking' | 'finished' | 'idle';
  lastActivity?: string;
  messageCount: number;
}

export interface DiscussionProgress {
  currentRound: number;
  maxRounds: number;
  completedRounds: number;
  participantProgress: Record<string, number>;
  overallProgress: number;
}

export interface HumanIntervention {
  id: string;
  content: string;
  timestamp: string;
  impact: 'low' | 'medium' | 'high';
}

export interface Session {
  id: string;
  topic: string;
  status: 'active' | 'paused' | 'concluded';
  messageCount: number;
  summary?: string;
  startTime: string;
  endTime?: string;
}

export const AGENT_ROLES = [
  { value: 'writer', label: '作家AI' },
  { value: 'editor', label: '編集AI' },
  { value: 'proofreader', label: '校閲AI' },
  { value: 'deputy_editor', label: '副編集長AI' },
] as const;

export const PERSONALITIES = [
  { value: 'experimental', label: '実験的・挑戦的' },
  { value: 'traditional', label: '伝統的・保守的' },
  { value: 'logical', label: '論理的・分析的' },
  { value: 'emotional', label: '感情的・直感的' },
  { value: 'commercial', label: '商業的・市場志向' },
] as const;

export const AGENT_COLORS: Record<string, string> = {
  writer: 'bg-blue-100 text-blue-800',
  editor: 'bg-green-100 text-green-800',
  proofreader: 'bg-yellow-100 text-yellow-800',
  deputy_editor: 'bg-purple-100 text-purple-800',
  human: 'bg-gray-100 text-gray-800',
};