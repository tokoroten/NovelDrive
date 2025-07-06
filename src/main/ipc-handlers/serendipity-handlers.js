const { ipcMain } = require('electron');
const SerendipitySearchService = require('../services/serendipity-search-service');
const { getLogger } = require('../utils/logger');

/**
 * Setup serendipity search related IPC handlers
 * @param {Object} repositories
 */
async function setupSerendipityHandlers(repositories) {
  const logger = getLogger();
  const serendipityService = new SerendipitySearchService(repositories);
  
  // Initialize the service
  await serendipityService.initialize();

  // セレンディピティ検索
  ipcMain.handle('serendipity:search', async (event, projectId, query, options) => {
    logger.info(`Serendipity search request: ${query}`);
    try {
      const results = await serendipityService.search(projectId, query, options);
      return { success: true, data: results };
    } catch (error) {
      logger.error('Serendipity search failed:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // 関連アイテム検索
  ipcMain.handle('serendipity:findRelated', async (event, itemId, options) => {
    logger.info(`Finding related items for: ${itemId}`);
    try {
      const results = await serendipityService.findRelated(itemId, options);
      return { success: true, data: results };
    } catch (error) {
      logger.error('Find related failed:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // インスピレーション発見
  ipcMain.handle('serendipity:discover', async (event, projectId, options) => {
    logger.info(`Discovering inspirations for project: ${projectId}`);
    try {
      const results = await serendipityService.discoverInspirations(projectId, options);
      return { success: true, data: results };
    } catch (error) {
      logger.error('Discover inspirations failed:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // 設定更新
  ipcMain.handle('serendipity:updateConfig', async (event, newConfig) => {
    logger.info('Updating serendipity config');
    try {
      serendipityService.updateConfig(newConfig);
      return { success: true };
    } catch (error) {
      logger.error('Config update failed:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // 設定取得
  ipcMain.handle('serendipity:getConfig', async () => {
    try {
      return { success: true, data: serendipityService.config };
    } catch (error) {
      logger.error('Get config failed:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  logger.info('Serendipity handlers setup complete');
}

module.exports = setupSerendipityHandlers;