/**
 * リポジトリの統合エクスポート
 */

export * from './base-repository';
export * from './types';
export * from './project-repository';
export * from './knowledge-repository';
export * from './character-repository';
export * from './plot-repository';
export * from './chapter-repository';
export * from './discussion-repository';
export * from './settings-repository';
export * from './analytics-repository';

import Database from 'better-sqlite3';
import { ConnectionManager } from '../core/database/connection-manager';
import { ProjectRepository } from './project-repository';
import { KnowledgeRepository } from './knowledge-repository';
import { CharacterRepository } from './character-repository';
import { PlotRepository } from './plot-repository';
import { ChapterRepository } from './chapter-repository';
import { DiscussionRepository } from './discussion-repository';
import { SettingsRepository } from './settings-repository';
import { AnalyticsRepository } from './analytics-repository';

export interface RepositoryContainer {
  projects: ProjectRepository;
  knowledge: KnowledgeRepository;
  characters: CharacterRepository;
  plots: PlotRepository;
  chapters: ChapterRepository;
  discussions: DiscussionRepository;
  settings: SettingsRepository;
  analytics: AnalyticsRepository;
}

/**
 * すべてのリポジトリを初期化
 */
export function createRepositories(connectionManager: ConnectionManager): RepositoryContainer {
  return {
    projects: new ProjectRepository(connectionManager),
    knowledge: new KnowledgeRepository(connectionManager),
    characters: new CharacterRepository(connectionManager),
    plots: new PlotRepository(connectionManager),
    chapters: new ChapterRepository(connectionManager),
    discussions: new DiscussionRepository(connectionManager),
    settings: new SettingsRepository(connectionManager),
    analytics: new AnalyticsRepository(connectionManager)
  };
}