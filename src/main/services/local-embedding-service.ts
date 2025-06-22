import { pipeline, env, Pipeline } from '@xenova/transformers';
import { ipcMain, app } from 'electron';
import path from 'path';
import os from 'os';
import * as fs from 'fs';

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

// Configure env settings using Object.assign to avoid type errors
Object.assign(env, {
  cacheDir: modelPath,
  allowRemoteModels: true
});

/**
 * ローカル埋め込みサービス
 * 日本語対応の埋め込みモデルを使用
 */
export class LocalEmbeddingService {
  private static instance: LocalEmbeddingService;
  private embeddingPipeline: Pipeline | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
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
      
      // 埋め込みパイプラインを作成
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.MODEL_NAME,
        {
          quantized: true, // より小さいサイズのモデルを使用
        }
      ) as Pipeline;
      
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
      await this.initialize();
    }
    
    if (!this.embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
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
      await this.initialize();
    }
    
    if (!this.embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
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
    processed = processed.replace(/　/g, ' ');
    
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