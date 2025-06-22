/**
 * バックアップ・リストアサービス
 * プロジェクトデータの定期バックアップと復元機能を提供
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  projectIds: string[];
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
  version: string;
  checksum: string;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  maxBackups: number;
  includeLogs: boolean;
  compressBackups: boolean;
  backupLocation: string;
}

export interface RestoreOptions {
  projectIds?: string[];
  overwriteExisting: boolean;
  createNewProject: boolean;
  restoreSettings: boolean;
}

export class BackupService extends EventEmitter {
  private static instance: BackupService;
  private conn: duckdb.Connection;
  private config: BackupConfig;
  private backupTimer: NodeJS.Timeout | null = null;
  private backupDir: string;

  private constructor(conn: duckdb.Connection) {
    super();
    this.conn = conn;
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.ensureBackupDirectory();
    
    // デフォルト設定
    this.config = {
      enabled: true,
      intervalHours: 24,
      maxBackups: 10,
      includeLogs: false,
      compressBackups: true,
      backupLocation: this.backupDir,
    };
    
    this.loadConfig();
    this.scheduleAutoBackup();
  }

  static getInstance(conn: duckdb.Connection): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService(conn);
    }
    return BackupService.instance;
  }

  /**
   * バックアップディレクトリの作成
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 設定の読み込み
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await this.queryDatabase(
        'SELECT value FROM app_settings WHERE key = ?',
        ['backup_config']
      );
      
      if (result.length > 0) {
        this.config = { ...this.config, ...JSON.parse(result[0].value) };
      }
    } catch (error) {
      console.error('Failed to load backup config:', error);
    }
  }

  /**
   * 設定の保存
   */
  async updateConfig(newConfig: Partial<BackupConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    try {
      await this.executeDatabase(
        `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
        ['backup_config', JSON.stringify(this.config)]
      );
      
      // 自動バックアップのスケジュール更新
      this.scheduleAutoBackup();
      
      this.emit('configUpdated', this.config);
    } catch (error) {
      console.error('Failed to save backup config:', error);
      throw error;
    }
  }

  /**
   * 手動バックアップの作成
   */
  async createBackup(options: {
    name: string;
    description?: string;
    projectIds?: string[];
  }): Promise<BackupMetadata> {
    const backupId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}_${backupId}.json`;
    const backupPath = path.join(this.config.backupLocation, filename);

    try {
      this.emit('backupStarted', { id: backupId, name: options.name });

      // データのエクスポート
      const data = await this.exportData(options.projectIds);
      
      // メタデータの作成
      const metadata: BackupMetadata = {
        id: backupId,
        name: options.name,
        description: options.description,
        projectIds: options.projectIds || await this.getAllProjectIds(),
        size: 0,
        createdAt: new Date().toISOString(),
        type: 'manual',
        version: '1.0.0',
        checksum: '',
      };

      // バックアップファイルの作成
      const backupContent = {
        metadata,
        data,
        created: new Date().toISOString(),
      };

      const content = JSON.stringify(backupContent, null, 2);
      fs.writeFileSync(backupPath, content);

      // メタデータの更新
      metadata.size = fs.statSync(backupPath).size;
      metadata.checksum = this.calculateChecksum(content);

      // バックアップ履歴の記録
      await this.recordBackup(metadata, backupPath);

      // 古いバックアップの削除
      await this.cleanupOldBackups();

      this.emit('backupCompleted', metadata);
      return metadata;

    } catch (error) {
      this.emit('backupFailed', { id: backupId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * 自動バックアップの作成
   */
  private async createAutoBackup(): Promise<void> {
    try {
      const projectIds = await this.getAllProjectIds();
      if (projectIds.length === 0) {
        console.log('No projects found, skipping auto backup');
        return;
      }

      await this.createBackup({
        name: `自動バックアップ ${new Date().toLocaleDateString('ja-JP')}`,
        description: '定期自動バックアップ',
        projectIds,
      });

      console.log('Auto backup completed successfully');
    } catch (error) {
      console.error('Auto backup failed:', error);
      this.emit('autoBackupFailed', error);
    }
  }

  /**
   * バックアップからの復元
   */
  async restoreFromBackup(backupId: string, options: RestoreOptions): Promise<void> {
    try {
      this.emit('restoreStarted', { backupId, options });

      // バックアップファイルの読み込み
      const backupData = await this.loadBackup(backupId);
      
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // データの検証
      if (!this.validateBackupData(backupData)) {
        throw new Error('Invalid backup data');
      }

      // 復元の実行
      await this.executeRestore(backupData, options);

      this.emit('restoreCompleted', { backupId });

    } catch (error) {
      this.emit('restoreFailed', { backupId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * バックアップ一覧の取得
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const result = await this.queryDatabase(
        `SELECT * FROM backup_history ORDER BY created_at DESC`,
        []
      );

      return result.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        projectIds: JSON.parse(row.project_ids || '[]'),
        size: row.size,
        createdAt: row.created_at,
        type: row.type,
        version: row.version,
        checksum: row.checksum,
      }));
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * バックアップの削除
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      // データベースからの削除
      await this.executeDatabase(
        'DELETE FROM backup_history WHERE id = ?',
        [backupId]
      );

      // ファイルの削除
      const backupFiles = fs.readdirSync(this.config.backupLocation);
      const targetFile = backupFiles.find(file => file.includes(backupId));
      
      if (targetFile) {
        const filePath = path.join(this.config.backupLocation, targetFile);
        fs.unlinkSync(filePath);
      }

      this.emit('backupDeleted', { id: backupId });

    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * データのエクスポート
   */
  private async exportData(projectIds?: string[]): Promise<any> {
    const data: any = {};

    // プロジェクトデータ
    let projectWhere = '';
    let projectParams: any[] = [];
    
    if (projectIds && projectIds.length > 0) {
      projectWhere = ` WHERE id IN (${projectIds.map(() => '?').join(',')})`;
      projectParams = projectIds;
    }

    data.projects = await this.queryDatabase(`SELECT * FROM projects${projectWhere}`, projectParams);

    // 各プロジェクトに関連するデータ
    for (const project of data.projects) {
      const projectId = project.id;

      // 知識データ
      if (!data.knowledge) data.knowledge = [];
      const knowledge = await this.queryDatabase(
        'SELECT * FROM knowledge WHERE project_id = ?',
        [projectId]
      );
      data.knowledge.push(...knowledge);

      // キャラクターデータ
      if (!data.characters) data.characters = [];
      const characters = await this.queryDatabase(
        'SELECT * FROM characters WHERE project_id = ?',
        [projectId]
      );
      data.characters.push(...characters);

      // プロットデータ
      if (!data.plots) data.plots = [];
      const plots = await this.queryDatabase(
        'SELECT * FROM plots WHERE project_id = ?',
        [projectId]
      );
      data.plots.push(...plots);

      // チャプターデータ
      if (!data.chapters) data.chapters = [];
      const chapters = await this.queryDatabase(
        'SELECT * FROM chapters WHERE project_id = ?',
        [projectId]
      );
      data.chapters.push(...chapters);

      // エージェント議論データ
      if (!data.discussions) data.discussions = [];
      const discussions = await this.queryDatabase(
        'SELECT * FROM agent_discussions WHERE project_id = ?',
        [projectId]
      );
      data.discussions.push(...discussions);

      // 議論メッセージ
      if (!data.messages) data.messages = [];
      for (const discussion of discussions) {
        const messages = await this.queryDatabase(
          'SELECT * FROM agent_messages WHERE discussion_id = ?',
          [discussion.id]
        );
        data.messages.push(...messages);
      }

      // 自律モード設定とアクティビティ
      if (!data.autonomousConfig) data.autonomousConfig = [];
      const autoConfig = await this.queryDatabase(
        'SELECT * FROM autonomous_config WHERE project_id = ?',
        [projectId]
      );
      data.autonomousConfig.push(...autoConfig);

      if (!data.autonomousActivities) data.autonomousActivities = [];
      const autoActivities = await this.queryDatabase(
        'SELECT * FROM autonomous_activities WHERE project_id = ?',
        [projectId]
      );
      data.autonomousActivities.push(...autoActivities);
    }

    // グローバル設定（プロジェクト指定がない場合のみ）
    if (!projectIds) {
      data.settings = await this.queryDatabase('SELECT * FROM app_settings', []);
    }

    return data;
  }

  /**
   * 復元の実行
   */
  private async executeRestore(backupData: any, options: RestoreOptions): Promise<void> {
    const data = backupData.data;

    // トランザクション開始
    await this.executeDatabase('BEGIN TRANSACTION', []);

    try {
      // プロジェクトの復元
      if (data.projects) {
        for (const project of data.projects) {
          if (options.projectIds && !options.projectIds.includes(project.id)) {
            continue;
          }

          const newProjectId = options.createNewProject ? uuidv4() : project.id;
          
          if (options.overwriteExisting || options.createNewProject) {
            await this.executeDatabase(
              `INSERT OR REPLACE INTO projects 
               (id, name, description, genre, status, settings, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newProjectId,
                options.createNewProject ? `${project.name} (復元)` : project.name,
                project.description,
                project.genre,
                project.status,
                project.settings,
                project.created_at,
                new Date().toISOString()
              ]
            );

            // 関連データの復元
            await this.restoreProjectRelatedData(data, project.id, newProjectId);
          }
        }
      }

      // グローバル設定の復元
      if (data.settings && options.restoreSettings) {
        for (const setting of data.settings) {
          await this.executeDatabase(
            'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
            [setting.key, setting.value, new Date().toISOString()]
          );
        }
      }

      // トランザクションコミット
      await this.executeDatabase('COMMIT', []);

    } catch (error) {
      // ロールバック
      await this.executeDatabase('ROLLBACK', []);
      throw error;
    }
  }

  /**
   * プロジェクト関連データの復元
   */
  private async restoreProjectRelatedData(data: any, originalProjectId: string, newProjectId: string): Promise<void> {
    // 知識データ
    if (data.knowledge) {
      for (const knowledge of data.knowledge) {
        if (knowledge.project_id === originalProjectId) {
          await this.executeDatabase(
            `INSERT OR REPLACE INTO knowledge 
             (id, title, content, type, project_id, source_url, source_id, metadata, embedding, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              knowledge.title,
              knowledge.content,
              knowledge.type,
              newProjectId,
              knowledge.source_url,
              knowledge.source_id,
              knowledge.metadata,
              knowledge.embedding,
              knowledge.created_at,
              new Date().toISOString()
            ]
          );
        }
      }
    }

    // キャラクター、プロット、チャプターなど他のデータも同様に復元
    // （省略 - 同じパターンで実装）
  }

  /**
   * 自動バックアップのスケジューリング
   */
  private scheduleAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    if (this.config.enabled && this.config.intervalHours > 0) {
      const interval = this.config.intervalHours * 60 * 60 * 1000;
      this.backupTimer = setInterval(() => {
        this.createAutoBackup();
      }, interval);

      console.log(`Auto backup scheduled every ${this.config.intervalHours} hours`);
    }
  }

  /**
   * 古いバックアップの削除
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const autoBackups = backups.filter(b => b.type === 'auto');

      if (autoBackups.length > this.config.maxBackups) {
        const toDelete = autoBackups
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, autoBackups.length - this.config.maxBackups);

        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * バックアップの記録
   */
  private async recordBackup(metadata: BackupMetadata, filePath: string): Promise<void> {
    await this.executeDatabase(
      `INSERT INTO backup_history 
       (id, name, description, project_ids, size, created_at, type, version, checksum, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metadata.id,
        metadata.name,
        metadata.description,
        JSON.stringify(metadata.projectIds),
        metadata.size,
        metadata.createdAt,
        metadata.type,
        metadata.version,
        metadata.checksum,
        filePath
      ]
    );
  }

  /**
   * バックアップデータの読み込み
   */
  private async loadBackup(backupId: string): Promise<any> {
    const result = await this.queryDatabase(
      'SELECT file_path FROM backup_history WHERE id = ?',
      [backupId]
    );

    if (result.length === 0) {
      return null;
    }

    const filePath = result[0].file_path;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * バックアップデータの検証
   */
  private validateBackupData(backupData: any): boolean {
    return backupData && backupData.metadata && backupData.data;
  }

  /**
   * チェックサムの計算
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 全プロジェクトIDの取得
   */
  private async getAllProjectIds(): Promise<string[]> {
    const result = await this.queryDatabase('SELECT id FROM projects', []);
    return result.map(row => row.id);
  }

  /**
   * データベースクエリ実行
   */
  private queryDatabase(sql: string, params: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * データベース実行
   */
  private executeDatabase(sql: string, params: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 設定の取得
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * サービスの停止
   */
  stop(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }
}