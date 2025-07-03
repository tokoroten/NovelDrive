const { getLogger } = require('../utils/logger');
const localEmbeddingService = require('./local-embedding-service');

/**
 * Anything Box Service
 * Handles processing of various input types for the creative knowledge management
 */
class AnythingBoxService {
  constructor(repositories) {
    this.repositories = repositories;
    this.logger = getLogger();
  }

  /**
   * Process text input
   * @param {number} projectId
   * @param {string} text
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async processText(projectId, text, options = {}) {
    this.logger.info('Processing text input for Anything Box');
    
    try {
      // Extract metadata
      const metadata = {
        source: 'text',
        originalLength: text.length,
        processedAt: new Date().toISOString(),
        ...options.metadata
      };

      // Generate inspirations (mock for now)
      const inspirations = await this.generateInspirations(text);
      metadata.inspirations = inspirations;

      // Create knowledge entry
      const knowledge = await this.repositories.knowledge.create({
        project_id: projectId,
        type: 'text',
        title: options.title || this.generateTitle(text),
        content: text,
        metadata: JSON.stringify(metadata)
      });

      // Generate embeddings (mock for now)
      const embeddings = await this.generateEmbeddings(text);
      if (embeddings) {
        await this.repositories.knowledge.update(knowledge.id, {
          embeddings: JSON.stringify(embeddings)
        });
      }

      this.logger.info(`Created knowledge entry: ${knowledge.id}`);
      return knowledge;
    } catch (error) {
      this.logger.error('Failed to process text:', error);
      throw error;
    }
  }

  /**
   * Process URL input
   * @param {number} projectId
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async processURL(projectId, url, options = {}) {
    this.logger.info(`Processing URL input: ${url}`);
    
    try {
      // Check if URL already exists
      const existing = await this.repositories.knowledge.findBy('content', url);
      const projectExisting = existing.filter(k => k.project_id === projectId);
      
      if (projectExisting.length > 0) {
        this.logger.info('URL already exists in project');
        return projectExisting[0];
      }

      // Fetch content (mock for now)
      const fetchedContent = await this.fetchURLContent(url);
      
      const metadata = {
        source: 'url',
        url: url,
        title: fetchedContent.title,
        description: fetchedContent.description,
        fetchedAt: new Date().toISOString(),
        ...options.metadata
      };

      // Generate inspirations
      const inspirations = await this.generateInspirations(fetchedContent.content);
      metadata.inspirations = inspirations;

      // Create knowledge entry
      const knowledge = await this.repositories.knowledge.create({
        project_id: projectId,
        type: 'url',
        title: fetchedContent.title || url,
        content: fetchedContent.content,
        metadata: JSON.stringify(metadata)
      });

      // Generate embeddings
      const embeddings = await this.generateEmbeddings(fetchedContent.content);
      if (embeddings) {
        await this.repositories.knowledge.update(knowledge.id, {
          embeddings: JSON.stringify(embeddings)
        });
      }

      this.logger.info(`Created knowledge entry from URL: ${knowledge.id}`);
      return knowledge;
    } catch (error) {
      this.logger.error('Failed to process URL:', error);
      throw error;
    }
  }

  /**
   * Process image input
   * @param {number} projectId
   * @param {string} imagePath
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async processImage(projectId, imagePath, options = {}) {
    this.logger.info(`Processing image input: ${imagePath}`);
    
    try {
      // Extract text from image (mock OCR for now)
      const ocrResult = await this.performOCR(imagePath);
      
      const metadata = {
        source: 'image',
        imagePath: imagePath,
        ocrText: ocrResult.text,
        processedAt: new Date().toISOString(),
        ...options.metadata
      };

      // Generate inspirations from OCR text or image description
      const contentForInspiration = ocrResult.text || options.description || '';
      const inspirations = await this.generateInspirations(contentForInspiration);
      metadata.inspirations = inspirations;

      // Create knowledge entry
      const knowledge = await this.repositories.knowledge.create({
        project_id: projectId,
        type: 'image',
        title: options.title || `Image: ${new Date().toLocaleDateString('ja-JP')}`,
        content: ocrResult.text || options.description || '',
        metadata: JSON.stringify(metadata)
      });

      this.logger.info(`Created knowledge entry from image: ${knowledge.id}`);
      return knowledge;
    } catch (error) {
      this.logger.error('Failed to process image:', error);
      throw error;
    }
  }

  /**
   * Generate title from text
   * @param {string} text
   * @returns {string}
   */
  generateTitle(text) {
    const maxLength = 50;
    const firstLine = text.split('\n')[0];
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength) + '...';
  }

  /**
   * Generate inspirations from content (mock implementation)
   * @param {string} content
   * @returns {Promise<Array>}
   */
  async generateInspirations(content) {
    // Mock implementation - will be replaced with AI service
    const inspirations = [
      {
        type: 'character',
        content: 'このテキストから着想を得た神秘的なキャラクター',
        confidence: 0.8
      },
      {
        type: 'scene',
        content: '静寂な夜に起こる不思議な出来事のシーン',
        confidence: 0.7
      },
      {
        type: 'theme',
        content: '記憶と忘却の間で揺れ動く人間の心理',
        confidence: 0.9
      },
      {
        type: 'plot',
        content: '失われた記憶を取り戻す旅の物語',
        confidence: 0.6
      },
      {
        type: 'worldbuilding',
        content: '記憶が物理的な形を持つ世界の設定',
        confidence: 0.75
      }
    ];

    return inspirations;
  }

  /**
   * Generate embeddings for content using local embedding service
   * @param {string} content
   * @returns {Promise<Array<number>>}
   */
  async generateEmbeddings(content) {
    try {
      // LocalEmbeddingServiceを使用して実際の埋め込みを生成
      const embeddings = await localEmbeddingService.generateEmbedding(content);
      this.logger.info(`Generated ${embeddings.length}-dimensional embeddings`);
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate embeddings:', error);
      // フォールバック: モックの埋め込みを返す
      const dimensions = 768; // multilingual-e5-baseの次元数
      const embeddings = Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
      const magnitude = Math.sqrt(embeddings.reduce((sum, val) => sum + val * val, 0));
      return embeddings.map(val => val / magnitude);
    }
  }

  /**
   * Fetch content from URL (mock implementation)
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async fetchURLContent(url) {
    // Mock implementation - will be replaced with actual web fetching
    return {
      title: `Content from ${new URL(url).hostname}`,
      description: 'This is a mock description of the fetched content.',
      content: `Mock content fetched from ${url}. In production, this would be the actual content extracted from the webpage.`
    };
  }

  /**
   * Perform OCR on image (mock implementation)
   * @param {string} imagePath
   * @returns {Promise<Object>}
   */
  async performOCR(imagePath) {
    // Mock implementation - will be replaced with actual OCR service
    return {
      text: 'Mock OCR result: This is sample text extracted from the image.',
      confidence: 0.95
    };
  }

  /**
   * Get recent entries
   * @param {number} projectId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getRecentEntries(projectId, limit = 10) {
    return this.repositories.knowledge.findByProject(projectId, {
      limit,
      offset: 0
    });
  }

  /**
   * Search entries
   * @param {number} projectId
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchEntries(projectId, query) {
    return this.repositories.knowledge.searchByContent(projectId, query);
  }
}

module.exports = AnythingBoxService;