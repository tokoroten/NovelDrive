const setupProjectHandlers = require('./project-handlers');

/**
 * Setup all IPC handlers
 * @param {Object} db - Database instance
 */
function setupIPCHandlers(db) {
  // Setup handlers for different domains
  setupProjectHandlers(db);
  
  // More handlers will be added here:
  // setupKnowledgeHandlers(db);
  // setupCharacterHandlers(db);
  // setupPlotHandlers(db);
  // setupAgentHandlers(db);
}

module.exports = setupIPCHandlers;