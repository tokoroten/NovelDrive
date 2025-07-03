const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('./database');
const { createLogger } = require('./utils/logger');
const { getErrorHandler, ValidationError } = require('./utils/error-handler');

let mainWindow = null;
let db = null;

// Initialize logger and error handler
const logger = createLogger({
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
});
const errorHandler = getErrorHandler();

// Setup global error handlers
errorHandler.setupGlobalHandlers();

function createWindow() {
  logger.info('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });

  logger.info('Main window created successfully');
}

// IPC handlers with error handling
ipcMain.handle('db:getCounter', errorHandler.wrapIPCHandler(async () => {
  return db.getCounter();
}, 'db:getCounter'));

ipcMain.handle('db:incrementCounter', errorHandler.wrapIPCHandler(async () => {
  return db.incrementCounter();
}, 'db:incrementCounter'));

ipcMain.handle('db:addItem', errorHandler.wrapIPCHandler(async (event, text) => {
  if (!text || typeof text !== 'string') {
    throw new ValidationError('Text is required and must be a string', 'text');
  }
  return db.addItem(text);
}, 'db:addItem'));

ipcMain.handle('db:getItems', errorHandler.wrapIPCHandler(async () => {
  return db.getItems();
}, 'db:getItems'));

app.whenReady().then(() => {
  logger.info('Application ready, initializing...');
  
  try {
    // Initialize database
    db = new Database();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    app.quit();
    return;
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  
  if (db) {
    try {
      db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    }
  }
  
  if (process.platform !== 'darwin') {
    logger.info('Quitting application');
    app.quit();
  }
});