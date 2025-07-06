const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Generic invoke method for IPC calls
  invoke: async (channel, data) => {
    return await ipcRenderer.invoke(channel, data);
  },
  
  // Event listeners
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  
  once: (channel, func) => {
    ipcRenderer.once(channel, (event, ...args) => func(...args));
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Project API
  project: {
    getAll: () => ipcRenderer.invoke('project:getAll'),
    getById: (id) => ipcRenderer.invoke('project:getById', id),
    create: (data) => ipcRenderer.invoke('project:create', data),
    update: (id, data) => ipcRenderer.invoke('project:update', { id, ...data }),
    delete: (id) => ipcRenderer.invoke('project:delete', id),
    getActivitySummary: (id) => ipcRenderer.invoke('project:getActivitySummary', id),
    export: (id, path) => ipcRenderer.invoke('project:export', { id, path })
  },
  
  // Anything Box API
  anythingBox: {
    processText: (text) => ipcRenderer.invoke('anythingBox:processText', { text }),
    processURL: (url) => ipcRenderer.invoke('anythingBox:processURL', { url }),
    processImage: (imagePath) => ipcRenderer.invoke('anythingBox:processImage', { imagePath }),
    getRecent: (limit) => ipcRenderer.invoke('anythingBox:getRecent', { limit }),
    search: (query) => ipcRenderer.invoke('anythingBox:search', { query }),
    getById: (id) => ipcRenderer.invoke('anythingBox:getById', { id }),
    delete: (id) => ipcRenderer.invoke('anythingBox:delete', { id })
  },
  
  // Serendipity API
  serendipity: {
    search: (params) => ipcRenderer.invoke('serendipity:search', params),
    gacha: (projectId) => ipcRenderer.invoke('serendipity:gacha', { projectId }),
    getHistory: (projectId) => ipcRenderer.invoke('serendipity:getHistory', { projectId }),
    saveIdea: (projectId, idea) => ipcRenderer.invoke('serendipity:saveIdea', { projectId, idea })
  },
  
  // Plot API
  plot: {
    create: (data) => ipcRenderer.invoke('plot:create', data),
    update: (id, data) => ipcRenderer.invoke('plot:update', { id, ...data }),
    delete: (id) => ipcRenderer.invoke('plot:delete', id),
    getByProject: (projectId) => ipcRenderer.invoke('plot:getByProject', projectId),
    getById: (id) => ipcRenderer.invoke('plot:getById', id),
    reorder: (projectId, plotIds) => ipcRenderer.invoke('plot:reorder', { projectId, plotIds })
  },
  
  // Chapter API
  chapter: {
    create: (data) => ipcRenderer.invoke('chapter:create', data),
    update: (id, data) => ipcRenderer.invoke('chapter:update', { id, ...data }),
    delete: (id) => ipcRenderer.invoke('chapter:delete', id),
    getByProject: (projectId) => ipcRenderer.invoke('chapter:getByProject', projectId),
    getById: (id) => ipcRenderer.invoke('chapter:getById', id),
    reorder: (projectId, chapterIds) => ipcRenderer.invoke('chapter:reorder', { projectId, chapterIds }),
    export: (id, format) => ipcRenderer.invoke('chapter:export', { id, format })
  },
  
  // Knowledge API
  knowledge: {
    create: (data) => ipcRenderer.invoke('knowledge:create', data),
    update: (id, data) => ipcRenderer.invoke('knowledge:update', { id, ...data }),
    delete: (id) => ipcRenderer.invoke('knowledge:delete', id),
    getByProject: (projectId) => ipcRenderer.invoke('knowledge:getByProject', projectId),
    getById: (id) => ipcRenderer.invoke('knowledge:getById', id),
    search: (projectId, query) => ipcRenderer.invoke('knowledge:search', { projectId, query }),
    getRelated: (id) => ipcRenderer.invoke('knowledge:getRelated', id),
    export: (projectId) => ipcRenderer.invoke('knowledge:export', projectId)
  },
  
  // Settings API
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    reset: () => ipcRenderer.invoke('settings:reset')
  },
  
  // Analytics API
  analytics: {
    getProjectStats: (projectId) => ipcRenderer.invoke('analytics:getProjectStats', projectId),
    getWritingProgress: (projectId, period) => ipcRenderer.invoke('analytics:getWritingProgress', { projectId, period }),
    getActivityHeatmap: (projectId) => ipcRenderer.invoke('analytics:getActivityHeatmap', projectId),
    getCharacterStats: (projectId) => ipcRenderer.invoke('analytics:getCharacterStats', projectId),
    getWordFrequency: (projectId) => ipcRenderer.invoke('analytics:getWordFrequency', projectId)
  },
  
  // Agent API
  agent: {
    getAgents: () => ipcRenderer.invoke('agent:getAgents'),
    startSession: (config) => ipcRenderer.invoke('agent:startSession', config),
    endSession: (sessionId) => ipcRenderer.invoke('agent:endSession', sessionId),
    discussTopic: (data) => ipcRenderer.invoke('agent:discussTopic', data),
    getSessionHistory: (sessionId) => ipcRenderer.invoke('agent:getSessionHistory', sessionId),
    onMessage: (callback) => {
      ipcRenderer.on('agent:message', (event, data) => callback(data));
    }
  },
  
  // OpenAI API
  openai: {
    getConfig: () => ipcRenderer.invoke('openai:getConfig'),
    setApiKey: (data) => ipcRenderer.invoke('openai:setApiKey', data),
    updateSettings: (settings) => ipcRenderer.invoke('openai:updateSettings', settings),
    testConnection: () => ipcRenderer.invoke('openai:testConnection'),
    generateCompletion: (data) => ipcRenderer.invoke('openai:generateCompletion', data)
  },
  
  // Personality API
  personality: {
    getPersonalities: (role) => ipcRenderer.invoke('personality:getPersonalities', { role }),
    selectPersonality: (data) => ipcRenderer.invoke('personality:selectPersonality', data),
    getSelected: () => ipcRenderer.invoke('personality:getSelected'),
    resetToDefault: (agentType) => ipcRenderer.invoke('personality:resetToDefault', { agentType })
  },
  
  // Autonomous Mode API
  autonomous: {
    start: (config) => ipcRenderer.invoke('autonomous:start', config),
    pause: () => ipcRenderer.invoke('autonomous:pause'),
    resume: () => ipcRenderer.invoke('autonomous:resume'),
    stop: () => ipcRenderer.invoke('autonomous:stop'),
    getStatus: () => ipcRenderer.invoke('autonomous:status'),
    getHistory: () => ipcRenderer.invoke('autonomous:history'),
    getSchedules: () => ipcRenderer.invoke('autonomous:schedules'),
    getOutputs: (sessionId, limit) => ipcRenderer.invoke('autonomous:outputs', { sessionId, limit }),
    export: (sessionId, exportPath) => ipcRenderer.invoke('autonomous:export', { sessionId, exportPath }),
    onEvent: (callback) => {
      ipcRenderer.on('autonomous:event', (event, data) => callback(data));
    }
  },
  
  // Dialog API
  dialog: {
    open: (options) => ipcRenderer.invoke('dialog:open', options),
    save: (options) => ipcRenderer.invoke('dialog:save', options),
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory')
  },
  
  // Cache API
  cache: {
    clear: () => ipcRenderer.invoke('cache:clear')
  },
  
  // Shell API
  shell: {
    openExternal: (data) => ipcRenderer.invoke('shell:openExternal', data)
  },
  
  // App API
  app: {
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  
  // Vector Search API
  vectorSearch: {
    search: (queryVector, projectId, options) => 
      ipcRenderer.invoke('vector-search:search', queryVector, projectId, options),
    searchByText: (text, projectId, options) => 
      ipcRenderer.invoke('vector-search:searchByText', text, projectId, options),
    findSimilar: (entityType, entityId, projectId, options) => 
      ipcRenderer.invoke('vector-search:findSimilar', entityType, entityId, projectId, options),
    knn: (queryVector, projectId, k, options) => 
      ipcRenderer.invoke('vector-search:knn', queryVector, projectId, k, options),
    cluster: (projectId, k, options) => 
      ipcRenderer.invoke('vector-search:cluster', projectId, k, options),
    getStatistics: (projectId) => 
      ipcRenderer.invoke('vector-search:getStatistics', projectId),
    clearCache: () => 
      ipcRenderer.invoke('vector-search:clearCache'),
    updateConfig: (config) => 
      ipcRenderer.invoke('vector-search:updateConfig', config)
  },
  
  // Vector Indexing API
  vectorIndex: {
    indexKnowledge: (knowledge) => 
      ipcRenderer.invoke('vector-index:indexKnowledge', knowledge),
    indexChapter: (chapter) => 
      ipcRenderer.invoke('vector-index:indexChapter', chapter),
    indexCharacter: (character) => 
      ipcRenderer.invoke('vector-index:indexCharacter', character),
    indexPlot: (plot) => 
      ipcRenderer.invoke('vector-index:indexPlot', plot),
    batchIndex: (items) => 
      ipcRenderer.invoke('vector-index:batchIndex', items),
    reindexProject: (projectId, options) => 
      ipcRenderer.invoke('vector-index:reindexProject', projectId, options),
    deleteIndex: (entityType, entityId) => 
      ipcRenderer.invoke('vector-index:deleteIndex', entityType, entityId),
    updateConfig: (config) => 
      ipcRenderer.invoke('vector-index:updateConfig', config)
  },
  
  // Embedding API
  embedding: {
    generate: (text) => 
      ipcRenderer.invoke('embedding:generate', text),
    generateBatch: (texts) => 
      ipcRenderer.invoke('embedding:generateBatch', texts),
    calculateSimilarity: (vec1, vec2) => 
      ipcRenderer.invoke('embedding:calculateSimilarity', vec1, vec2),
    calculateTextSimilarity: (text1, text2) => 
      ipcRenderer.invoke('embedding:calculateTextSimilarity', text1, text2)
  },
  
  // Utility functions
  showMessage: (message, type = 'info') => {
    // This can be implemented with a notification system
    console.log(`[${type}] ${message}`);
  }
});