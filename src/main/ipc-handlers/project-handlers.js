const { ipcMain } = require('electron');
const { getErrorHandler } = require('../utils/error-handler');
const { RepositoryFactory } = require('../repositories');

/**
 * Setup project-related IPC handlers
 * @param {Object} db - Database instance
 */
function setupProjectHandlers(db) {
  const errorHandler = getErrorHandler();
  const repositories = new RepositoryFactory(db);
  
  // Get all projects
  ipcMain.handle('project:getAll', errorHandler.wrapIPCHandler(async () => {
    return repositories.projects.getActiveProjects();
  }, 'project:getAll'));

  // Get project by ID
  ipcMain.handle('project:getById', errorHandler.wrapIPCHandler(async (event, projectId) => {
    return repositories.projects.findWithStats(projectId);
  }, 'project:getById'));

  // Create new project
  ipcMain.handle('project:create', errorHandler.wrapIPCHandler(async (event, projectData) => {
    const { name, description, metadata } = projectData;
    
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Project name is required', 'name');
    }

    return repositories.projects.createWithDefaults({
      name,
      description: description || '',
      metadata: metadata ? JSON.stringify(metadata) : null
    });
  }, 'project:create'));

  // Update project
  ipcMain.handle('project:update', errorHandler.wrapIPCHandler(async (event, projectId, updates) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    const updateData = { ...updates };
    if (updateData.metadata && typeof updateData.metadata === 'object') {
      updateData.metadata = JSON.stringify(updateData.metadata);
    }

    return repositories.projects.update(projectId, updateData);
  }, 'project:update'));

  // Delete project
  ipcMain.handle('project:delete', errorHandler.wrapIPCHandler(async (event, projectId) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return repositories.projects.delete(projectId);
  }, 'project:delete'));

  // Get project activity summary
  ipcMain.handle('project:getActivitySummary', errorHandler.wrapIPCHandler(async (event, projectId, days = 7) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return repositories.projects.getActivitySummary(projectId, days);
  }, 'project:getActivitySummary'));

  // Export project
  ipcMain.handle('project:export', errorHandler.wrapIPCHandler(async (event, projectId) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return repositories.projects.exportProject(projectId);
  }, 'project:export'));
}

// Import ValidationError
const { ValidationError } = require('../utils/error-handler');

module.exports = setupProjectHandlers;