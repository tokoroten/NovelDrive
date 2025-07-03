const { contextBridge, ipcRenderer } = require('electron');

// 安全にAPIをレンダラープロセスに公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 既存のAPI（互換性のため残す）
  getCounter: () => ipcRenderer.invoke('get-counter'),
  incrementCounter: () => ipcRenderer.invoke('increment-counter'),
  
  // DuckDB WASM永続化用API
  saveDatabase: (data) => ipcRenderer.invoke('save-database', data),
  loadDatabase: () => ipcRenderer.invoke('load-database')
});