// 共通の型定義

// API通信用の型定義
export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ImageOptions {
  size?: string;
  quality?: string;
  style?: string;
}

export interface SearchOptions {
  projectId?: string;
  limit?: number;
  serendipityLevel?: number;
}

export interface CrawlOptions {
  depth?: number;
  maxPages?: number;
}

export interface AgentConfig {
  role: string;
  personality: string;
  name?: string;
}

export interface DiscussionParams {
  topic: string;
  agentConfigs: AgentConfig[];
  maxRounds?: number;
}

export interface WritingContext {
  plotId: string;
  chapterTitle: string;
  previousContent: string;
  chapterOrder: number;
}

export interface PlotData {
  projectId: string;
  title: string;
  synopsis: string;
  structure: string;
  parentVersion?: string;
}

export interface ChapterData {
  title: string;
  content: string;
  plotId: string;
  order: number;
  status: string;
  wordCount: number;
  characterCount: number;
}

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'article' | 'social' | 'inspiration' | 'character' | 'world';
  projectId?: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
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
  plotId?: string;
  topic: string;
  participants: string[]; // agent IDs
  messages: DiscussionMessage[];
  conclusion?: string;
  summary?: string;
  status: 'active' | 'concluded' | 'paused';
  messageCount: number;
  startTime: string;
  endTime?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionMessage {
  id: string;
  agentId: string;
  agentRole: string;
  agentName?: string;
  content: string;
  timestamp: Date;
  inReplyTo?: string;
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

export interface SearchResult {
  item: Knowledge | Plot | Character | WorldSetting;
  score: number;
  matchType: 'exact' | 'semantic' | 'serendipity';
  highlights?: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  similarity?: number;
  embedding?: number[];
}

export interface PlotGenerationRequest {
  theme: string;
  genre: string;
  targetAudience?: string;
  initialIdea?: string;
  constraints?: string[];
  projectId: string;
  humanUserId?: string;
}

// Autonomous Mode Types
export interface AutonomousConfig {
  enabled: boolean;
  interval: number; // minutes between operations
  qualityThreshold: number; // 0-100, minimum quality score to save content
  maxConcurrentOperations: number;
  maxDailyOperations: number;
  timeSlots: TimeSlot[]; // when autonomous mode can run
  resourceLimits: ResourceLimits;
  contentTypes: AutonomousContentType[];
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
  enabled: boolean;
}

export interface ResourceLimits {
  maxCpuUsage: number; // percentage
  maxMemoryUsage: number; // MB
  maxApiCallsPerHour: number;
  maxTokensPerOperation: number;
}

export type AutonomousContentType = 'plot' | 'character' | 'worldSetting' | 'inspiration';

export interface AutonomousOperation {
  id: string;
  type: AutonomousContentType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  projectId?: string;
  startTime: Date;
  endTime?: Date;
  result?: AutonomousOperationResult;
  error?: string;
  metrics: OperationMetrics;
}

export interface AutonomousOperationResult {
  contentId: string;
  qualityScore: number;
  confidence: number;
  saved: boolean;
  content: any; // depends on content type
}

export interface OperationMetrics {
  duration: number; // milliseconds
  tokensUsed: number;
  apiCalls: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface QualityAssessment {
  overallScore: number; // 0-100
  criteria: QualityCriterion[];
  recommendation: 'save' | 'discard' | 'review';
  reasoning: string;
}

export interface QualityCriterion {
  name: string;
  score: number; // 0-100
  weight: number; // importance multiplier
  details?: string;
}

export interface AutonomousStatus {
  enabled: boolean;
  currentOperation?: AutonomousOperation;
  queueLength: number;
  lastOperationTime?: Date;
  todayCount: number;
  totalOperations: number;
  successRate: number; // percentage
  systemHealth: SystemHealth;
}

export interface SystemHealth {
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  diskSpace: number; // MB available
  networkLatency: number; // ms
  healthy: boolean;
}

export interface AutonomousLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'operation' | 'quality' | 'resource' | 'system';
  message: string;
  operationId?: string;
  metadata?: Record<string, any>;
}
