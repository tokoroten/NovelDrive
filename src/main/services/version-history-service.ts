/**
 * バージョン履歴サービス
 * ドキュメントの変更履歴を管理し、任意の時点への復元を提供
 */

import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface VersionEntry {
  id: string;
  documentId: string;
  documentType: 'chapter' | 'plot' | 'character' | 'knowledge' | 'project';
  version: number;
  title: string;
  content: string;
  metadata: Record<string, any>;
  changeType: 'create' | 'update' | 'delete' | 'restore';
  changeDescription?: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  previousVersionId?: string;
  checksum: string;
  size: number;
}

export interface VersionDiff {
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  summary: {
    linesAdded: number;
    linesDeleted: number;
    linesModified: number;
    charactersAdded: number;
    charactersDeleted: number;
  };
}

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'deleted' | 'modified';
  oldContent?: string; // for modifications
}

export interface VersionHistoryConfig {
  maxVersionsPerDocument: number;
  autoSaveVersions: boolean;
  saveIntervalMinutes: number;
  compressOldVersions: boolean;
  retentionPolicyDays: number;
}

export class VersionHistoryService extends EventEmitter {
  private static instance: VersionHistoryService;
  private conn: duckdb.Connection;
  private config: VersionHistoryConfig;

  private constructor(conn: duckdb.Connection) {
    super();
    this.conn = conn;
    
    // デフォルト設定
    this.config = {
      maxVersionsPerDocument: 50,
      autoSaveVersions: true,
      saveIntervalMinutes: 5,
      compressOldVersions: true,
      retentionPolicyDays: 365, // 1年間保持
    };
    
    this.loadConfig();
  }

  static getInstance(conn: duckdb.Connection): VersionHistoryService {
    if (!VersionHistoryService.instance) {
      VersionHistoryService.instance = new VersionHistoryService(conn);
    }
    return VersionHistoryService.instance;
  }

  /**
   * 新しいバージョンを作成
   */
  async createVersion(options: {
    documentId: string;
    documentType: VersionEntry['documentType'];
    title: string;
    content: string;
    metadata?: Record<string, any>;
    changeType: VersionEntry['changeType'];
    changeDescription?: string;
    authorId?: string;
    authorName?: string;
  }): Promise<VersionEntry> {
    const versionId = uuidv4();
    const timestamp = new Date().toISOString();
    const checksum = this.calculateChecksum(options.content);
    
    // 現在の最新バージョン番号を取得
    const currentVersion = await this.getLatestVersionNumber(options.documentId);
    const newVersionNumber = currentVersion + 1;

    // 前のバージョンIDを取得
    const previousVersion = await this.getLatestVersion(options.documentId);
    
    const versionEntry: VersionEntry = {
      id: versionId,
      documentId: options.documentId,
      documentType: options.documentType,
      version: newVersionNumber,
      title: options.title,
      content: options.content,
      metadata: options.metadata || {},
      changeType: options.changeType,
      changeDescription: options.changeDescription,
      authorId: options.authorId,
      authorName: options.authorName,
      createdAt: timestamp,
      previousVersionId: previousVersion?.id,
      checksum,
      size: options.content.length,
    };

    // データベースに保存
    await this.saveVersion(versionEntry);

    // 古いバージョンの削除（設定に基づく）
    await this.cleanupOldVersions(options.documentId);

    this.emit('versionCreated', versionEntry);
    return versionEntry;
  }

  /**
   * ドキュメントの全バージョン履歴を取得
   */
  async getVersionHistory(documentId: string, limit?: number): Promise<VersionEntry[]> {
    const sql = `
      SELECT * FROM version_history 
      WHERE document_id = ? 
      ORDER BY version DESC 
      ${limit ? `LIMIT ${limit}` : ''}
    `;
    
    const rows = await this.queryDatabase(sql, [documentId]);
    return rows.map(this.mapRowToVersionEntry);
  }

