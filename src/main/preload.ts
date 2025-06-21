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
  },
  
  // Webクローラー関連
  crawler: {
    crawl: (url: string, depth: number, options?: any) =>
      ipcRenderer.invoke('crawler:crawl', url, depth, options),
  },
});