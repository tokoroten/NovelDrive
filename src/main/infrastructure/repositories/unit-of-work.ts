/**
 * Unit of Work実装
 */

import * as duckdb from 'duckdb';
import { IUnitOfWork, IKnowledgeRepository, IPlotRepository, IProjectRepository, ICharacterRepository, IWorldSettingRepository } from '../../domain/repositories';
import { ConnectionPool } from '../../core/database/connection-pool';
import { EventBus } from '../../core/events/event-bus';
import { KnowledgeRepository } from './knowledge-repository';
import { PlotRepository } from './plot-repository';
import { ProjectRepository } from './project-repository';
import { CharacterRepository } from './character-repository';
import { WorldSettingRepository } from './world-setting-repository';

export class UnitOfWork implements IUnitOfWork {
  private _knowledge?: IKnowledgeRepository;
  private _plots?: IPlotRepository;
  private _projects?: IProjectRepository;
  private _characters?: ICharacterRepository;
  private _worldSettings?: IWorldSettingRepository;
  private pool: ConnectionPool;

  constructor(
    private db: duckdb.Database,
    private eventBus: EventBus
  ) {
    // 接続プールを初期化
    this.pool = new ConnectionPool(db, {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 5000
    });
  }

  get knowledgeRepository(): IKnowledgeRepository {
    if (!this._knowledge) {
      this._knowledge = new KnowledgeRepository(this.pool, this.eventBus);
    }
    return this._knowledge;
  }

  get plotRepository(): IPlotRepository {
    if (!this._plots) {
      this._plots = new PlotRepository(this.pool, this.eventBus);
    }
    return this._plots;
  }

  get projectRepository(): IProjectRepository {
    if (!this._projects) {
      this._projects = new ProjectRepository(this.pool, this.eventBus);
    }
    return this._projects;
  }

  get characterRepository(): ICharacterRepository {
    if (!this._characters) {
      this._characters = new CharacterRepository(this.pool, this.eventBus);
    }
    return this._characters;
  }

  get worldSettingRepository(): IWorldSettingRepository {
    if (!this._worldSettings) {
      this._worldSettings = new WorldSettingRepository(this.pool, this.eventBus);
    }
    return this._worldSettings;
  }

  async beginTransaction(): Promise<void> {
    // Main UnitOfWork doesn't support direct transaction control
    throw new Error('Use transaction() method instead');
  }

  async commit(): Promise<void> {
    throw new Error('Use transaction() method instead');
  }

  async rollback(): Promise<void> {
    throw new Error('Use transaction() method instead');
  }

  async transaction<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    // トランザクション用の新しいUoWインスタンスを作成
    const transactionalUoW = new TransactionalUnitOfWork(this.db, this.eventBus, this.pool);
    
    try {
      await transactionalUoW.begin();
      const result = await operation(transactionalUoW);
      await transactionalUoW.commit();
      return result;
    } catch (error) {
      await transactionalUoW.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    // リポジトリのクリーンアップ
    if (this._knowledge && 'close' in this._knowledge) {
      await (this._knowledge as any).close();
    }
    
    // 接続プールを閉じる
    await this.pool.close();
  }
}

/**
 * トランザクション用Unit of Work
 */
class TransactionalUnitOfWork implements IUnitOfWork {
  private _knowledge?: IKnowledgeRepository;
  private _plots?: IPlotRepository;
  private _projects?: IProjectRepository;
  private _characters?: ICharacterRepository;
  private _worldSettings?: IWorldSettingRepository;
  private conn?: duckdb.Connection;
  private committed = false;
  private rolledBack = false;

  constructor(
    private db: duckdb.Database,
    private eventBus: EventBus,
    private pool: ConnectionPool
  ) {}

  get knowledgeRepository(): IKnowledgeRepository {
    if (!this._knowledge) {
      this._knowledge = new KnowledgeRepository(this.pool, this.eventBus);
    }
    return this._knowledge;
  }

  get plotRepository(): IPlotRepository {
    if (!this._plots) {
      this._plots = new PlotRepository(this.pool, this.eventBus);
    }
    return this._plots;
  }

  get projectRepository(): IProjectRepository {
    if (!this._projects) {
      this._projects = new ProjectRepository(this.pool, this.eventBus);
    }
    return this._projects;
  }

  get characterRepository(): ICharacterRepository {
    if (!this._characters) {
      this._characters = new CharacterRepository(this.pool, this.eventBus);
    }
    return this._characters;
  }

  get worldSettingRepository(): IWorldSettingRepository {
    if (!this._worldSettings) {
      this._worldSettings = new WorldSettingRepository(this.pool, this.eventBus);
    }
    return this._worldSettings;
  }

  async beginTransaction(): Promise<void> {
    return this.begin();
  }

  async begin(): Promise<void> {
    if (this.conn) {
      throw new Error('Transaction already started');
    }

    return new Promise((resolve, reject) => {
      try {
        this.conn = this.db.connect();
        
        this.conn.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async commit(): Promise<void> {
    if (!this.conn) {
      throw new Error('No transaction to commit');
    }
    if (this.committed || this.rolledBack) {
      throw new Error('Transaction already completed');
    }

    return new Promise((resolve, reject) => {
      this.conn!.run('COMMIT', (err) => {
        if (err) {
          reject(err);
        } else {
          this.committed = true;
          resolve();
        }
      });
    });
  }

  async rollback(): Promise<void> {
    if (!this.conn) {
      return;
    }
    if (this.committed || this.rolledBack) {
      return;
    }

    return new Promise((resolve) => {
      this.conn!.run('ROLLBACK', () => {
        this.rolledBack = true;
        resolve();
      });
    });
  }

  async transaction<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    throw new Error('Nested transactions not supported');
  }
}