/**
 * データベースハンドラー（リポジトリパターン版）
 */

import { ipcMain } from 'electron';
import * as duckdb from 'duckdb';
import { createRepositories, RepositoryContainer } from '../repositories';
import { SearchOptions } from '../repositories/types';

export function setupDatabaseHandlers(conn: duckdb.Connection): void {
  const repositories = createRepositories(conn);

  // プロジェクト関連
  setupProjectHandlers(repositories);
  
  // 知識管理関連
  setupKnowledgeHandlers(repositories);
  
  // キャラクター関連
  setupCharacterHandlers(repositories);
  
  // プロット関連
  setupPlotHandlers(repositories);
  
  // 章関連
  setupChapterHandlers(repositories);
  
  // ディスカッション関連
  setupDiscussionHandlers(repositories);
  
  // 設定関連
  setupSettingsHandlers(repositories);
  
  // 分析関連
  setupAnalyticsHandlers(repositories);
  
  // 検索関連
  setupSearchHandlers(repositories);
}

function setupProjectHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:projects:create', async (_, project) => {
    try {
      return await repos.projects.create(project);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:get', async (_, id) => {
    try {
      return await repos.projects.findById(id);
    } catch (error) {
      console.error('Failed to get project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:update', async (_, id, updates) => {
    try {
      return await repos.projects.update(id, updates);
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:delete', async (_, id) => {
    try {
      return await repos.projects.delete(id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:list', async () => {
    try {
      return await repos.projects.findAll();
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw error;
    }
  });
}

function setupKnowledgeHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:knowledge:create', async (_, knowledge) => {
    try {
      return await repos.knowledge.create(knowledge);
    } catch (error) {
      console.error('Failed to create knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:get', async (_, id) => {
    try {
      return await repos.knowledge.findById(id);
    } catch (error) {
      console.error('Failed to get knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:update', async (_, id, updates) => {
    try {
      return await repos.knowledge.update(id, updates);
    } catch (error) {
      console.error('Failed to update knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:delete', async (_, id) => {
    try {
      return await repos.knowledge.delete(id);
    } catch (error) {
      console.error('Failed to delete knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:list', async (_, projectId) => {
    try {
      if (projectId) {
        return await repos.knowledge.findByProject(projectId);
      }
      // プロジェクトIDが指定されていない場合は全件取得
      return await repos.knowledge.getMany('SELECT * FROM knowledge ORDER BY created_at DESC', []);
    } catch (error) {
      console.error('Failed to list knowledge:', error);
      throw error;
    }
  });
}

function setupCharacterHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:characters:create', async (_, character) => {
    try {
      return await repos.characters.create(character);
    } catch (error) {
      console.error('Failed to create character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:get', async (_, id) => {
    try {
      return await repos.characters.findById(id);
    } catch (error) {
      console.error('Failed to get character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:update', async (_, id, updates) => {
    try {
      return await repos.characters.update(id, updates);
    } catch (error) {
      console.error('Failed to update character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:delete', async (_, id) => {
    try {
      return await repos.characters.delete(id);
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:list', async (_, projectId) => {
    try {
      return await repos.characters.findByProject(projectId);
    } catch (error) {
      console.error('Failed to list characters:', error);
      throw error;
    }
  });
}

function setupPlotHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:plots:create', async (_, plot) => {
    try {
      return await repos.plots.create(plot);
    } catch (error) {
      console.error('Failed to create plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:get', async (_, id) => {
    try {
      return await repos.plots.findById(id);
    } catch (error) {
      console.error('Failed to get plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:update', async (_, id, updates) => {
    try {
      return await repos.plots.update(id, updates);
    } catch (error) {
      console.error('Failed to update plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:delete', async (_, id) => {
    try {
      return await repos.plots.delete(id);
    } catch (error) {
      console.error('Failed to delete plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:list', async (_, projectId) => {
    try {
      return await repos.plots.findByProject(projectId);
    } catch (error) {
      console.error('Failed to list plots:', error);
      throw error;
    }
  });
}

function setupChapterHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:chapters:create', async (_, chapter) => {
    try {
      return await repos.chapters.create(chapter);
    } catch (error) {
      console.error('Failed to create chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:get', async (_, id) => {
    try {
      return await repos.chapters.findById(id);
    } catch (error) {
      console.error('Failed to get chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:update', async (_, id, updates) => {
    try {
      return await repos.chapters.update(id, updates);
    } catch (error) {
      console.error('Failed to update chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:delete', async (_, id) => {
    try {
      return await repos.chapters.delete(id);
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:list', async (_, plotId) => {
    try {
      return await repos.chapters.findByPlot(plotId);
    } catch (error) {
      console.error('Failed to list chapters:', error);
      throw error;
    }
  });
}

function setupDiscussionHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:discussions:create', async (_, discussion) => {
    try {
      return await repos.discussions.create(discussion);
    } catch (error) {
      console.error('Failed to create discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:get', async (_, id) => {
    try {
      return await repos.discussions.findById(id);
    } catch (error) {
      console.error('Failed to get discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:list', async (_, projectId) => {
    try {
      if (projectId) {
        return await repos.discussions.findByProject(projectId);
      }
      return await repos.discussions.getMany('SELECT * FROM agent_discussions ORDER BY created_at DESC', []);
    } catch (error) {
      console.error('Failed to list discussions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:addMessage', async (_, message) => {
    try {
      return await repos.discussions.addMessage(message);
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:getMessages', async (_, discussionId) => {
    try {
      return await repos.discussions.getMessages(discussionId);
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  });
}

function setupSettingsHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:settings:get', async (_, key) => {
    try {
      return await repos.settings.get(key);
    } catch (error) {
      console.error('Failed to get setting:', error);
      throw error;
    }
  });

  ipcMain.handle('db:settings:set', async (_, key, value) => {
    try {
      return await repos.settings.set(key, value);
    } catch (error) {
      console.error('Failed to set setting:', error);
      throw error;
    }
  });

  ipcMain.handle('db:settings:getAll', async () => {
    try {
      return await repos.settings.getAll();
    } catch (error) {
      console.error('Failed to get all settings:', error);
      throw error;
    }
  });
}

function setupAnalyticsHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:analytics:overview', async () => {
    try {
      return await repos.analytics.getOverview();
    } catch (error) {
      console.error('Failed to get analytics overview:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analytics:activity', async (_, startDate, endDate) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await repos.analytics.getActivityData(start, end);
    } catch (error) {
      console.error('Failed to get activity data:', error);
      throw error;
    }
  });
}

function setupSearchHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:search:hybrid', async (_, options: SearchOptions) => {
    try {
      return await repos.knowledge.search(options);
    } catch (error) {
      console.error('Failed to perform hybrid search:', error);
      throw error;
    }
  });

  ipcMain.handle('db:links:create', async (_, link) => {
    try {
      // 知識リンクの作成（将来的に実装）
      return { success: true };
    } catch (error) {
      console.error('Failed to create link:', error);
      throw error;
    }
  });

  ipcMain.handle('db:links:getForNode', async (_, nodeId) => {
    try {
      // ノードのリンク取得（将来的に実装）
      return [];
    } catch (error) {
      console.error('Failed to get links:', error);
      throw error;
    }
  });
}