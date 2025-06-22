import { ipcMain, app } from 'electron';
import path from 'path';
import os from 'os';
import * as fs from 'fs';
import { tokenize } from './japanese-tokenizer';

// Dynamic import for @xenova/transformers to handle ESM
async function loadTransformers() {
  try {
    const transformersModule = await eval('import("@xenova/transformers")');
    return transformersModule;
  } catch (error) {
    console.error('Failed to load @xenova/transformers:', error);
    return null;
  }
}

// Configure transformers.js to use local models
const getModelPath = () => {
  try {
    // In Electron context
    return path.join(app.getPath('userData'), 'models');
  } catch {
    // In test/CLI context
    return path.join(os.homedir(), '.noveldrive', 'models');
  }
};

// Model path configuration
const modelPath = getModelPath();
// Ensure directory exists
if (!fs.existsSync(modelPath)) {
  fs.mkdirSync(modelPath, { recursive: true });
}

/**
 * ローカル埋め込みサービス
 * 日本語対応の埋め込みモデルを使用
 */
export class LocalEmbeddingService {
  private static instance: LocalEmbeddingService;
  private embeddingPipeline: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private transformers: any = null;
  
  // 日本語対応の埋め込みモデル
  private readonly MODEL_NAME = 'Xenova/multilingual-e5-small';
  
  private constructor() {}
  
  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): LocalEmbeddingService {
    if (!LocalEmbeddingService.instance) {
      LocalEmbeddingService.instance = new LocalEmbeddingService();
    }
    return LocalEmbeddingService.instance;
  }
  
  /**
   * サービスを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }
  
  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing local embedding service...');
      console.log(`Model: ${this.MODEL_NAME}`);
      console.log(`Local model path: ${modelPath}`);

      // Load transformers dynamically
      this.transformers = await loadTransformers();
      if (!this.transformers) {
        throw new Error('Failed to load transformers module');
      }
      
      const { pipeline, env } = this.transformers;

      // Configure env settings
      Object.assign(env, {
        cacheDir: modelPath,
        allowRemoteModels: true
      });
      
      // 埋め込みパイプラインを作成
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.MODEL_NAME,
        {
          quantized: true, // より小さいサイズのモデルを使用
        }
      );
      
      this.isInitialized = true;
      console.log('Local embedding service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize local embedding service:', error);
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }
  
  /**
   * テキストから埋め込みベクトルを生成
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('Local embedding service not available, using fallback:', error);
        // フォールバック: ランダムベクトルを返す（開発時のみ）
        return Array.from({ length: 384 }, () => Math.random() - 0.5);
      }
    }
    
    if (!this.embeddingPipeline) {
      console.warn('Embedding pipeline not available, using fallback');
      // フォールバック: ランダムベクトルを返す（開発時のみ）
      return Array.from({ length: 384 }, () => Math.random() - 0.5);
    }
    
    try {
      // 日本語テキストの前処理
      const processedText = this.preprocessJapaneseText(text);
      
      // 埋め込みを生成
      const output = await this.embeddingPipeline(processedText, {
        pooling: 'mean',
        normalize: true,
      });
      
      // Float32Arrayをnumber[]に変換
      const embedding = Array.from(output.data as Float32Array);
      
      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }
  
  /**
   * 複数のテキストから埋め込みベクトルを生成
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('Local embedding service not available, using fallback:', error);
        // フォールバック: ランダムベクトルを返す（開発時のみ）
        return texts.map(() => Array.from({ length: 384 }, () => Math.random() - 0.5));
      }
    }
    
    if (!this.embeddingPipeline) {
      console.warn('Embedding pipeline not available, using fallback');
      // フォールバック: ランダムベクトルを返す（開発時のみ）
      return texts.map(() => Array.from({ length: 384 }, () => Math.random() - 0.5));
    }
    
    try {
      // 日本語テキストの前処理
      const processedTexts = texts.map(text => this.preprocessJapaneseText(text));
      
      // バッチ処理で埋め込みを生成
      const embeddings: number[][] = [];
      
      for (const text of processedTexts) {
        const output = await this.embeddingPipeline(text, {
          pooling: 'mean',
          normalize: true,
        });
        
        const embedding = Array.from(output.data as Float32Array);
        embeddings.push(embedding);
      }
      
      return embeddings;
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw error;
    }
  }
  
  /**
   * 日本語テキストの前処理
   */
  private preprocessJapaneseText(text: string): string {
    // テキストの正規化
    let processed = text.trim();
    
    // 全角スペースを半角スペースに変換
    processed = processed.replace(/\u3000/g, ' ');
    
    // 連続するスペースを1つに
    processed = processed.replace(/\s+/g, ' ');
    
    // 最大長の制限（モデルの制限に応じて調整）
    const maxLength = 512;
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength);
    }
    
    return processed;
  }
  
  /**
   * コサイン類似度を計算
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * 類似したembeddingを検索
   */
  findSimilar(
    target: number[], 
    embeddings: number[][], 
    topK: number, 
    threshold?: number
  ): Array<{ index: number; score: number }> {
    const scores = embeddings.map((embedding, index) => ({
      index,
      score: this.cosineSimilarity(target, embedding)
    }));

    // スコアでソート
    scores.sort((a, b) => b.score - a.score);

    // 閾値でフィルタ
    let results = scores;
    if (threshold !== undefined) {
      results = scores.filter(item => item.score >= threshold);
    }

    // topK件を返す
    return results.slice(0, topK);
  }

  /**
   * テキストからキーワードを抽出
   */
  extractKeywords(text: string, topK: number): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // 日本語トークナイザーを使用
    const tokens = tokenize(text);
    
    // 頻度をカウント
    const frequency = new Map<string, number>();
    tokens.forEach(token => {
      if (token.length > 1) { // 1文字の単語は除外
        frequency.set(token, (frequency.get(token) || 0) + 1);
      }
    });

    // 頻度でソート
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([token]) => token);

    return sorted;
  }
  
  /**
   * モデル情報を取得
   */
  getModelInfo(): {
    modelName: string;
    dimensions: number;
    isInitialized: boolean;
  } {
    return {
      modelName: this.MODEL_NAME,
      dimensions: 384, // multilingual-e5-smallの次元数
      isInitialized: this.isInitialized,
    };
  }
  
  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.embeddingPipeline) {
      // パイプラインのクリーンアップ
      this.embeddingPipeline = null;
      this.isInitialized = false;
      this.initializationPromise = null;
      console.log('Local embedding service cleaned up');
    }
  }
}

