import { pipeline, env } from '@xenova/transformers'
import { getLogger } from '../utils/logger'

const logger = getLogger('local-embedding-service')

// Configure Xenova transformers
env.allowLocalModels = true
// env.localURL = 'models/' // This property might not exist in all versions

export class LocalEmbeddingService {
  private static instance: LocalEmbeddingService
  private extractor: any = null
  private modelName = 'Xenova/multilingual-e5-base'
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): LocalEmbeddingService {
    if (!LocalEmbeddingService.instance) {
      LocalEmbeddingService.instance = new LocalEmbeddingService()
    }
    return LocalEmbeddingService.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.performInitialization()
    return this.initializationPromise
  }

  private async performInitialization(): Promise<void> {
    try {
      logger.info('Initializing local embedding model...')
      this.extractor = await pipeline('feature-extraction', this.modelName)
      this.isInitialized = true
      logger.info('Local embedding model initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize embedding model:', error)
      throw error
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true
      })
      
      // Convert to regular array
      return Array.from(output.data)
    } catch (error) {
      logger.error('Failed to generate embedding:', error)
      throw error
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const embeddings: number[][] = []
      
      // Process in batches for efficiency
      const batchSize = 32
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        )
        embeddings.push(...batchEmbeddings)
      }
      
      return embeddings
    } catch (error) {
      logger.error('Failed to generate embeddings:', error)
      throw error
    }
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (normA * normB)
  }

  async calculateTextSimilarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await this.generateEmbeddings([text1, text2])
    return this.cosineSimilarity(embedding1, embedding2)
  }

  getEmbeddingDimension(): number {
    return 768 // multilingual-e5-base uses 768 dimensions
  }
}

// Export singleton instance
export const localEmbeddingService = LocalEmbeddingService.getInstance()