/**
 * ドメインサービス定義
 * エンティティに属さないビジネスロジック
 */

import { Plot, PlotStructure, EmotionalTone } from '../entities';

/**
 * 埋め込みサービスインターフェース
 */
export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  findSimilar(target: number[], embeddings: number[][], topK: number, threshold?: number): Array<{ index: number; score: number }>;
  extractKeywords(text: string, topK: number): string[];
}

/**
 * プロットバージョニングサービス
 */
export class PlotVersioningService {
  /**
   * 新しいバージョン番号を生成
   */
  generateVersion(existingVersions: string[], parentVersion?: string): string {
    if (parentVersion) {
      // 派生バージョンの場合
      const siblings = existingVersions.filter(v => 
        v.startsWith(parentVersion) && v.length === parentVersion.length + 1
      );
      const primeCount = siblings.filter(v => 
        v.substring(parentVersion.length).match(/^'+$/)
      ).length;
      return parentVersion + "'".repeat(primeCount + 1);
    } else {
      // 新規バージョンの場合
      const baseVersions = existingVersions
        .filter(v => /^[A-Z]$/.test(v))
        .sort();
      
      if (baseVersions.length === 0) {
        return 'A';
      }
      
      const lastVersion = baseVersions[baseVersions.length - 1];
      return String.fromCharCode(lastVersion.charCodeAt(0) + 1);
    }
  }

  /**
   * バージョンツリーを構築
   */
  buildVersionTree(plots: Plot[]): VersionNode {
    const root: VersionNode = { version: 'root', children: [] };
    const nodeMap = new Map<string, VersionNode>();
    
    // ノードマップを作成
    plots.forEach(plot => {
      nodeMap.set(plot.version, {
        version: plot.version,
        plot,
        children: []
      });
    });
    
    // 親子関係を構築
    plots.forEach(plot => {
      const node = nodeMap.get(plot.version)!;
      if (plot.parentVersion) {
        const parent = nodeMap.get(plot.parentVersion);
        if (parent) {
          parent.children.push(node);
        } else {
          root.children.push(node);
        }
      } else {
        root.children.push(node);
      }
    });
    
    return root;
  }
}

export interface VersionNode {
  version: string;
  plot?: Plot;
  children: VersionNode[];
}

/**
 * プロット分析サービス
 */
export class PlotAnalysisService {
  /**
   * 感情バランスを計算
   */
  calculateEmotionalBalance(structure: PlotStructure): {
    overall: number;
    byChapter: Array<{ chapter: number; balance: number }>;
    variance: number;
  } {
    const byChapter: Array<{ chapter: number; balance: number }> = [];
    let totalBalance = 0;
    let chapterCount = 0;

    structure.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        const balance = this.emotionalToneToValue(chapter.emotionalTone);
        byChapter.push({ chapter: chapter.chapterNumber, balance });
        totalBalance += balance;
        chapterCount++;
      });
    });

    const overall = chapterCount > 0 ? totalBalance / chapterCount : 0;
    const variance = this.calculateVariance(byChapter.map(c => c.balance));

    return { overall, byChapter, variance };
  }

  /**
   * 葛藤レベルを計算
   */
  calculateConflictLevel(structure: PlotStructure): number {
    let conflictScore = 0;

    // メインコンフリクトの存在
    if (structure.mainConflict && structure.mainConflict.length > 20) {
      conflictScore += 3;
    }

    // 各幕でのイベント数
    structure.acts.forEach(act => {
      conflictScore += Math.min(act.keyEvents.length * 0.5, 2);
    });

    return Math.min(conflictScore / 10, 1);
  }

  /**
   * ペーススコアを計算
   */
  calculatePaceScore(structure: PlotStructure): number {
    const chapterLengths: number[] = [];
    let totalScenes = 0;

    structure.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        chapterLengths.push(chapter.estimatedLength);
        totalScenes += chapter.scenes.length;
      });
    });

    if (chapterLengths.length === 0) return 0;

    const avgLength = chapterLengths.reduce((a, b) => a + b, 0) / chapterLengths.length;
    const lengthVariance = this.calculateVariance(chapterLengths);

    // 長さの一貫性
    const consistencyScore = 1 - Math.min(lengthVariance / avgLength, 1);

    // シーン数の適切さ
    const avgScenes = totalScenes / chapterLengths.length;
    const sceneScore = 1 - Math.abs(avgScenes - 4) / 4;

    return (consistencyScore + sceneScore) / 2;
  }

  private emotionalToneToValue(tone: EmotionalTone): number {
    switch (tone) {
      case 'positive': return 1;
      case 'negative': return -1;
      case 'mixed': return 0;
      case 'neutral': return 0;
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }
}

/**
 * セレンディピティサービス
 */
export class SerendipityService {
  /**
   * ベクトルにノイズを注入してセレンディピティを生成
   */
  injectSerendipity(embedding: number[], level: number): number[] {
    if (!embedding || embedding.length === 0) {
      throw new Error('Invalid embedding');
    }

    if (level <= 0) return [...embedding];

    return embedding.map(value => {
      // ガウシアンノイズを追加
      const noise = this.gaussianRandom() * level * 0.1;
      return value + noise;
    });
  }

  /**
   * 複数のベクトルを合成
   */
  blendEmbeddings(embeddings: number[][], weights?: number[]): number[] {
    if (embeddings.length === 0) {
      throw new Error('No embeddings to blend');
    }

    const dimensions = embeddings[0].length;
    const finalWeights = weights || new Array(embeddings.length).fill(1 / embeddings.length);

    if (finalWeights.length !== embeddings.length) {
      throw new Error('Weights count must match embeddings count');
    }

    const result = new Array(dimensions).fill(0);

    embeddings.forEach((embedding, i) => {
      embedding.forEach((value, j) => {
        result[j] += value * finalWeights[i];
      });
    });

    // 正規化
    const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
    return result.map(val => val / magnitude);
  }

  private gaussianRandom(): number {
    // Box-Muller変換
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}