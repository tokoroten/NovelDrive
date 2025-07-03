/**
 * データベースハンドラー（リポジトリパターン版）
 */

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import { ConnectionManager } from '../core/database/connection-manager';
import { createRepositories, RepositoryContainer } from '../repositories';
import { SearchOptions } from '../repositories/types';

export function setupDatabaseHandlers(db: Database.Database): void {
  const connectionManager = ConnectionManager.getInstance();
  connectionManager.initialize({ path: db.filename });
  const repositories = createRepositories(connectionManager);

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

  ipcMain.handle('db:projects:get', async (_, id: string) => {
    try {
      return await repos.projects.findById(id);
    } catch (error) {
      console.error('Failed to get project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:update', async (_, id: string, updates) => {
    try {
      return await repos.projects.update(id, updates);
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:delete', async (_, id: string) => {
    try {
      await repos.projects.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:list', async (_, options?: SearchOptions) => {
    try {
      return await repos.projects.findAll(options);
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

  ipcMain.handle('db:knowledge:get', async (_, id: string) => {
    try {
      return await repos.knowledge.findById(id);
    } catch (error) {
      console.error('Failed to get knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:update', async (_, id: string, updates) => {
    try {
      return await repos.knowledge.update(id, updates);
    } catch (error) {
      console.error('Failed to update knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:delete', async (_, id: string) => {
    try {
      await repos.knowledge.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:search', async (_, options: SearchOptions) => {
    try {
      return await repos.knowledge.search(options);
    } catch (error) {
      console.error('Failed to search knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:findSimilar', async (_, id: string, limit: number = 10) => {
    try {
      return await repos.knowledge.findSimilar(id, limit);
    } catch (error) {
      console.error('Failed to find similar knowledge:', error);
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

  ipcMain.handle('db:characters:get', async (_, id: string) => {
    try {
      return await repos.characters.findById(id);
    } catch (error) {
      console.error('Failed to get character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:update', async (_, id: string, updates) => {
    try {
      return await repos.characters.update(id, updates);
    } catch (error) {
      console.error('Failed to update character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:delete', async (_, id: string) => {
    try {
      await repos.characters.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:listByProject', async (_, projectId: string) => {
    try {
      return await repos.characters.findByProjectId(projectId);
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

  ipcMain.handle('db:plots:get', async (_, id: string) => {
    try {
      return await repos.plots.findById(id);
    } catch (error) {
      console.error('Failed to get plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:update', async (_, id: string, updates) => {
    try {
      return await repos.plots.update(id, updates);
    } catch (error) {
      console.error('Failed to update plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:listByProject', async (_, projectId: string) => {
    try {
      return await repos.plots.findByProjectId(projectId);
    } catch (error) {
      console.error('Failed to list plots:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:getVersionHistory', async (_, projectId: string) => {
    try {
      return await repos.plots.getVersionHistory(projectId);
    } catch (error) {
      console.error('Failed to get version history:', error);
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

  ipcMain.handle('db:chapters:get', async (_, id: string) => {
    try {
      return await repos.chapters.findById(id);
    } catch (error) {
      console.error('Failed to get chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:update', async (_, id: string, updates) => {
    try {
      return await repos.chapters.update(id, updates);
    } catch (error) {
      console.error('Failed to update chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:delete', async (_, id: string) => {
    try {
      await repos.chapters.delete(id);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:listByPlot', async (_, plotId: string) => {
    try {
      return await repos.chapters.findByPlotId(plotId);
    } catch (error) {
      console.error('Failed to list chapters:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:reorder', async (_, plotId: string, chapterIds: string[]) => {
    try {
      return await repos.chapters.reorderChapters(plotId, chapterIds);
    } catch (error) {
      console.error('Failed to reorder chapters:', error);
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

  ipcMain.handle('db:discussions:get', async (_, id: string) => {
    try {
      return await repos.discussions.findById(id);
    } catch (error) {
      console.error('Failed to get discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:update', async (_, id: string, updates) => {
    try {
      return await repos.discussions.update(id, updates);
    } catch (error) {
      console.error('Failed to update discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:listByProject', async (_, projectId: string) => {
    try {
      return await repos.discussions.findByProjectId(projectId);
    } catch (error) {
      console.error('Failed to list discussions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:addMessage', async (_, discussionId: string, message) => {
    try {
      return await repos.discussions.addMessage(discussionId, message);
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:getMessages', async (_, discussionId: string) => {
    try {
      return await repos.discussions.getMessages(discussionId);
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  });
}

function setupSettingsHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:settings:get', async (_, key: string) => {
    try {
      return await repos.settings.get(key);
    } catch (error) {
      console.error('Failed to get setting:', error);
      throw error;
    }
  });

  ipcMain.handle('db:settings:set', async (_, key: string, value: any) => {
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

  ipcMain.handle('db:settings:delete', async (_, key: string) => {
    try {
      await repos.settings.delete(key);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete setting:', error);
      throw error;
    }
  });
}

function setupAnalyticsHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:analytics:getProjectStats', async (_, projectId: string) => {
    try {
      return await repos.analytics.getProjectStats(projectId);
    } catch (error) {
      console.error('Failed to get project stats:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analytics:getSystemStats', async () => {
    try {
      return await repos.analytics.getSystemStats();
    } catch (error) {
      console.error('Failed to get system stats:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analytics:getWritingProgress', async (_, projectId: string, days: number = 30) => {
    try {
      return await repos.analytics.getWritingProgress(projectId, days);
    } catch (error) {
      console.error('Failed to get writing progress:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analytics:getKnowledgeGrowth', async (_, projectId?: string, days: number = 30) => {
    try {
      return await repos.analytics.getKnowledgeGrowth(projectId, days);
    } catch (error) {
      console.error('Failed to get knowledge growth:', error);
      throw error;
    }
  });
}

function setupSearchHandlers(repos: RepositoryContainer) {
  ipcMain.handle('db:search:global', async (_, query: string, options?: SearchOptions) => {
    try {
      const results = {
        projects: await repos.projects.search({ ...options, query }),
        knowledge: await repos.knowledge.search({ ...options, query }),
        characters: await repos.characters.search({ ...options, query }),
        chapters: await repos.chapters.search({ ...options, query })
      };
      return results;
    } catch (error) {
      console.error('Failed to perform global search:', error);
      throw error;
    }
  });

  ipcMain.handle('db:search:byType', async (_, type: string, query: string, options?: SearchOptions) => {
    try {
      const searchOptions = { ...options, query };
      
      switch (type) {
        case 'projects':
          // TODO: Implement search method
          throw new Error('Search not yet implemented for projects');
        case 'knowledge':
          // TODO: Implement search method
          throw new Error('Search not yet implemented for knowledge');
        case 'characters':
          // TODO: Implement search method
          throw new Error('Search not yet implemented for characters');
        case 'chapters':
          // TODO: Implement search method
          throw new Error('Search not yet implemented for chapters');
        default:
          throw new Error(`Unknown search type: ${type}`);
      }
    } catch (error) {
      console.error(`Failed to search ${type}:`, error);
      throw error;
    }
  });
}