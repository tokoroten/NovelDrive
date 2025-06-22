/**
 * エクスポートサービス
 * プロジェクトや章のエクスポート機能を提供
 */

import * as duckdb from 'duckdb';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ExportOptions {
  format: 'txt' | 'md' | 'docx' | 'pdf';
  includeMetadata?: boolean;
  includeCharacters?: boolean;
  includeWorldSettings?: boolean;
  outputPath?: string;
}

export class ExportService {
  constructor(private conn: duckdb.Connection) {}

  /**
   * プロジェクトをエクスポート
   */
  async exportProject(projectId: string, options: ExportOptions): Promise<string> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const content = await this.buildProjectContent(project, options);
    const fileName = this.generateFileName(project.name, options.format);
    const outputPath = options.outputPath || process.cwd();
    const fullPath = path.join(outputPath, fileName);

    await this.writeFile(fullPath, content, options.format);
    return fullPath;
  }

  /**
   * 章をエクスポート
   */
  async exportChapter(chapterId: string, options: ExportOptions): Promise<string> {
    const chapter = await this.getChapter(chapterId);
    if (!chapter) {
      throw new Error('Chapter not found');
    }

    const content = this.formatChapter(chapter, options);
    const fileName = this.generateFileName(chapter.title, options.format);
    const outputPath = options.outputPath || process.cwd();
    const fullPath = path.join(outputPath, fileName);

    await this.writeFile(fullPath, content, options.format);
    return fullPath;
  }

  /**
   * プロジェクトコンテンツを構築
   */
  private async buildProjectContent(
    project: any,
    options: ExportOptions
  ): Promise<string> {
    let content = '';

    // タイトルとメタデータ
    content += this.formatTitle(project.name, options.format);
    
    if (options.includeMetadata) {
      content += this.formatMetadata(project, options.format);
    }

    // キャラクター情報
    if (options.includeCharacters) {
      const characters = await this.getProjectCharacters(project.id);
      if (characters.length > 0) {
        content += this.formatSection('登場人物', options.format);
        characters.forEach(char => {
          content += this.formatCharacter(char, options.format);
        });
      }
    }

    // 世界設定
    if (options.includeWorldSettings) {
      const settings = await this.getProjectWorldSettings(project.id);
      if (settings.length > 0) {
        content += this.formatSection('世界設定', options.format);
        settings.forEach(setting => {
          content += this.formatWorldSetting(setting, options.format);
        });
      }
    }

    // 章の内容
    const chapters = await this.getProjectChapters(project.id);
    content += this.formatSection('本文', options.format);
    
    for (const chapter of chapters) {
      content += this.formatChapter(chapter, options);
    }

    return content;
  }

  /**
   * フォーマット関連のヘルパーメソッド
   */
  private formatTitle(title: string, format: string): string {
    switch (format) {
      case 'md':
        return `# ${title}\n\n`;
      case 'txt':
      default:
        return `${title}\n${'='.repeat(title.length)}\n\n`;
    }
  }

  private formatSection(title: string, format: string): string {
    switch (format) {
      case 'md':
        return `\n## ${title}\n\n`;
      case 'txt':
      default:
        return `\n${title}\n${'-'.repeat(title.length)}\n\n`;
    }
  }

  private formatChapter(chapter: any, options: ExportOptions): string {
    let content = '';
    
    switch (options.format) {
      case 'md':
        content += `\n### 第${chapter.order}章 ${chapter.title}\n\n`;
        break;
      case 'txt':
      default:
        content += `\n第${chapter.order}章 ${chapter.title}\n\n`;
    }

    content += chapter.content + '\n';
    return content;
  }

  private formatCharacter(character: any, format: string): string {
    switch (format) {
      case 'md':
        return `**${character.name}**\n- 役割: ${character.role}\n- ${character.description}\n\n`;
      case 'txt':
      default:
        return `${character.name}\n  役割: ${character.role}\n  ${character.description}\n\n`;
    }
  }

  private formatWorldSetting(setting: any, format: string): string {
    switch (format) {
      case 'md':
        return `**${setting.name}**\n${setting.description}\n\n`;
      case 'txt':
      default:
        return `${setting.name}\n  ${setting.description}\n\n`;
    }
  }

  private formatMetadata(project: any, format: string): string {
    const metadata = `作成日: ${project.createdAt}\n更新日: ${project.updatedAt}\nステータス: ${project.status}\n`;
    
    switch (format) {
      case 'md':
        return `\n---\n${metadata}---\n\n`;
      case 'txt':
      default:
        return `\n${metadata}\n`;
    }
  }

  /**
   * ファイル名を生成
   */
  private generateFileName(baseName: string, format: string): string {
    const sanitized = baseName.replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龯]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${sanitized}_${timestamp}.${format}`;
  }

  /**
   * ファイルを書き込み
   */
  private async writeFile(filePath: string, content: string, format: string): Promise<void> {
    // 現在はテキストとMarkdownのみサポート
    if (format === 'txt' || format === 'md') {
      await fs.writeFile(filePath, content, 'utf-8');
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * データベースクエリヘルパー
   */
  private async getProject(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM projects WHERE id = ?',
        [id],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows?.[0] || null);
        }
      );
    });
  }

  private async getChapter(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM chapters WHERE id = ?',
        [id],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows?.[0] || null);
        }
      );
    });
  }

  private async getProjectChapters(projectId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT c.* FROM chapters c JOIN plots p ON c.plot_id = p.id WHERE p.project_id = ? ORDER BY c."order"',
        [projectId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  private async getProjectCharacters(projectId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM characters WHERE project_id = ? ORDER BY name',
        [projectId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  private async getProjectWorldSettings(projectId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM world_settings WHERE project_id = ? ORDER BY category, name',
        [projectId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}