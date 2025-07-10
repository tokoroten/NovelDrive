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

  // Get project statistics
  ipcMain.handle('project:getStats', errorHandler.wrapIPCHandler(async (event, projectId) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return repositories.projects.getProjectStats(projectId);
  }, 'project:getStats'));

  // Get project timeline
  ipcMain.handle('project:getTimeline', errorHandler.wrapIPCHandler(async (event, projectId, limit = 20) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    return repositories.projects.getTimeline(projectId, limit);
  }, 'project:getTimeline'));

  // Get project context for agents
  ipcMain.handle('project:getContext', errorHandler.wrapIPCHandler(async (event, { projectId }) => {
    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }

    // Get project details
    const project = await repositories.projects.findWithStats(projectId);
    if (!project) {
      throw new ValidationError('Project not found', 'projectId');
    }

    // Get recent chapters
    const chapters = await repositories.chapters.findByProject(projectId, { limit: 10 });
    
    // Get characters
    const characters = await repositories.characters.findByProject(projectId);
    
    // Get plot information
    const plots = await repositories.plots.getByProject(projectId);
    const currentPlot = plots[0] || null;
    
    // Get recent knowledge items
    const knowledge = await repositories.knowledge.findByProject(projectId, { limit: 20 });

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        wordCount: project.totalWords || 0,
        chapterCount: project.chapterCount || 0
      },
      chapters: chapters.map(ch => ({
        id: ch.id,
        number: ch.chapter_number,
        title: ch.title,
        wordCount: ch.word_count,
        status: ch.status
      })),
      characters: characters.map(char => ({
        id: char.id,
        name: char.name,
        description: char.description,
        personality: char.personality
      })),
      plot: currentPlot ? {
        id: currentPlot.id,
        title: currentPlot.title,
        summary: currentPlot.summary,
        structure: currentPlot.structure ? JSON.parse(currentPlot.structure) : null
      } : null,
      knowledge: knowledge.map(k => ({
        id: k.id,
        type: k.type,
        title: k.title,
        content: k.content
      }))
    };
  }, 'project:getContext'));
}

// Import ValidationError
const { ValidationError } = require('../utils/error-handler');

module.exports = setupProjectHandlers;