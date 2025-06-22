import { v4 as uuidv4 } from 'uuid';
import { ipcMain } from 'electron';
import * as duckdb from 'duckdb';

export interface PlotNode {
  id: string;
  projectId: string;
  version: string;
  parentVersion: string | null;
  title: string;
  synopsis: string;
  structure: PlotStructure;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // 'human' or agent ID
  metadata?: {
    emotionalBalance?: EmotionalBalance;
    conflictLevel?: number;
    paceScore?: number;
    originScore?: number; // 独創性スコア
    marketScore?: number; // 市場性スコア
  };
}

export interface PlotStructure {
  acts: Act[];
  totalChapters: number;
  estimatedLength: number; // 文字数
  genre: string;
  themes: string[];
  mainConflict: string;
  resolution: string;
}

export interface Act {
  actNumber: number;
  title: string;
  chapters: Chapter[];
  purpose: string; // この幕の目的
  keyEvents: string[];
}

export interface Chapter {
  chapterNumber: number;
  title: string;
  summary: string;
  scenes: Scene[];
  characters: string[]; // 登場キャラクターID
  estimatedLength: number;
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export interface Scene {
  sceneNumber: number;
  location: string;
  time: string;
  description: string;
  dialoguePlaceholders?: DialoguePlaceholder[];
}

export interface DialoguePlaceholder {
  character: string;
  intention: string; // 例: "感謝を伝える"
  context?: string;
}

export interface EmotionalBalance {
  overall: number; // -1 to 1 (negative to positive)
  byChapter: Array<{ chapter: number; balance: number }>;
  variance: number; // 感情の振れ幅
}

export class PlotManager {
  private conn: duckdb.Connection;

  constructor(conn: duckdb.Connection) {
    this.conn = conn;
  }

  /**
   * 新しいプロットを作成
   */
  async createPlot(
    projectId: string,
    baseData: {
      title: string;
      synopsis: string;
      structure: PlotStructure;
      parentVersion?: string;
      createdBy?: string;
    }
  ): Promise<PlotNode> {
    const version = await this.generateVersion(projectId, baseData.parentVersion);
    const plot: PlotNode = {
      id: uuidv4(),
      projectId,
      version,
      parentVersion: baseData.parentVersion || null,
      title: baseData.title,
      synopsis: baseData.synopsis,
      structure: baseData.structure,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: baseData.createdBy || 'human',
    };

    // 感情バランスを計算
    plot.metadata = {
      emotionalBalance: this.calculateEmotionalBalance(plot.structure),
      conflictLevel: this.calculateConflictLevel(plot.structure),
      paceScore: this.calculatePaceScore(plot.structure),
    };

    await this.savePlot(plot);
    return plot;
  }

  /**
   * プロットを分岐（新バージョン作成）
   */
  async forkPlot(plotId: string, modifications: Partial<PlotNode>): Promise<PlotNode> {
    const parentPlot = await this.getPlot(plotId);
    if (!parentPlot) {
      throw new Error('Parent plot not found');
    }

    const newPlot = await this.createPlot(parentPlot.projectId, {
      title: modifications.title || `${parentPlot.title} (改訂版)`,
      synopsis: modifications.synopsis || parentPlot.synopsis,
      structure: modifications.structure || parentPlot.structure,
      parentVersion: parentPlot.version,
      createdBy: modifications.createdBy || 'human',
    });

    return newPlot;
  }

  /**
   * バージョン文字列を生成（A, A', A'', B, B', etc.）
   */
  private async generateVersion(projectId: string, parentVersion?: string): Promise<string> {
    if (parentVersion) {
      // 親バージョンがある場合は派生版を作成
      const siblings = await this.getSiblingVersions(projectId, parentVersion);
      const primeCount = siblings.length;
      return parentVersion + "'".repeat(primeCount + 1);
    } else {
      // 新規バージョンの場合
      const existingVersions = await this.getAllVersions(projectId);
      const baseVersions = existingVersions
        .filter((v) => !v.includes("'"))
        .map((v) => v.charCodeAt(0))
        .sort((a, b) => b - a);

      const nextCharCode = baseVersions.length > 0 ? baseVersions[0] + 1 : 65; // 'A'
      return String.fromCharCode(nextCharCode);
    }
  }

