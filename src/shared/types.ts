// 共通の型定義

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'article' | 'social' | 'inspiration' | 'character' | 'world';
  projectId?: string;
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plot {
  id: string;
  projectId: string;
  version: string;
  parentVersion?: string;
  title: string;
  synopsis: string;
  structure: PlotStructure;
  status: 'draft' | 'discussion' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface PlotStructure {
  acts: Act[];
  themes: string[];
  emotionalCurve: EmotionalPoint[];
}

export interface Act {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  title: string;
  synopsis: string;
  targetWordCount: number;
  actualWordCount?: number;
  content?: string;
  status: 'planned' | 'writing' | 'review' | 'completed';
}

export interface EmotionalPoint {
  position: number; // 0-1 の範囲
  intensity: number; // -1 to 1
  emotion: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  genre: string[];
  targetAudience: string;
  worldSettings: WorldSetting[];
  characters: Character[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  profile: string;
  personality: string;
  speechStyle: string;
  background: string;
  relationships: CharacterRelationship[];
  dialogueSamples: string[];
}

export interface CharacterRelationship {
  characterId: string;
  type: string;
  description: string;
}

export interface WorldSetting {
  id: string;
  projectId: string;
  category: string;
  name: string;
  description: string;
  rules: string[];
}

export interface AIAgent {
  id: string;
  type: 'writer' | 'editor' | 'proofreader' | 'deputy_editor';
  personality: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
}

export interface AgentDiscussion {
  id: string;
  plotId: string;
  participants: string[]; // agent IDs
  messages: DiscussionMessage[];
  conclusion?: string;
  status: 'active' | 'concluded' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionMessage {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  inReplyTo?: string;
}

export interface SearchResult {
  item: Knowledge | Plot | Character | WorldSetting;
  score: number;
  matchType: 'exact' | 'semantic' | 'serendipity';
  highlights?: string[];
}