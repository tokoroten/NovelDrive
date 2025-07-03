const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      // Strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  invoke: async (channel, data) => {
    const validChannels = [
      'dialog:open', 
      'db:query',
      'db:getCounter',
      'db:incrementCounter',
      'db:addItem',
      'db:getItems',
      // Project channels
      'project:getAll',
      'project:getById',
      'project:create',
      'project:update',
      'project:delete',
      'project:getActivitySummary',
      'project:export'
    ];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
  }
});