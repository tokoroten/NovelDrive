/**
 * サービスインターフェース定義
 * 各サービスが実装すべき共通インターフェースを定義
 */

import Database from 'better-sqlite3';
import OpenAI from 'openai';
import { Knowledge, Plot, Project, Character, WorldSetting } from '../../../shared/types';

/**
 * 基本サービスインターフェース
 */
export interface IService {
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

/**
 * データベースサービス
 */
export interface IDatabaseService extends IService {
  getConnection(): Database.Database;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  transaction<T>(callback: (conn: Database.Database) => Promise<T>): Promise<T>;
}

/**
 * 埋め込みサービス
 */
export interface IEmbeddingService extends IService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings?(texts: string[]): Promise<number[][]>;
  generateBatchEmbeddings?(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  getModelName(): string;
}

/**
 * テキスト生成サービス
 */
export interface ICompletionService extends IService {
  complete(
    messages: Array<{ role: string; content: string }>,
    options?: any
  ): Promise<string>;
  stream?(
    messages: Array<{ role: string; content: string }>,
    options?: any,
    onChunk?: (chunk: string) => void
  ): Promise<string>;
}

/**
 * OpenAIサービス
 */
export interface IOpenAIService extends IService {
  chat(messages: OpenAI.Chat.ChatCompletionMessageParam[], options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
  
  generateImage(prompt: string, options?: {
    size?: string;
    quality?: string;
    style?: string;
  }): Promise<string>;
  
  createThread(metadata?: Record<string, any>): Promise<string>;
  addMessageToThread(threadId: string, content: string, role?: 'user' | 'assistant'): Promise<string>;
  runAssistant(threadId: string, assistantId: string, instructions?: string): Promise<OpenAI.Beta.Threads.Messages.Message[]>;
}

/**
 * 知識管理サービス
 */
export interface IKnowledgeService extends IService {
  create(knowledge: Partial<Knowledge>): Promise<Knowledge>;
  update(id: string, updates: Partial<Knowledge>): Promise<Knowledge>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Knowledge | null>;
  search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
  }): Promise<Knowledge[]>;
  serendipitySearch(query: string, options?: {
    projectId?: string;
    serendipityLevel?: number;
    limit?: number;
  }): Promise<Knowledge[]>;
}

/**
 * プロット管理サービス
 */
export interface IPlotService extends IService {
  create(projectId: string, data: {
    title: string;
    synopsis: string;
    structure: any;
    parentVersion?: string;
  }): Promise<Plot>;
  fork(plotId: string, modifications: Partial<Plot>): Promise<Plot>;
  update(id: string, updates: Partial<Plot>): Promise<Plot>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Plot | null>;
  getHistory(projectId: string): Promise<Plot[]>;
  updateStatus(id: string, status: string): Promise<void>;
}

/**
 * プロジェクト管理サービス
 */
export interface IProjectService extends IService {
  create(project: Partial<Project>): Promise<Project>;
  update(id: string, updates: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Project | null>;
  list(filters?: { status?: string }): Promise<Project[]>;
  addCharacter(projectId: string, character: Partial<Character>): Promise<Character>;
  addWorldSetting(projectId: string, setting: Partial<WorldSetting>): Promise<WorldSetting>;
}

/**
 * APIログサービス
 */
export interface IApiLoggerService extends IService {
  log(data: {
    apiType: string;
    provider: string;
    model?: string;
    operation: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    status: 'success' | 'error';
    errorMessage?: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
  
  getLogs(options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    apiType?: string;
  }): Promise<any[]>;
  
  getStats(days?: number): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byApiType: Record<string, number>;
    byModel: Record<string, number>;
  }>;
}

/**
 * 自律モードサービス
 */
export interface IAutonomousService extends IService {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): Promise<any>;
  scheduleOperation(type: string, data: any): Promise<string>;
  cancelOperation(id: string): Promise<void>;
}

/**
 * マルチエージェントサービス
 */
export interface IMultiAgentService extends IService {
  createDiscussion(topic: string, options?: {
    projectId?: string;
    plotId?: string;
    maxRounds?: number;
  }): Promise<string>;
  
  pauseDiscussion(discussionId: string): Promise<void>;
  resumeDiscussion(discussionId: string): Promise<void>;
  
  addHumanMessage(discussionId: string, message: string): Promise<void>;
  
  getDiscussion(discussionId: string): Promise<any>;
  listDiscussions(projectId?: string): Promise<any[]>;
}

/**
 * 品質フィルタサービス
 */
export interface IQualityFilterService extends IService {
  assessQuality(content: any, type: string): Promise<{
    overallScore: number;
    criteria: Array<{
      name: string;
      score: number;
      weight: number;
      details?: string;
    }>;
    recommendation: 'save' | 'discard' | 'review';
    reasoning: string;
  }>;
  
  getQualityStats(days?: number): Promise<{
    totalAssessed: number;
    averageScore: number;
    saveRate: number;
    discardRate: number;
    reviewRate: number;
  }>;
}