  /**
   * 兄弟バージョンを取得
   */
  private async getSiblingVersions(projectId: string, parentVersion: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT version FROM plots WHERE project_id = ? AND parent_version = ?',
        [projectId, parentVersion],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map((r) => r.version));
        }
      );
    });
  }

  /**
   * プロジェクトの全バージョンを取得
   */
  private async getAllVersions(projectId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT version FROM plots WHERE project_id = ?',
        [projectId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map((r) => r.version));
        }
      );
    });
  }

  /**
   * 感情バランスを計算
   */
  private calculateEmotionalBalance(structure: PlotStructure): EmotionalBalance {
    const byChapter: Array<{ chapter: number; balance: number }> = [];
    let totalBalance = 0;
    let chapterCount = 0;

    structure.acts.forEach((act) => {
      act.chapters.forEach((chapter) => {
        const balance =
          chapter.emotionalTone === 'positive'
            ? 1
            : chapter.emotionalTone === 'negative'
              ? -1
              : chapter.emotionalTone === 'mixed'
                ? 0
                : 0;

        byChapter.push({ chapter: chapter.chapterNumber, balance });
        totalBalance += balance;
        chapterCount++;
      });
    });

    const overall = chapterCount > 0 ? totalBalance / chapterCount : 0;
    const variance = this.calculateVariance(byChapter.map((c) => c.balance));

    return { overall, byChapter, variance };
  }

  /**
   * 葛藤レベルを計算
   */
  private calculateConflictLevel(structure: PlotStructure): number {
    // 主要な葛藤の強さと、各章での展開を分析
    let conflictScore = 0;

    // メインコンフリクトの存在
    if (structure.mainConflict && structure.mainConflict.length > 20) {
      conflictScore += 3;
    }

    // 各幕でのイベント数（葛藤の展開）
    structure.acts.forEach((act) => {
      conflictScore += Math.min(act.keyEvents.length * 0.5, 2);
    });

    return Math.min(conflictScore / 10, 1); // 0-1に正規化
  }

  /**
   * ペーススコアを計算
   */
  private calculatePaceScore(structure: PlotStructure): number {
    // 章の長さの一貫性とシーン数のバランスを評価
    const chapterLengths: number[] = [];
    let totalScenes = 0;

    structure.acts.forEach((act) => {
      act.chapters.forEach((chapter) => {
        chapterLengths.push(chapter.estimatedLength);
        totalScenes += chapter.scenes.length;
      });
    });

    const avgLength = chapterLengths.reduce((a, b) => a + b, 0) / chapterLengths.length;
    const lengthVariance = this.calculateVariance(chapterLengths);

    // 長さの一貫性が高いほどスコアが高い
    const consistencyScore = 1 - Math.min(lengthVariance / avgLength, 1);

    // シーン数が適度（章あたり3-5シーン）であるほどスコアが高い
    const avgScenes = totalScenes / chapterLengths.length;
    const sceneScore = 1 - Math.abs(avgScenes - 4) / 4;

    return (consistencyScore + sceneScore) / 2;
  }

  /**
   * 分散を計算
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * プロットをデータベースに保存
   */
  private async savePlot(plot: PlotNode): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO plots (
          id, project_id, version, parent_version, title, synopsis,
          structure, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.conn.run(
        sql,
        [
          plot.id,
          plot.projectId,
          plot.version,
          plot.parentVersion,
          plot.title,
          plot.synopsis,
          JSON.stringify(plot.structure),
          plot.status,
          plot.createdAt,
          plot.updatedAt,
        ],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * プロットを取得
   */
  async getPlot(plotId: string): Promise<PlotNode | null> {
    return new Promise((resolve, reject) => {
      this.conn.all('SELECT * FROM plots WHERE id = ?', [plotId], (err: any, rows: any[]) => {
        if (err) return reject(err);
        const row = rows?.[0];
        if (!row) return resolve(null);
        
        resolve({
          ...row,
          structure: JSON.parse(row.structure),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        });
      });
    });
  }

  /**
   * プロジェクトのプロット履歴を取得（ツリー構造）
   */
  async getPlotHistory(projectId: string): Promise<PlotNode[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT * FROM plots WHERE project_id = ? ORDER BY created_at DESC',
        [projectId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else {
            const plots = rows.map((row) => ({
              ...row,
              structure: JSON.parse(row.structure),
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
            }));
            resolve(plots);
          }
        }
      );
    });
  }

  /**
   * プロットの承認状態を更新
   */
  async updatePlotStatus(
    plotId: string,
    status: 'draft' | 'reviewing' | 'approved' | 'rejected'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(
        'UPDATE plots SET status = ?, updated_at = ? WHERE id = ?',
        [status, new Date(), plotId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

/**
 * IPCハンドラーの設定
 */
export function setupPlotHandlers(conn: duckdb.Connection): void {
  const manager = new PlotManager(conn);

  ipcMain.handle('plots:create', async (_, data) => {
    try {
      const plot = await manager.createPlot(data.projectId, data);
      return { success: true, plot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('plots:fork', async (_, plotId: string, modifications: any) => {
    try {
      const plot = await manager.forkPlot(plotId, modifications);
      return { success: true, plot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('plots:get', async (_, plotId: string) => {
    try {
      const plot = await manager.getPlot(plotId);
      return { success: true, plot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('plots:history', async (_, projectId: string) => {
    try {
      const plots = await manager.getPlotHistory(projectId);
      return { success: true, plots };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('plots:updateStatus', async (_, plotId: string, status: string) => {
    try {
      await manager.updatePlotStatus(plotId, status as any);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
