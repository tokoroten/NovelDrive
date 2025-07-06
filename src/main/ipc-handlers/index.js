const setupProjectHandlers = require('./project-handlers');
const setupAnythingBoxHandlers = require('./anything-box-handlers');
const setupSerendipityHandlers = require('./serendipity-handlers');
const setupPlotHandlers = require('./plot-handlers');
const setupChapterHandlers = require('./chapter-handlers');

/**
 * Setup all IPC handlers
 * @param {Object} db - Database instance
 */
async function setupIPCHandlers(db) {
  // Setup handlers for different domains
  setupProjectHandlers(db);
  setupAnythingBoxHandlers(db);
  await setupSerendipityHandlers(db);
  setupPlotHandlers(db);
  setupChapterHandlers(db);
  
  // Note: Knowledge, Settings, Analytics, and Agent handlers are registered separately in main/index.js
  // because they have different export names or require additional parameters
}

module.exports = setupIPCHandlers;