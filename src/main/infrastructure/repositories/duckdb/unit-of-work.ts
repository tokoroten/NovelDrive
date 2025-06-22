/**
 * DuckDB実装のUnit of Work
 */

import * as duckdb from 'duckdb';
import { IUnitOfWork, IKnowledgeRepository, IPlotRepository, IProjectRepository, ICharacterRepository, IWorldSettingRepository } from '../../../domain/repositories';
import { DuckDBKnowledgeRepository } from './knowledge-repository';
import { DuckDBPlotRepository } from './plot-repository';

export class DuckDBUnitOfWork implements IUnitOfWork {
  public readonly knowledgeRepository: IKnowledgeRepository;
  public readonly plotRepository: IPlotRepository;
  public readonly projectRepository: IProjectRepository;
  public readonly characterRepository: ICharacterRepository;
  public readonly worldSettingRepository: IWorldSettingRepository;
  
  private inTransaction = false;

  constructor(private conn: duckdb.Connection) {
    this.knowledgeRepository = new DuckDBKnowledgeRepository(conn);
    this.plotRepository = new DuckDBPlotRepository(conn);
    // TODO: Implement other repositories
    this.projectRepository = {} as IProjectRepository;
    this.characterRepository = {} as ICharacterRepository;
    this.worldSettingRepository = {} as IWorldSettingRepository;
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) {
      throw new Error('Transaction already in progress');
    }
    
    return new Promise((resolve, reject) => {
      this.conn.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else {
          this.inTransaction = true;
          resolve();
        }
      });
    });
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    
    return new Promise((resolve, reject) => {
      this.conn.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          this.inTransaction = false;
          resolve();
        }
      });
    });
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress');
    }
    
    return new Promise((resolve, reject) => {
      this.conn.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else {
          this.inTransaction = false;
          resolve();
        }
      });
    });
  }
}