  /**
   * 特定バージョンの取得
   */
  async getVersion(versionId: string): Promise<VersionEntry | null> {
    const sql = 'SELECT * FROM version_history WHERE id = ?';
    const rows = await this.queryDatabase(sql, [versionId]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToVersionEntry(rows[0]);
  }

  /**
   * 最新バージョンの取得
   */
  async getLatestVersion(documentId: string): Promise<VersionEntry | null> {
    const sql = `
      SELECT * FROM version_history 
      WHERE document_id = ? 
      ORDER BY version DESC 
      LIMIT 1
    `;
    
    const rows = await this.queryDatabase(sql, [documentId]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToVersionEntry(rows[0]);
  }

  /**
   * バージョン間の差分を計算
   */
  async calculateDiff(fromVersionId: string, toVersionId: string): Promise<VersionDiff> {
    const fromVersion = await this.getVersion(fromVersionId);
    const toVersion = await this.getVersion(toVersionId);

    if (!fromVersion || !toVersion) {
      throw new Error('Version not found');
    }

    return this.computeTextDiff(fromVersion.content, toVersion.content);
  }

  /**
   * 特定バージョンへの復元
   */
  async restoreVersion(versionId: string, options?: {
    createNewVersion?: boolean;
    changeDescription?: string;
    authorId?: string;
    authorName?: string;
  }): Promise<VersionEntry> {
    const targetVersion = await this.getVersion(versionId);
    if (!targetVersion) {
      throw new Error('Version not found');
    }

    if (options?.createNewVersion !== false) {
      // 新しいバージョンとして復元
      const restoredVersion = await this.createVersion({
        documentId: targetVersion.documentId,
        documentType: targetVersion.documentType,
        title: targetVersion.title,
        content: targetVersion.content,
        metadata: { ...targetVersion.metadata, restoredFrom: versionId },
        changeType: 'restore',
        changeDescription: options?.changeDescription || `バージョン ${targetVersion.version} から復元`,
        authorId: options?.authorId,
        authorName: options?.authorName,
      });

      this.emit('versionRestored', { targetVersion, restoredVersion });
      return restoredVersion;
    } else {
      // 元のドキュメントを直接更新
      await this.updateDocument(targetVersion);
      this.emit('documentRestored', targetVersion);
      return targetVersion;
    }
  }

  /**
   * バージョンの削除
   */
  async deleteVersion(versionId: string): Promise<void> {
    // 最新バージョンの削除は禁止
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const latestVersion = await this.getLatestVersion(version.documentId);
    if (latestVersion && latestVersion.id === versionId) {
      throw new Error('Cannot delete the latest version');
    }

    await this.executeDatabase('DELETE FROM version_history WHERE id = ?', [versionId]);
    this.emit('versionDeleted', { versionId, documentId: version.documentId });
  }

  /**
   * ドキュメントタイプ別のバージョン履歴統計
   */
  async getVersionStatistics(documentType?: string, projectId?: string): Promise<{
    totalVersions: number;
    totalDocuments: number;
    averageVersionsPerDocument: number;
    oldestVersion: string;
    newestVersion: string;
    totalSize: number;
  }> {
    let whereClause = '';
    const params: any[] = [];

    if (documentType) {
      whereClause = 'WHERE document_type = ?';
      params.push(documentType);
    }

    if (projectId) {
      // プロジェクトIDでフィルタリング（ドキュメントIDに基づく）
      const projectFilter = projectId ? ` AND document_id IN (
        SELECT id FROM chapters WHERE project_id = ?
        UNION SELECT id FROM plots WHERE project_id = ?
        UNION SELECT id FROM characters WHERE project_id = ?
        UNION SELECT id FROM knowledge WHERE project_id = ?
      )` : '';
      
      if (projectFilter) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + projectFilter;
        params.push(projectId, projectId, projectId, projectId);
      }
    }

    const sql = `
      SELECT 
        COUNT(*) as total_versions,
        COUNT(DISTINCT document_id) as total_documents,
        AVG(CAST(COUNT(*) AS FLOAT)) as avg_versions_per_document,
        MIN(created_at) as oldest_version,
        MAX(created_at) as newest_version,
        SUM(size) as total_size
      FROM version_history 
      ${whereClause}
      GROUP BY document_id
    `;

    const result = await this.queryDatabase(sql, params);
    
    if (result.length === 0) {
      return {
        totalVersions: 0,
        totalDocuments: 0,
        averageVersionsPerDocument: 0,
        oldestVersion: '',
        newestVersion: '',
        totalSize: 0,
      };
    }

    // 実際の統計を再計算
    const statsQuery = `
      SELECT 
        COUNT(*) as total_versions,
        COUNT(DISTINCT document_id) as total_documents,
        MIN(created_at) as oldest_version,
        MAX(created_at) as newest_version,
        SUM(size) as total_size
      FROM version_history 
      ${whereClause}
    `;

    const stats = await this.queryDatabase(statsQuery, params);
    const row = stats[0];

    return {
      totalVersions: row.total_versions || 0,
      totalDocuments: row.total_documents || 0,
      averageVersionsPerDocument: row.total_documents > 0 ? (row.total_versions / row.total_documents) : 0,
      oldestVersion: row.oldest_version || '',
      newestVersion: row.newest_version || '',
      totalSize: row.total_size || 0,
    };
  }

  /**
   * 設定の更新
   */
  async updateConfig(newConfig: Partial<VersionHistoryConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    await this.executeDatabase(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      ['version_history_config', JSON.stringify(this.config)]
    );

    this.emit('configUpdated', this.config);
  }

  /**
   * 設定の読み込み
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await this.queryDatabase(
        'SELECT value FROM app_settings WHERE key = ?',
        ['version_history_config']
      );
      
      if (result.length > 0) {
        this.config = { ...this.config, ...JSON.parse(result[0].value) };
      }
    } catch (error) {
      console.error('Failed to load version history config:', error);
    }
  }

  /**
   * バージョンの保存
   */
  private async saveVersion(version: VersionEntry): Promise<void> {
    const sql = `
      INSERT INTO version_history 
      (id, document_id, document_type, version, title, content, metadata, 
       change_type, change_description, author_id, author_name, created_at, 
       previous_version_id, checksum, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.executeDatabase(sql, [
      version.id,
      version.documentId,
      version.documentType,
      version.version,
      version.title,
      version.content,
      JSON.stringify(version.metadata),
      version.changeType,
      version.changeDescription,
      version.authorId,
      version.authorName,
      version.createdAt,
      version.previousVersionId,
      version.checksum,
      version.size,
    ]);
  }

  /**
   * 最新バージョン番号の取得
   */
  private async getLatestVersionNumber(documentId: string): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(version), 0) as max_version 
      FROM version_history 
      WHERE document_id = ?
    `;
    
    const result = await this.queryDatabase(sql, [documentId]);
    return result[0]?.max_version || 0;
  }

  /**
   * 古いバージョンのクリーンアップ
   */
  private async cleanupOldVersions(documentId: string): Promise<void> {
    // 保持数を超えた古いバージョンの削除
    const sql = `
      DELETE FROM version_history 
      WHERE document_id = ? 
      AND version NOT IN (
        SELECT version FROM version_history 
        WHERE document_id = ? 
        ORDER BY version DESC 
        LIMIT ?
      )
    `;

    await this.executeDatabase(sql, [
      documentId,
      documentId,
      this.config.maxVersionsPerDocument,
    ]);

    // 保持期間を超えた古いバージョンの削除
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionPolicyDays);

    await this.executeDatabase(
      'DELETE FROM version_history WHERE document_id = ? AND created_at < ?',
      [documentId, retentionDate.toISOString()]
    );
  }

