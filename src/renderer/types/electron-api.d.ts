interface AnythingBoxAPI {
  process: (input: Record<string, unknown>) => Promise<any>;
  history: (options?: Record<string, unknown>) => Promise<any[]>;
}

interface APIResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

interface ElectronAPI {
  getVersion: () => Promise<string>;
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  database: {
    query: (sql: string, params?: any[]) => Promise<any[]>;
    execute: (sql: string, params?: any[]) => Promise<void>;
    getDashboardStats: () => Promise<any>;
    getRecentActivities: (limit?: number) => Promise<any[]>;
    getInspirationOfTheDay: () => Promise<any>;
    createKnowledge: (data: any) => Promise<any>;
    updateKnowledge: (id: string, data: any) => Promise<any>;
    deleteKnowledge: (id: string) => Promise<void>;
    getKnowledge: (id: string) => Promise<any>;
    listKnowledge: (options?: any) => Promise<any[]>;
    createProject: (data: any) => Promise<any>;
    updateProject: (id: string, data: any) => Promise<any>;
    deleteProject: (id: string) => Promise<void>;
    getProject: (id: string) => Promise<any>;
    listProjects: (options?: any) => Promise<any[]>;
    createCharacter: (data: any) => Promise<any>;
    updateCharacter: (id: string, data: any) => Promise<any>;
    deleteCharacter: (id: string) => Promise<void>;
    getCharacter: (id: string) => Promise<any>;
    listCharacters: (options?: any) => Promise<any[]>;
    createPlot: (data: any) => Promise<any>;
    updatePlot: (id: string, data: any) => Promise<any>;
    deletePlot: (id: string) => Promise<void>;
    getPlot: (id: string) => Promise<any>;
    listPlots: (options?: any) => Promise<any[]>;
    createChapter: (data: any) => Promise<any>;
    updateChapter: (id: string, data: any) => Promise<any>;
    deleteChapter: (id: string) => Promise<void>;
    getChapter: (id: string) => Promise<any>;
    listChapters: (options?: any) => Promise<any[]>;
  };
  tokenizer: {
    tokenize: (text: string) => Promise<string[]>;
  };
  knowledge: {
    save: (knowledge: Record<string, unknown>) => Promise<any>;
  };
  file: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
  };
  ai: {
    chat: (messages: any[], options?: any) => Promise<any>;
    embed: (text: string) => Promise<number[]>;
    generateImage: (prompt: string, options?: any) => Promise<any>;
    extractInspiration: (text: string, type: string) => Promise<any>;
    extractContent: (html: string, url: string) => Promise<any>;
    createThread: (metadata?: Record<string, unknown>) => Promise<any>;
    addMessage: (threadId: string, content: string, role?: string) => Promise<any>;
    createAssistant: (name: string, instructions: string, model?: string, temperature?: number) => Promise<any>;
    runAssistant: (threadId: string, assistantId: string, instructions?: string) => Promise<any>;
    getThreadMessages: (threadId: string) => Promise<any[]>;
    deleteThread: (threadId: string) => Promise<void>;
  };
  search: {
    hybrid: (query: string, options?: any) => Promise<any[]>;
    related: (itemId: string, options?: any) => Promise<any[]>;
  };
  serendipity: {
    search: (query: string, options?: any) => Promise<any[]>;
  };
  crawler: {
    crawl: (url: string, depth: number, options?: any) => Promise<any>;
  };
  anythingBox: AnythingBoxAPI;
  agents: {
    create: (options: any) => Promise<any>;
    startDiscussion: (options: any) => Promise<any>;
    pauseSession: (sessionId: string) => Promise<APIResponse>;
    resumeSession: (sessionId: string) => Promise<APIResponse>;
    getSession: (sessionId: string) => Promise<any>;
    getAllSessions: () => Promise<APIResponse<any[]>>;
    getDiscussionHistory: (options?: Record<string, unknown>) => Promise<any[]>;
    requestWritingSuggestions: (context: any) => Promise<any>;
    start: (topic: string, context?: any, options?: any) => Promise<any>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    addHumanIntervention: (content: string) => Promise<void>;
    getStatus: () => Promise<any>;
    getMessages: (discussionId: string, limit?: number) => Promise<any[]>;
    getAgents: () => Promise<any[]>;
    getHistory: (limit?: number) => Promise<any[]>;
    setAutonomousMode: (enabled: boolean, options?: any) => Promise<void>;
    getTokenUsage: (discussionId: string) => Promise<any>;
    getSummarizationConfig: () => Promise<any>;
    updateSummarizationConfig: (config: any) => Promise<void>;
    getSummaries: (discussionId: string) => Promise<any[]>;
    submitHumanIntervention: (discussionId: string, intervention: any) => Promise<APIResponse>;
    onMessage: (callback: (data: any) => void) => void;
    onSessionStarted: (callback: (data: any) => void) => void;
    onSessionConcluded: (callback: (data: any) => void) => void;
    onDiscussionStarted: (callback: (data: any) => void) => void;
    onAgentSpoke: (callback: (data: any) => void) => void;
    onDiscussionCompleted: (callback: (data: any) => void) => void;
    onDiscussionPaused: (callback: (data: any) => void) => void;
    onDiscussionResumed: (callback: (data: any) => void) => void;
    onDiscussionError: (callback: (data: any) => void) => void;
    onHumanIntervention: (callback: (data: any) => void) => void;
    onSummarizationStarted: (callback: (data: any) => void) => void;
    onSummarizationCompleted: (callback: (data: any) => void) => void;
    onAgentStatusUpdate: (callback: (data: any) => void) => void;
    onProgressUpdate: (callback: (data: any) => void) => void;
  };
  plots: {
    create: (data: any) => Promise<any>;
    update: (plotId: string, data: any) => Promise<any>;
    fork: (plotId: string, modifications: any) => Promise<any>;
    get: (plotId: string) => Promise<any>;
    history: (projectId: string) => Promise<APIResponse<{ plots: any[] }>>;
    updateStatus: (plotId: string, status: string) => Promise<APIResponse>;
  };
  chapters: {
    create: (chapter: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    get: (id: string) => Promise<any>;
    listByPlot: (plotId: string) => Promise<any[]>;
  };
  plotGen: {
    start: (request: any) => Promise<APIResponse<any>>;
    getSession: (sessionId: string) => Promise<APIResponse<any>>;
    getSessions: () => Promise<APIResponse<any[]>>;
    cancel: (sessionId: string) => Promise<APIResponse>;
    addIntervention: (sessionId: string, content: string) => Promise<APIResponse>;
  };
  autonomous: {
    getConfig: () => Promise<any>;
    getStatus: () => Promise<any>;
    updateConfig: (config: any) => Promise<void>;
    start: () => Promise<void>;
    stop: () => Promise<void>;
  };
  backup: {
    create: (description?: string) => Promise<APIResponse>;
    restore: (backupId: string) => Promise<APIResponse>;
    list: () => Promise<APIResponse>;
    delete: (backupId: string) => Promise<APIResponse>;
    getSettings: () => Promise<any>;
    setAutoBackup: (enabled: boolean, intervalHours: number) => Promise<APIResponse>;
  };
  versionHistory: {
    create: (documentId: string, description?: string) => Promise<APIResponse>;
    list: (documentId?: string) => Promise<APIResponse>;
    restore: (versionId: string, options?: any) => Promise<APIResponse>;
    compare: (fromVersionId: string, toVersionId: string) => Promise<APIResponse>;
    diff: (fromVersionId: string, toVersionId: string) => Promise<APIResponse>;
    delete: (versionId: string) => Promise<APIResponse>;
    getStats: () => Promise<APIResponse>;
  };
  export: {
    exportDocument: (documentId: string, format: string, options?: any) => Promise<APIResponse>;
    exportDocuments: (documentIds: string[], format: string, options?: any) => Promise<APIResponse>;
  };
  discussion: {
    create: (options: any) => Promise<APIResponse>;
    sendHumanMessage: (sessionId: string, message: string) => Promise<APIResponse>;
    end: (sessionId: string) => Promise<APIResponse>;
  };
  plotBranching: {
    getBranchingStructure: (projectId: string) => Promise<APIResponse>;
    forkPlot: (plotId: string, branchName: string) => Promise<APIResponse>;
    mergePlots: (sourcePlotId: string, targetPlotId: string) => Promise<APIResponse>;
  };
  on?: (channel: string, callback: (...args: any[]) => void) => (() => void);
  off?: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};