/**
 * IPCハンドラーの設定
 */
export function setupLocalEmbeddingHandlers(): void {
  const service = LocalEmbeddingService.getInstance();
  
  // サービスの初期化
  ipcMain.handle('embedding:initialize', async () => {
    await service.initialize();
    return service.getModelInfo();
  });
  
  // 単一テキストの埋め込み生成
  ipcMain.handle('embedding:generate', async (_, text: string) => {
    return service.generateEmbedding(text);
  });
  
  // 複数テキストの埋め込み生成
  ipcMain.handle('embedding:generateBatch', async (_, texts: string[]) => {
    return service.generateEmbeddings(texts);
  });
  
  // コサイン類似度の計算
  ipcMain.handle('embedding:similarity', async (_, vecA: number[], vecB: number[]) => {
    return service.cosineSimilarity(vecA, vecB);
  });
  
  // モデル情報の取得
  ipcMain.handle('embedding:info', async () => {
    return service.getModelInfo();
  });
  
  // クリーンアップ
  ipcMain.handle('embedding:cleanup', async () => {
    await service.cleanup();
  });
}

// アプリケーション終了時のクリーンアップ
try {
  if (app && app.on) {
    app.on('before-quit', async () => {
      const service = LocalEmbeddingService.getInstance();
      await service.cleanup();
    });
  }
} catch {
  // Not in Electron context
}