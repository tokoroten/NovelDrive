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

import * as duckdb from 'duckdb';
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
export function createRepositories(conn: duckdb.Connection): RepositoryContainer {
  return {
    projects: new ProjectRepository(conn),
    knowledge: new KnowledgeRepository(conn),
    characters: new CharacterRepository(conn),
    plots: new PlotRepository(conn),
    chapters: new ChapterRepository(conn),
    discussions: new DiscussionRepository(conn),
    settings: new SettingsRepository(conn),
    analytics: new AnalyticsRepository(conn)
  };
}