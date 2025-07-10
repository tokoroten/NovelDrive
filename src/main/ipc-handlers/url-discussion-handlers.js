const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const URLDiscussionService = require('../services/url-discussion-service');
const AnythingBoxService = require('../services/anything-box-service');

const logger = getLogger('url-discussion-handlers');

/**
 * Register URL discussion handlers
 */
function registerURLDiscussionHandlers(mainWindow, db, repositories) {
  const urlDiscussionService = new URLDiscussionService(repositories);
  const anythingBoxService = new AnythingBoxService(repositories);
  
  // URLからアイディアを生成
  ipcMain.handle('urlDiscussion:generateIdeas', async (event, { url, projectId }) => {
    try {
      logger.info(`Generating ideas from URL: ${url}`);
      
      // まずURLコンテンツを取得
      const urlContent = await anythingBoxService.fetchURLContent(url);
      urlContent.url = url; // URLを追加
      
      // AIディスカッションでアイディアを生成
      const result = await urlDiscussionService.generateIdeasFromURL(urlContent, projectId);
      
      logger.info('Successfully generated ideas from URL');
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Failed to generate ideas from URL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // URLディスカッションの履歴を取得
  ipcMain.handle('urlDiscussion:getHistory', async (event, projectId) => {
    try {
      const history = await repositories.knowledge.findBy('project_id', projectId);
      
      // URL生成のアイディアのみフィルタリング
      const urlIdeas = history.filter(item => {
        try {
          const metadata = JSON.parse(item.metadata || '{}');
          return metadata.source === 'url_discussion';
        } catch {
          return false;
        }
      });
      
      return {
        success: true,
        data: urlIdeas
      };
    } catch (error) {
      logger.error('Failed to get URL discussion history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // ディスカッションの詳細を取得
  ipcMain.handle('urlDiscussion:getDetail', async (event, ideaId) => {
    try {
      const idea = await repositories.knowledge.findById(ideaId);
      
      if (!idea) {
        throw new Error('Idea not found');
      }
      
      // コンテンツをパース
      const content = JSON.parse(idea.content);
      
      return {
        success: true,
        data: {
          idea,
          discussion: content.discussion || [],
          decision: content.decision || {},
          url: content.url,
          urlTitle: content.urlTitle
        }
      };
    } catch (error) {
      logger.error('Failed to get discussion detail:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // アイディアをプロットに変換
  ipcMain.handle('urlDiscussion:convertToPlot', async (event, { ideaId, projectId }) => {
    try {
      const idea = await repositories.knowledge.findById(ideaId);
      
      if (!idea) {
        throw new Error('Idea not found');
      }
      
      const content = JSON.parse(idea.content);
      const decision = content.decision;
      
      // プロットを作成
      const plot = {
        project_id: projectId,
        title: decision.title || 'URLから生成されたプロット',
        premise: decision.summary || '',
        themes: decision.themes || [],
        characters: decision.characters || [],
        settings: decision.settings || {},
        conflicts: decision.conflicts || [],
        structure: decision.structure || {},
        key_scenes: decision.keyScenes || [],
        metadata: JSON.stringify({
          source: 'url_discussion',
          sourceIdeaId: ideaId,
          sourceUrl: content.url,
          generatedAt: new Date().toISOString()
        })
      };
      
      const savedPlot = await repositories.plots.create(plot);
      
      return {
        success: true,
        data: savedPlot
      };
    } catch (error) {
      logger.error('Failed to convert idea to plot:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  logger.info('URL discussion handlers registered');
}

module.exports = { registerURLDiscussionHandlers };