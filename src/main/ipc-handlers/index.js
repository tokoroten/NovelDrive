const setupProjectHandlers = require('./project-handlers');
const setupAnythingBoxHandlers = require('./anything-box-handlers');
const setupSerendipityHandlers = require('./serendipity-handlers');
const setupKnowledgeHandlers = require('./knowledge-handlers');
const setupPlotHandlers = require('./plot-handlers');

/**
 * Setup all IPC handlers
 * @param {Object} db - Database instance
 */
function setupIPCHandlers(db) {
  // Setup handlers for different domains
  setupProjectHandlers(db);
  setupAnythingBoxHandlers(db);
  setupSerendipityHandlers(db);
  setupKnowledgeHandlers(db);
  setupPlotHandlers(db);
  
  // More handlers will be added here:
  // setupCharacterHandlers(db);
  // setupAgentHandlers(db);
}

module.exports = setupIPCHandlers;