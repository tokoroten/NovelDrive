import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // 設定関連
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },
  
  // DuckDB関連
  database: {
    query: (sql: string, params?: any[]) => 
      ipcRenderer.invoke('db:query', sql, params),
    execute: (sql: string, params?: any[]) => 
      ipcRenderer.invoke('db:execute', sql, params),
  },
  
  // 日本語処理関連
  tokenizer: {
    tokenize: (text: string) => ipcRenderer.invoke('tokenizer:tokenize', text),
  },
  
  // ナレッジ管理
  knowledge: {
    save: (knowledge: any) => ipcRenderer.invoke('knowledge:save', knowledge),
  },
  
  // ファイル操作
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path),
    write: (path: string, content: string) => 
      ipcRenderer.invoke('file:write', path, content),
    exists: (path: string) => ipcRenderer.invoke('file:exists', path),
  },
  
  // AI関連
  ai: {
    chat: (messages: any[], options?: any) => 
      ipcRenderer.invoke('ai:chat', messages, options),
    embed: (text: string) => ipcRenderer.invoke('ai:embed', text),
    generateImage: (prompt: string, options?: any) =>
      ipcRenderer.invoke('ai:generateImage', prompt, options),
    extractInspiration: (text: string, type: string) =>
      ipcRenderer.invoke('ai:extractInspiration', text, type),
    extractContent: (html: string, url: string) =>
      ipcRenderer.invoke('ai:extractContent', html, url),
    // Thread API関連
    createThread: (metadata?: any) =>
      ipcRenderer.invoke('ai:createThread', metadata),
    addMessage: (threadId: string, content: string, role?: string) =>
      ipcRenderer.invoke('ai:addMessage', threadId, content, role),
    createAssistant: (name: string, instructions: string, model?: string, temperature?: number) =>
      ipcRenderer.invoke('ai:createAssistant', name, instructions, model, temperature),
    runAssistant: (threadId: string, assistantId: string, instructions?: string) =>
      ipcRenderer.invoke('ai:runAssistant', threadId, assistantId, instructions),
    getThreadMessages: (threadId: string) =>
      ipcRenderer.invoke('ai:getThreadMessages', threadId),
    deleteThread: (threadId: string) =>
      ipcRenderer.invoke('ai:deleteThread', threadId),
  },
  
  // 検索関連
  search: {
    serendipity: (query: string, options?: any) =>
      ipcRenderer.invoke('search:serendipity', query, options),
    hybrid: (query: string, options?: any) =>
      ipcRenderer.invoke('search:hybrid', query, options),
    related: (itemId: string, options?: any) =>
      ipcRenderer.invoke('search:related', itemId, options),
  },
  
  // Webクローラー関連
  crawler: {
    crawl: (url: string, depth: number, options?: any) =>
      ipcRenderer.invoke('crawler:crawl', url, depth, options),
  },
  
  // Anything Box関連
  anythingBox: {
    process: (input: any) =>
      ipcRenderer.invoke('anythingBox:process', input),
    history: (options?: any) =>
      ipcRenderer.invoke('anythingBox:history', options),
  },
  
  // エージェントシステム関連
  agents: {
    create: (options: any) =>
      ipcRenderer.invoke('agents:create', options),
    startDiscussion: (options: any) =>
      ipcRenderer.invoke('agents:startDiscussion', options),
    pauseSession: (sessionId: string) =>
      ipcRenderer.invoke('agents:pauseSession', sessionId),
    resumeSession: (sessionId: string) =>
      ipcRenderer.invoke('agents:resumeSession', sessionId),
    getSession: (sessionId: string) =>
      ipcRenderer.invoke('agents:getSession', sessionId),
    getAllSessions: () =>
      ipcRenderer.invoke('agents:getAllSessions'),
    getDiscussionHistory: (options?: any) =>
      ipcRenderer.invoke('agents:getDiscussionHistory', options),
    
    // リアルタイムイベントのリスナー
    onMessage: (callback: (data: any) => void) => {
      ipcRenderer.on('agent-message', (_, data) => callback(data));
    },
    onSessionStarted: (callback: (data: any) => void) => {
      ipcRenderer.on('session-started', (_, data) => callback(data));
    },
    onSessionConcluded: (callback: (data: any) => void) => {
      ipcRenderer.on('session-concluded', (_, data) => callback(data));
    },
  },
});