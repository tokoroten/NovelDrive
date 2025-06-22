/**
 * リポジトリ共通の型定義
 */

export interface Project {
  id?: string;
  name: string;
  description?: string;
  genre?: string;
  status: 'active' | 'archived' | 'completed';
  settings?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Knowledge {
  id?: string;
  title: string;
  content: string;
  type: string;
  project_id?: string;
  source_url?: string;
  source_id?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  search_tokens?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Character {
  id?: string;
  project_id: string;
  name: string;
  profile?: string;
  personality?: string;
  speech_style?: string;
  background?: string;
  dialogue_samples?: string;
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Plot {
  id?: string;
  project_id: string;
  version: string;
  parent_version?: string;
  title: string;
  synopsis: string;
  structure: Record<string, unknown>;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  created_by: string;
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Chapter {
  id?: string;
  project_id: string;
  plot_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count?: number;
  status: 'draft' | 'writing' | 'reviewing' | 'completed';
  version?: number;
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface AgentDiscussion {
  id?: string;
  project_id?: string;
  plot_id?: string;
  chapter_id?: string;
  topic: string;
  status: 'active' | 'completed' | 'archived';
  thread_id: string;
  participants: string[];
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface AgentMessage {
  id?: string;
  discussion_id: string;
  agent_role: string;
  agent_name?: string;
  message: string;
  message_type: 'text' | 'suggestion' | 'critique' | 'approval';
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface KnowledgeLink {
  id?: string;
  source_id: string;
  target_id: string;
  link_type: 'related' | 'derived' | 'contradicts' | 'supports';
  strength: number;
  metadata?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export interface SearchOptions {
  query: string;
  mode: 'normal' | 'serendipity' | 'hybrid';
  weights?: {
    titleWeight?: number;
    contentWeight?: number;
    semanticWeight?: number;
  };
  projectId?: string;
  types?: string[];
  limit?: number;
  threshold?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
  project_id?: string;
  highlights?: string[];
}

export interface AnalyticsOverview {
  totalProjects: number;
  totalKnowledge: number;
  totalCharacters: number;
  totalPlots: number;
  totalChapters: number;
  totalWordCount: number;
  recentActivity: Array<{
    type: string;
    title: string;
    timestamp: Date;
  }>;
}

export interface ActivityData {
  date: string;
  wordCount: number;
  knowledgeCount: number;
  discussionCount: number;
}