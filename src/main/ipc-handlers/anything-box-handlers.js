const { ipcMain } = require('electron');
const { getErrorHandler, ValidationError } = require('../utils/error-handler');
const { RepositoryFactory } = require('../repositories');
const AnythingBoxService = require('../services/anything-box-service');

/**
 * Setup Anything Box IPC handlers
 * @param {Object} db - Database instance
 */
function setupAnythingBoxHandlers(db) {
  const errorHandler = getErrorHandler();
  const repositories = new RepositoryFactory(db);
  const anythingBoxService = new AnythingBoxService(repositories);
  
  // Process text input
  ipcMain.handle('anythingBox:processText', async (event, data) => {
    try {
      console.log('anythingBox:processText called with:', data);
      
      const { projectId, text, options } = data || {};
      
      if (!projectId) {
        throw new ValidationError('Project ID is required', 'projectId');
      }
      
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.error('Text validation failed:', { 
          text, 
          type: typeof text, 
          trimmed: text?.trim()
        });
        throw new ValidationError('Text content is required', 'text');
      }

      const result = await anythingBoxService.processText(projectId, text, options);
      return { success: true, data: result };
    } catch (error) {
      errorHandler.handle(error, 'anythingBox:processText');
      return { 
        success: false, 
        error: {
          message: error.message,
          type: error.name
        }
      };
    }
  });

  // Process URL input
  ipcMain.handle('anythingBox:processURL', async (event, data) => {
    try {
      console.log('anythingBox:processURL called with:', data);
      
      const { projectId, url, options } = data || {};
      
      if (!projectId) {
        throw new ValidationError('Project ID is required', 'projectId');
      }
      
      if (!url || typeof url !== 'string') {
        throw new ValidationError('URL is required', 'url');
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch (error) {
        throw new ValidationError('Invalid URL format', 'url');
      }

      const result = await anythingBoxService.processURL(projectId, url, options);
      return { success: true, data: result };
    } catch (error) {
      errorHandler.handle(error, 'anythingBox:processURL');
      return { 
        success: false, 
        error: {
          message: error.message,
          type: error.name
        }
      };
    }
  });

  // Process image input
  ipcMain.handle('anythingBox:processImage', errorHandler.wrapIPCHandler(async (event, projectId, imagePath, options) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }
    
    if (!imagePath || typeof imagePath !== 'string') {
      throw new ValidationError('Image path is required', 'imagePath');
    }

    return anythingBoxService.processImage(projectId, imagePath, options);
  }, 'anythingBox:processImage'));

  // Get recent entries
  ipcMain.handle('anythingBox:getRecent', async (event, data) => {
    try {
      const { projectId, limit = 50 } = data || {};
      
      if (!projectId) {
        throw new ValidationError('Project ID is required', 'projectId');
      }

      const result = await anythingBoxService.getRecentEntries(projectId, limit);
      return { success: true, data: result };
    } catch (error) {
      errorHandler.handle(error, 'anythingBox:getRecent');
      return { 
        success: false, 
        error: {
          message: error.message,
          type: error.name
        }
      };
    }
  });

  // Search entries
  ipcMain.handle('anythingBox:search', errorHandler.wrapIPCHandler(async (event, projectId, query) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }
    
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Search query is required', 'query');
    }

    return anythingBoxService.searchEntries(projectId, query);
  }, 'anythingBox:search'));

  // Get entry by ID
  ipcMain.handle('anythingBox:getById', errorHandler.wrapIPCHandler(async (event, entryId) => {
    if (!entryId) {
      throw new ValidationError('Entry ID is required', 'entryId');
    }

    return repositories.knowledge.findById(entryId);
  }, 'anythingBox:getById'));

  // Delete entry
  ipcMain.handle('anythingBox:delete', errorHandler.wrapIPCHandler(async (event, entryId) => {
    if (!entryId) {
      throw new ValidationError('Entry ID is required', 'entryId');
    }

    return repositories.knowledge.delete(entryId);
  }, 'anythingBox:delete'));

  // Abstract idea
  ipcMain.handle('anythingBox:abstract', errorHandler.wrapIPCHandler(async (event, data) => {
    if (!data.content) {
      throw new ValidationError('Content is required', 'content');
    }

    return anythingBoxService.abstractIdea(data.content, data.type, data.projectId);
  }, 'anythingBox:abstract'));

  // Concretize abstractions
  ipcMain.handle('anythingBox:concretize', errorHandler.wrapIPCHandler(async (event, data) => {
    if (!data.abstractions || !Array.isArray(data.abstractions)) {
      throw new ValidationError('Abstractions array is required', 'abstractions');
    }

    return anythingBoxService.concretizeIdea(data.abstractions, data.originalContent, data.projectId);
  }, 'anythingBox:concretize'));

  // Create new entry
  ipcMain.handle('anythingBox:create', errorHandler.wrapIPCHandler(async (event, data) => {
    if (!data.projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }
    
    if (!data.content) {
      throw new ValidationError('Content is required', 'content');
    }

    return anythingBoxService.createEntry(data);
  }, 'anythingBox:create'));
}

module.exports = setupAnythingBoxHandlers;