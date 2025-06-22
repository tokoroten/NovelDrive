import { contextBridge, ipcRenderer } from 'electron';

// Type definitions
interface ChatMessage {
  role: string;
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ImageOptions {
  size?: string;
  quality?: string;
  style?: string;
}

interface SearchOptions {
  projectId?: string;
  limit?: number;
  serendipityLevel?: number;
}

interface CrawlOptions {
  depth?: number;
  maxPages?: number;
}

interface AgentConfig {
  role: string;
  personality: string;
  name?: string;
}

interface DiscussionParams {
  topic: string;
  agentConfigs: AgentConfig[];
  maxRounds?: number;
}

interface WritingContext {
  plotId: string;
  chapterTitle: string;
  previousContent: string;
  chapterOrder: number;
}

interface PlotData {
  projectId: string;
  title: string;
  synopsis: string;
  structure: string;
  parentVersion?: string;
}

interface ChapterData {
  title: string;
  content: string;
  plotId: string;
  order: number;
  status: string;
  wordCount: number;
  characterCount: number;
}

interface PlotGenerationRequest {
  theme: string;
  genre: string;
  targetAudience?: string;
  initialIdea?: string;
  constraints?: string[];
  projectId: string;
  humanUserId?: string;
}

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 設定関連
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },

  // DuckDB関連
  database: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    execute: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:execute', sql, params),
    // Dashboard用API
    getDashboardStats: () => ipcRenderer.invoke('db:getDashboardStats'),
    getRecentActivities: (limit?: number) => ipcRenderer.invoke('db:getRecentActivities', limit),
    getInspirationOfTheDay: () => ipcRenderer.invoke('db:getInspirationOfTheDay'),
    // Knowledge CRUD
    createKnowledge: (data: any) => ipcRenderer.invoke('db:createKnowledge', data),
    updateKnowledge: (id: string, data: any) => ipcRenderer.invoke('db:updateKnowledge', id, data),
    deleteKnowledge: (id: string) => ipcRenderer.invoke('db:deleteKnowledge', id),
    getKnowledge: (id: string) => ipcRenderer.invoke('db:getKnowledge', id),
    listKnowledge: (options?: any) => ipcRenderer.invoke('db:listKnowledge', options),
    // Project CRUD
    createProject: (data: any) => ipcRenderer.invoke('db:createProject', data),
    updateProject: (id: string, data: any) => ipcRenderer.invoke('db:updateProject', id, data),
    deleteProject: (id: string) => ipcRenderer.invoke('db:deleteProject', id),
    getProject: (id: string) => ipcRenderer.invoke('db:getProject', id),
    listProjects: (options?: any) => ipcRenderer.invoke('db:listProjects', options),
    // Character CRUD
    createCharacter: (data: any) => ipcRenderer.invoke('db:createCharacter', data),
    updateCharacter: (id: string, data: any) => ipcRenderer.invoke('db:updateCharacter', id, data),
    deleteCharacter: (id: string) => ipcRenderer.invoke('db:deleteCharacter', id),
    getCharacter: (id: string) => ipcRenderer.invoke('db:getCharacter', id),
    listCharacters: (options?: any) => ipcRenderer.invoke('db:listCharacters', options),
    // Plot CRUD
    createPlot: (data: any) => ipcRenderer.invoke('db:createPlot', data),
    updatePlot: (id: string, data: any) => ipcRenderer.invoke('db:updatePlot', id, data),
    deletePlot: (id: string) => ipcRenderer.invoke('db:deletePlot', id),
    getPlot: (id: string) => ipcRenderer.invoke('db:getPlot', id),
    listPlots: (options?: any) => ipcRenderer.invoke('db:listPlots', options),
    // Chapter CRUD
    createChapter: (data: any) => ipcRenderer.invoke('db:createChapter', data),
    updateChapter: (id: string, data: any) => ipcRenderer.invoke('db:updateChapter', id, data),
    deleteChapter: (id: string) => ipcRenderer.invoke('db:deleteChapter', id),
    getChapter: (id: string) => ipcRenderer.invoke('db:getChapter', id),
    listChapters: (options?: any) => ipcRenderer.invoke('db:listChapters', options),
  },

  // 日本語処理関連
  tokenizer: {
    tokenize: (text: string) => ipcRenderer.invoke('tokenizer:tokenize', text),
  },

  // ナレッジ管理
  knowledge: {
    save: (knowledge: Record<string, unknown>) => ipcRenderer.invoke('knowledge:save', knowledge),
  },

  // ファイル操作
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path),
  },

  // AI関連
  ai: {
    chat: (messages: ChatMessage[], options?: ChatOptions) => ipcRenderer.invoke('ai:chat', messages, options),
    embed: (text: string) => ipcRenderer.invoke('ai:embed', text),
    generateImage: (prompt: string, options?: ImageOptions) =>
      ipcRenderer.invoke('ai:generateImage', prompt, options),
    extractInspiration: (text: string, type: string) =>
      ipcRenderer.invoke('ai:extractInspiration', text, type),
    extractContent: (html: string, url: string) =>
      ipcRenderer.invoke('ai:extractContent', html, url),
    // Thread API関連
    createThread: (metadata?: Record<string, unknown>) => ipcRenderer.invoke('ai:createThread', metadata),
    addMessage: (threadId: string, content: string, role?: string) =>
      ipcRenderer.invoke('ai:addMessage', threadId, content, role),
    createAssistant: (name: string, instructions: string, model?: string, temperature?: number) =>
      ipcRenderer.invoke('ai:createAssistant', name, instructions, model, temperature),
    runAssistant: (threadId: string, assistantId: string, instructions?: string) =>
      ipcRenderer.invoke('ai:runAssistant', threadId, assistantId, instructions),
    getThreadMessages: (threadId: string) => ipcRenderer.invoke('ai:getThreadMessages', threadId),
    deleteThread: (threadId: string) => ipcRenderer.invoke('ai:deleteThread', threadId),
  },

  // 検索関連
  search: {
    serendipity: (query: string, options?: SearchOptions) =>
      ipcRenderer.invoke('search:serendipity', query, options),
    hybrid: (query: string, options?: SearchOptions) => ipcRenderer.invoke('search:hybrid', query, options),
    related: (itemId: string, options?: SearchOptions) =>
      ipcRenderer.invoke('search:related', itemId, options),
  },

  // Webクローラー関連
  crawler: {
    crawl: (url: string, depth: number, options?: CrawlOptions) =>
      ipcRenderer.invoke('crawler:crawl', url, depth, options),
  },

  // Anything Box関連
  anythingBox: {
    process: (input: Record<string, unknown>) => ipcRenderer.invoke('anythingBox:process', input),
    history: (options?: Record<string, unknown>) => ipcRenderer.invoke('anythingBox:history', options),
  },

  // エージェントシステム関連
  agents: {
    create: (options: AgentConfig) => ipcRenderer.invoke('agents:create', options),
    startDiscussion: (options: DiscussionParams) => ipcRenderer.invoke('agents:startDiscussion', options),
    pauseSession: (sessionId: string) => ipcRenderer.invoke('agents:pauseSession', sessionId),
    resumeSession: (sessionId: string) => ipcRenderer.invoke('agents:resumeSession', sessionId),
    getSession: (sessionId: string) => ipcRenderer.invoke('agents:getSession', sessionId),
    getAllSessions: () => ipcRenderer.invoke('agents:getAllSessions'),
    getDiscussionHistory: (options?: Record<string, unknown>) =>
      ipcRenderer.invoke('agents:getDiscussionHistory', options),
    requestWritingSuggestions: (context: WritingContext) =>
      ipcRenderer.invoke('agents:requestWritingSuggestions', context),
    // 新しいディスカッションマネージャーAPI
    start: (topic: string, context?: any, options?: any) => 
      ipcRenderer.invoke('discussion:start', topic, context, options),
    pause: () => ipcRenderer.invoke('discussion:pause'),
    resume: () => ipcRenderer.invoke('discussion:resume'),
    addHumanIntervention: (content: string) => ipcRenderer.invoke('discussion:addHumanIntervention', content),
    getStatus: () => ipcRenderer.invoke('discussion:getStatus'),
    getMessages: (discussionId: string, limit?: number) => 
      ipcRenderer.invoke('discussion:getMessages', discussionId, limit),
    getAgents: () => ipcRenderer.invoke('discussion:getAgents'),
    getHistory: (limit?: number) => ipcRenderer.invoke('discussion:getHistory', limit),
    setAutonomousMode: (enabled: boolean, options?: any) => 
      ipcRenderer.invoke('discussion:setAutonomousMode', enabled, options),
    getTokenUsage: (discussionId: string) => ipcRenderer.invoke('discussion:getTokenUsage', discussionId),
    getSummarizationConfig: () => ipcRenderer.invoke('discussion:getSummarizationConfig'),
    updateSummarizationConfig: (config: any) => ipcRenderer.invoke('discussion:updateSummarizationConfig', config),
    getSummaries: (discussionId: string) => ipcRenderer.invoke('discussion:getSummaries', discussionId),
    submitHumanIntervention: (discussionId: string, intervention: any) => 
      ipcRenderer.invoke('discussion:submitHumanIntervention', discussionId, intervention),

    // リアルタイムイベントのリスナー
    onMessage: (callback: (data: unknown) => void) => {
      ipcRenderer.on('agent-message', (_, data) => callback(data));
    },
    onSessionStarted: (callback: (data: unknown) => void) => {
      ipcRenderer.on('session-started', (_, data) => callback(data));
    },
    onSessionConcluded: (callback: (data: unknown) => void) => {
      ipcRenderer.on('session-concluded', (_, data) => callback(data));
    },
    // 新しいDiscussionManagerイベントリスナー
    onDiscussionStarted: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discussion-started', (_, data) => callback(data));
    },
    onAgentSpoke: (callback: (data: unknown) => void) => {
      ipcRenderer.on('agent-spoke', (_, data) => callback(data));
    },
    onDiscussionCompleted: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discussion-completed', (_, data) => callback(data));
    },
    onDiscussionPaused: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discussion-paused', (_, data) => callback(data));
    },
    onDiscussionResumed: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discussion-resumed', (_, data) => callback(data));
    },
    onDiscussionError: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discussion-error', (_, data) => callback(data));
    },
    onHumanIntervention: (callback: (data: unknown) => void) => {
      ipcRenderer.on('human-intervention', (_, data) => callback(data));
    },
    onSummarizationStarted: (callback: (data: unknown) => void) => {
      ipcRenderer.on('summarization-started', (_, data) => callback(data));
    },
    onSummarizationCompleted: (callback: (data: unknown) => void) => {
      ipcRenderer.on('summarization-completed', (_, data) => callback(data));
    },
    onAgentStatusUpdate: (callback: (data: unknown) => void) => {
      ipcRenderer.on('agent-status-update', (_, data) => callback(data));
    },
    onProgressUpdate: (callback: (data: unknown) => void) => {
      ipcRenderer.on('progress-update', (_, data) => callback(data));
    },
  },

  // プロット管理関連
  plots: {
    create: (data: PlotData) => ipcRenderer.invoke('plots:create', data),
    fork: (plotId: string, modifications: Partial<PlotData>) =>
      ipcRenderer.invoke('plots:fork', plotId, modifications),
    get: (plotId: string) => ipcRenderer.invoke('plots:get', plotId),
    history: (projectId: string) => ipcRenderer.invoke('plots:history', projectId),
    updateStatus: (plotId: string, status: string) =>
      ipcRenderer.invoke('plots:updateStatus', plotId, status),
  },

  // チャプター管理関連
  chapters: {
    create: (chapter: ChapterData) => ipcRenderer.invoke('chapters:create', chapter),
    update: (id: string, updates: Partial<ChapterData>) => ipcRenderer.invoke('chapters:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('chapters:delete', id),
    get: (id: string) => ipcRenderer.invoke('chapters:get', id),
    listByPlot: (plotId: string) => ipcRenderer.invoke('chapters:listByPlot', plotId),
  },

  // プロット生成ワークフロー関連
  plotGen: {
    start: (request: PlotGenerationRequest) => ipcRenderer.invoke('plotGen:start', request),
    getSession: (sessionId: string) => ipcRenderer.invoke('plotGen:getSession', sessionId),
    getSessions: () => ipcRenderer.invoke('plotGen:getSessions'),
    cancel: (sessionId: string) => ipcRenderer.invoke('plotGen:cancel', sessionId),
    addIntervention: (sessionId: string, content: string) => 
      ipcRenderer.invoke('plotGen:addIntervention', sessionId, content),
  },
});