  /**
   * テキスト差分の計算
   */
  private computeTextDiff(fromText: string, toText: string): VersionDiff {
    const fromLines = fromText.split('\n');
    const toLines = toText.split('\n');

    const additions: DiffLine[] = [];
    const deletions: DiffLine[] = [];
    const modifications: DiffLine[] = [];

    let fromIndex = 0;
    let toIndex = 0;

    while (fromIndex < fromLines.length || toIndex < toLines.length) {
      if (fromIndex >= fromLines.length) {
        // 残りは全て追加
        additions.push({
          lineNumber: toIndex + 1,
          content: toLines[toIndex],
          type: 'added',
        });
        toIndex++;
      } else if (toIndex >= toLines.length) {
        // 残りは全て削除
        deletions.push({
          lineNumber: fromIndex + 1,
          content: fromLines[fromIndex],
          type: 'deleted',
        });
        fromIndex++;
      } else if (fromLines[fromIndex] === toLines[toIndex]) {
        // 同じ行
        fromIndex++;
        toIndex++;
      } else {
        // 異なる行 - 修正として扱う
        modifications.push({
          lineNumber: toIndex + 1,
          content: toLines[toIndex],
          oldContent: fromLines[fromIndex],
          type: 'modified',
        });
        fromIndex++;
        toIndex++;
      }
    }

    return {
      additions,
      deletions,
      modifications,
      summary: {
        linesAdded: additions.length,
        linesDeleted: deletions.length,
        linesModified: modifications.length,
        charactersAdded: additions.reduce((sum, line) => sum + line.content.length, 0),
        charactersDeleted: deletions.reduce((sum, line) => sum + line.content.length, 0),
      },
    };
  }

  /**
   * ドキュメントの更新
   */
  private async updateDocument(version: VersionEntry): Promise<void> {
    // ドキュメントタイプに応じて適切なテーブルを更新
    let tableName: string;
    let updateSql: string;

    switch (version.documentType) {
      case 'chapter':
        tableName = 'chapters';
        updateSql = 'UPDATE chapters SET title = ?, content = ?, updated_at = ? WHERE id = ?';
        break;
      case 'plot':
        tableName = 'plots';
        updateSql = 'UPDATE plots SET title = ?, synopsis = ?, updated_at = ? WHERE id = ?';
        break;
      case 'character':
        tableName = 'characters';
        updateSql = 'UPDATE characters SET name = ?, profile = ?, updated_at = ? WHERE id = ?';
        break;
      case 'knowledge':
        tableName = 'knowledge';
        updateSql = 'UPDATE knowledge SET title = ?, content = ?, updated_at = ? WHERE id = ?';
        break;
      case 'project':
        tableName = 'projects';
        updateSql = 'UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?';
        break;
      default:
        throw new Error(`Unknown document type: ${version.documentType}`);
    }

    await this.executeDatabase(updateSql, [
      version.title,
      version.content,
      new Date().toISOString(),
      version.documentId,
    ]);
  }

  /**
   * チェックサムの計算
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 行データをVersionEntryにマップ
   */
  private mapRowToVersionEntry(row: any): VersionEntry {
    return {
      id: row.id,
      documentId: row.document_id,
      documentType: row.document_type,
      version: row.version,
      title: row.title,
      content: row.content,
      metadata: JSON.parse(row.metadata || '{}'),
      changeType: row.change_type,
      changeDescription: row.change_description,
      authorId: row.author_id,
      authorName: row.author_name,
      createdAt: row.created_at,
      previousVersionId: row.previous_version_id,
      checksum: row.checksum,
      size: row.size,
    };
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
  getConfig(): VersionHistoryConfig {
    return { ...this.config };
  }
}