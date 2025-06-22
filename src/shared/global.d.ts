import type {
  ChatMessage,
  ChatOptions,
  ImageOptions,
  SearchOptions,
  CrawlOptions,
  AgentConfig,
  DiscussionParams,
  WritingContext,
  PlotData,
  ChapterData,
  Knowledge,
  SearchResult,
  AgentStatus,
  DiscussionProgress,
  HumanIntervention,
  PlotGenerationRequest,
  AutonomousConfig,
  AutonomousStatus,
  AutonomousLog,
  AutonomousContentType
} from './types';

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;

      // 設定関連
      settings: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
      };

      // DuckDB関連
      database: {
        query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
        execute: (sql: string, params?: unknown[]) => Promise<{ success: boolean }>;
        // Dashboard用API
        getDashboardStats: () => Promise<any>;
        getRecentActivities: (limit?: number) => Promise<any[]>;
        getInspirationOfTheDay: () => Promise<string>;
        // Knowledge CRUD
        createKnowledge: (data: any) => Promise<any>;
        updateKnowledge: (id: string, data: any) => Promise<any>;
        deleteKnowledge: (id: string) => Promise<any>;
        getKnowledge: (id: string) => Promise<any>;
        listKnowledge: (options?: any) => Promise<any[]>;
        // Project CRUD
        createProject: (data: any) => Promise<any>;
        updateProject: (id: string, data: any) => Promise<any>;
        deleteProject: (id: string) => Promise<any>;
        getProject: (id: string) => Promise<any>;
        listProjects: (options?: any) => Promise<any[]>;
        // Character CRUD
        createCharacter: (data: any) => Promise<any>;
        updateCharacter: (id: string, data: any) => Promise<any>;
        deleteCharacter: (id: string) => Promise<any>;
        getCharacter: (id: string) => Promise<any>;
        listCharacters: (options?: any) => Promise<any[]>;
        // Plot CRUD
        createPlot: (data: any) => Promise<any>;
        updatePlot: (id: string, data: any) => Promise<any>;
        deletePlot: (id: string) => Promise<any>;
        getPlot: (id: string) => Promise<any>;
        listPlots: (options?: any) => Promise<any[]>;
        // Chapter CRUD
        createChapter: (data: any) => Promise<any>;
        updateChapter: (id: string, data: any) => Promise<any>;
        deleteChapter: (id: string) => Promise<any>;
        getChapter: (id: string) => Promise<any>;
        listChapters: (options?: any) => Promise<any[]>;
      };

      // 日本語処理関連
      tokenizer: {
        tokenize: (text: string) => Promise<string[]>;
      };

      // ナレッジ管理
      knowledge: {
        save: (knowledge: Partial<Knowledge>) => Promise<{ success: boolean; id?: string }>;
      };

      // ファイル操作
      file: {
        read: (path: string) => Promise<string>;
        write: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
      };

      // AI関連
      ai: {
        chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;
        embed: (text: string) => Promise<number[] | null>;
        generateImage: (prompt: string, options?: ImageOptions) => Promise<string>;
        extractInspiration: (text: string, type: string) => Promise<Record<string, unknown>>;
        extractContent: (html: string, url: string) => Promise<Record<string, unknown>>;
        createThread: (metadata?: Record<string, unknown>) => Promise<string>;
        addMessage: (threadId: string, content: string, role?: string) => Promise<string>;
        createAssistant: (
          name: string,
          instructions: string,
          model?: string,
          temperature?: number
        ) => Promise<string>;
        runAssistant: (
          threadId: string,
          assistantId: string,
          instructions?: string
        ) => Promise<unknown[]>;
        getThreadMessages: (threadId: string) => Promise<unknown[]>;
        deleteThread: (threadId: string) => Promise<void>;
      };

      // 検索関連
      search: {
        serendipity: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
        hybrid: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
        related: (itemId: string, options?: SearchOptions) => Promise<SearchResult[]>;
      };

      // Webクローラー関連
      crawler: {
        crawl: (url: string, depth: number, options?: CrawlOptions) => Promise<Record<string, unknown>>;
      };

      // Anything Box関連
      anythingBox: {
        process: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
        history: (options?: Record<string, unknown>) => Promise<unknown[]>;
      };

      // エージェントシステム関連
      agents: {
        create: (options: AgentConfig) => Promise<{ success: boolean; agent: unknown; error?: string }>;
        startDiscussion: (options: DiscussionParams) => Promise<{ success: boolean; session: unknown; error?: string }>;
        pauseSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        resumeSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        getSession: (sessionId: string) => Promise<{ success: boolean; session: unknown; error?: string }>;
        getAllSessions: () => Promise<{ success: boolean; sessions: unknown[]; error?: string }>;
        getDiscussionHistory: (options?: Record<string, unknown>) => Promise<unknown[]>;
        requestWritingSuggestions: (context: WritingContext) => Promise<unknown[]>;
        submitHumanIntervention?: (options: { sessionId: string; intervention: string }) => Promise<{ success: boolean; error?: string }>;
        onMessage: (callback: (data: unknown) => void) => void;
        onSessionStarted: (callback: (data: unknown) => void) => void;
        onSessionConcluded: (callback: (data: unknown) => void) => void;
        onAgentStatusUpdate?: (callback: (data: unknown) => void) => void;
        onProgressUpdate?: (callback: (data: unknown) => void) => void;
        // 新しいDiscussionManager API
        start: (topic: string, context?: any, options?: any) => Promise<any>;
        pause: () => Promise<any>;
        resume: () => Promise<any>;
        addHumanIntervention: (content: string) => Promise<any>;
        getStatus: () => Promise<any>;
        getMessages: (discussionId: string, limit?: number) => Promise<any>;
        getAgents: () => Promise<any>;
        getHistory: (limit?: number) => Promise<any>;
        setAutonomousMode: (enabled: boolean, options?: any) => Promise<any>;
        getTokenUsage: (discussionId: string) => Promise<any>;
        getSummarizationConfig: () => Promise<any>;
        updateSummarizationConfig: (config: any) => Promise<any>;
        getSummaries: (discussionId: string) => Promise<any>;
        // Event listeners
        onDiscussionStarted: (callback: (data: unknown) => void) => void;
        onAgentSpoke: (callback: (data: unknown) => void) => void;
        onDiscussionCompleted: (callback: (data: unknown) => void) => void;
        onDiscussionPaused: (callback: (data: unknown) => void) => void;
        onDiscussionResumed: (callback: (data: unknown) => void) => void;
        onDiscussionError: (callback: (data: unknown) => void) => void;
        onHumanIntervention: (callback: (data: unknown) => void) => void;
        onSummarizationStarted: (callback: (data: unknown) => void) => void;
        onSummarizationCompleted: (callback: (data: unknown) => void) => void;
      };

      // プロット管理関連
      plots: {
        create: (data: PlotData) => Promise<{ success: boolean; id: string }>;
        fork: (plotId: string, modifications: Partial<PlotData>) => Promise<{ success: boolean; id: string }>;
        get: (plotId: string) => Promise<unknown>;
        history: (projectId: string) => Promise<unknown[]>;
        updateStatus: (plotId: string, status: string) => Promise<{ success: boolean }>;
      };

      // チャプター管理関連
      chapters: {
        create: (chapter: ChapterData) => Promise<{ success: boolean; id: string }>;
        update: (id: string, updates: Partial<ChapterData>) => Promise<{ success: boolean }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        get: (id: string) => Promise<unknown>;
        listByPlot: (plotId: string) => Promise<unknown[]>;
      };

      // プロット生成ワークフロー関連
      plotGen: {
        start: (request: PlotGenerationRequest) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        getSession: (sessionId: string) => Promise<{ success: boolean; session?: unknown; error?: string }>;
        getSessions: () => Promise<{ success: boolean; sessions?: unknown[]; error?: string }>;
        cancel: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        addIntervention: (sessionId: string, content: string) => Promise<{ success: boolean; error?: string }>;
      };

      // 自律モード関連
      autonomous: {
        getConfig: () => Promise<AutonomousConfig>;
        updateConfig: (config: Partial<AutonomousConfig>) => Promise<void>;
        getStatus: () => Promise<AutonomousStatus>;
        start: () => Promise<void>;
        stop: () => Promise<void>;
        getLogs: (options?: {
          limit?: number;
          level?: 'info' | 'warn' | 'error' | 'debug';
          category?: 'operation' | 'quality' | 'resource' | 'system';
          operationId?: string;
          since?: Date;
        }) => Promise<AutonomousLog[]>;
        queueOperation: (type: AutonomousContentType, projectId?: string) => Promise<string>;
        getLogSummary: (days?: number) => Promise<unknown>;
        searchLogs: (query: string, options?: {
          limit?: number;
          category?: string;
          level?: string;
        }) => Promise<AutonomousLog[]>;
        clearOldLogs: (daysToKeep?: number) => Promise<number>;
      };
    };
  }
}

export {};
