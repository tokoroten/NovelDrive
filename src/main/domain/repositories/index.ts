/**
 * リポジトリインターフェース定義
 * データアクセスの抽象化層
 */

import { 
  Knowledge, 
  Plot, 
  Project, 
  Character, 
  WorldSetting 
} from '../entities';

/**
 * 知識リポジトリインターフェース
 */
export interface IKnowledgeRepository {
  save(knowledge: Knowledge): Promise<void>;
  findById(id: string): Promise<Knowledge | null>;
  findByIds(ids: string[]): Promise<Knowledge[]>;
  findByProjectId(projectId: string): Promise<Knowledge[]>;
  findByType(type: string): Promise<Knowledge[]>;
  search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
  }): Promise<Knowledge[]>;
  searchSimilar(embedding: number[], options?: {
    limit?: number;
    threshold?: number;
  }): Promise<Knowledge[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsByUrl(url: string): Promise<boolean>;
}

/**
 * プロットリポジトリインターフェース
 */
export interface IPlotRepository {
  save(plot: Plot): Promise<void>;
  findById(id: string): Promise<Plot | null>;
  findByProjectId(projectId: string): Promise<Plot[]>;
  findByVersion(projectId: string, version: string): Promise<Plot | null>;
  findChildren(plotId: string): Promise<Plot[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * プロジェクトリポジトリインターフェース
 */
export interface IProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  findByStatus(status: string): Promise<Project[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * キャラクターリポジトリインターフェース
 */
export interface ICharacterRepository {
  save(character: Character): Promise<void>;
  findById(id: string): Promise<Character | null>;
  findByProjectId(projectId: string): Promise<Character[]>;
  findByName(projectId: string, name: string): Promise<Character | null>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * 世界設定リポジトリインターフェース
 */
export interface IWorldSettingRepository {
  save(setting: WorldSetting): Promise<void>;
  findById(id: string): Promise<WorldSetting | null>;
  findByProjectId(projectId: string): Promise<WorldSetting[]>;
  findByCategory(projectId: string, category: string): Promise<WorldSetting[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * Unit of Work パターンのインターフェース
 */
export interface IUnitOfWork {
  knowledgeRepository: IKnowledgeRepository;
  plotRepository: IPlotRepository;
  projectRepository: IProjectRepository;
  characterRepository: ICharacterRepository;
  worldSettingRepository: IWorldSettingRepository;
  
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}