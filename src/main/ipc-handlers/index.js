const setupProjectHandlers = require('./project-handlers');
const setupAnythingBoxHandlers = require('./anything-box-handlers');
const setupSerendipityHandlers = require('./serendipity-handlers');

/**
 * Setup all IPC handlers
 * @param {Object} db - Database instance
 */
function setupIPCHandlers(db) {
  // Setup handlers for different domains
  setupProjectHandlers(db);
  setupAnythingBoxHandlers(db);
  setupSerendipityHandlers(db);
  
  // More handlers will be added here:
  // setupKnowledgeHandlers(db);
  // setupCharacterHandlers(db);
  // setupPlotHandlers(db);
  // setupAgentHandlers(db);
}

module.exports = setupIPCHandlers;