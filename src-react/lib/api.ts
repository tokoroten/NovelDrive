// API client for communicating with Electron main process

interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, callback: (...args: any[]) => void) => void
  off: (channel: string, callback: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

const invoke = window.electronAPI.invoke

export const api = {
  project: {
    getAll: () => invoke('project:getAll'),
    getById: (projectId: string) => invoke('project:getById', { projectId }),
    create: (projectData: any) => invoke('project:create', projectData),
    update: (projectId: string, updates: any) => 
      invoke('project:update', { projectId, updates }),
    delete: (projectId: string) => invoke('project:delete', { projectId }),
    getContext: (projectId: string) => invoke('project:getContext', { projectId }),
  },
  
  knowledge: {
    create: (knowledgeData: any) => invoke('knowledge:create', knowledgeData),
    listByProject: (projectId: string) => 
      invoke('knowledge:listByProject', { projectId }),
    search: (projectId: string, query: string, options?: any) =>
      invoke('knowledge:search', { projectId, query, options }),
  },
  
  openai: {
    setApiKey: (apiKey: string) => invoke('openai:setApiKey', { apiKey }),
    getConfig: () => invoke('openai:getConfig'),
    generateText: (prompt: string, options?: any) =>
      invoke('openai:generateText', { prompt, options }),
    testConnection: (config: any) => invoke('openai:testConnection', config),
  },
  
  settings: {
    get: () => invoke('settings:get'),
    save: (settings: any) => invoke('settings:save', settings),
    reset: () => invoke('settings:reset'),
  },
  
  agent: {
    getAll: () => invoke('agent:getAll'),
    getStates: () => invoke('agent:getStates'),
    createSession: (projectId: string, type: string, participants: string[]) =>
      invoke('agent:createSession', { projectId, type, participants }),
    endSession: (sessionId: string) =>
      invoke('agent:endSession', { sessionId }),
    sendMessage: (sessionId: string, senderId: string, content: string, type?: string) =>
      invoke('agent:sendMessage', { sessionId, senderId, content, type }),
    getSessionMessages: (sessionId: string) =>
      invoke('agent:getSessionMessages', { sessionId }),
    getSessionsByProject: (projectId: string) =>
      invoke('agent:getSessionsByProject', { projectId }),
    createCustom: (agentData: any) =>
      invoke('agent:createCustom', agentData),
    update: (agentId: string, updates: any) =>
      invoke('agent:update', { agentId, updates }),
    delete: (agentId: string) =>
      invoke('agent:delete', { agentId }),
  },
  
  plot: {
    create: (plotData: any) => invoke('plot:create', plotData),
    getById: (plotId: string) => invoke('plot:getById', { plotId }),
    getByProject: (projectId: string) => invoke('plot:getByProject', { projectId }),
    update: (plotId: string, updates: any) =>
      invoke('plot:update', { plotId, updates }),
    delete: (plotId: string) => invoke('plot:delete', { plotId }),
  },
  
  chapter: {
    create: (chapterData: any) => invoke('chapter:create', chapterData),
    getById: (chapterId: string, includeContent = false) =>
      invoke('chapter:getById', { chapterId, includeContent }),
    getByPlot: (plotId: string, includeContent = false) =>
      invoke('chapter:getByPlot', { plotId, includeContent }),
    update: (chapterId: string, updates: any) =>
      invoke('chapter:update', { chapterId, updates }),
    delete: (chapterId: string) =>
      invoke('chapter:delete', { chapterId }),
    createVersion: (chapterId: string, content: string) =>
      invoke('chapter:createVersion', { chapterId, content }),
    getVersions: (chapterId: string) =>
      invoke('chapter:getVersions', { chapterId }),
  },
  
  scene: {
    create: (sceneData: any) => invoke('scene:create', sceneData),
    getByChapter: (chapterId: string) =>
      invoke('scene:getByChapter', { chapterId }),
  },
  
  statistics: {
    getWriting: (projectId: string) =>
      invoke('statistics:getWriting', { projectId }),
  },
  
  vector: {
    search: (projectId: string, query: string, options?: any) =>
      invoke('vector:search', { projectId, query, options }),
    findSimilar: (projectId: string, entityType: string, entityId: string, options?: any) =>
      invoke('vector:findSimilar', { projectId, entityType, entityId, options }),
    indexKnowledge: (knowledgeId: string) =>
      invoke('vector:indexKnowledge', { knowledgeId }),
    indexChapter: (chapterId: string) =>
      invoke('vector:indexChapter', { chapterId }),
    reindexProject: (projectId: string) =>
      invoke('vector:reindexProject', { projectId }),
    calculateSimilarity: (text1: string, text2: string) =>
      invoke('vector:calculateSimilarity', { text1, text2 }),
  },
}