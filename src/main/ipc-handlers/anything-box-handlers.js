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
  ipcMain.handle('anythingBox:processText', errorHandler.wrapIPCHandler(async (event, projectId, text, options) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }
    
    if (!text || typeof text !== 'string') {
      throw new ValidationError('Text content is required', 'text');
    }

    return anythingBoxService.processText(projectId, text, options);
  }, 'anythingBox:processText'));

  // Process URL input
  ipcMain.handle('anythingBox:processURL', errorHandler.wrapIPCHandler(async (event, projectId, url, options) => {
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

    return anythingBoxService.processURL(projectId, url, options);
  }, 'anythingBox:processURL'));

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
  ipcMain.handle('anythingBox:getRecent', errorHandler.wrapIPCHandler(async (event, projectId, limit) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return anythingBoxService.getRecentEntries(projectId, limit);
  }, 'anythingBox:getRecent'));

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
}

module.exports = setupAnythingBoxHandlers;