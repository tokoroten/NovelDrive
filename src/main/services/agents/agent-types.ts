/**
 * エージェント関連の型定義
 */

export type AgentRole = 'writer' | 'editor' | 'proofreader' | 'deputy_editor' | 'human';

export interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole | string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DiscussionContext {
  maxRounds: number;
  projectContext?: any;
  plotContext?: any;
  constraints?: string[];
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  personality: string;
  temperature?: number;
  enabled?: boolean;
}

export interface DiscussionResult {
  messages: AgentMessage[];
  summary?: string;
  consensus?: string;
  decisions?: string[];
}

export interface AgentPersonality {
  traits: string[];
  writingStyle?: string;
  preferences?: string[];
  biases?: string[];
}