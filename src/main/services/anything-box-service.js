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
   * Fetch content from URL
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async fetchURLContent(url) {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    try {
      this.logger.info(`Fetching content from URL: ${url}`);
      
      // Parse URL
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.9'
          }
        };
        
        const req = protocol.request(options, (res) => {
          let data = '';
          
          // Handle redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, url);
            this.fetchURLContent(redirectUrl.toString()).then(resolve).catch(reject);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          res.setEncoding('utf8');
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
          req.abort();
          reject(new Error('Request timeout'));
        });
        
        req.end();
      });
      
      // Parse HTML and extract content
      const content = this.extractContentFromHTML(response);
      
      return content;
    } catch (error) {
      this.logger.error('Failed to fetch URL content:', error);
      throw error;
    }
  }
  
  /**
   * Extract meaningful content from HTML
   * @param {string} html
   * @returns {Object}
   */
  extractContentFromHTML(html) {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Extract title
    const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? this.decodeHTMLEntities(titleMatch[1].trim()) : 'Untitled';
    
    // Extract meta description
    const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? this.decodeHTMLEntities(descMatch[1]) : '';
    
    // Extract main content
    // Try to find article or main content areas
    let mainContent = '';
    
    // Try common content containers
    const contentPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/gi
    ];
    
    for (const pattern of contentPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        mainContent = matches.join('\n');
        break;
      }
    }
    
    // If no specific content area found, use body
    if (!mainContent) {
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      mainContent = bodyMatch ? bodyMatch[1] : text;
    }
    
    // Clean up HTML tags and extract text
    const textContent = mainContent
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Decode HTML entities
    const decodedContent = this.decodeHTMLEntities(textContent);
    
    // Extract first 1000 characters as summary if content is too long
    const summary = decodedContent.length > 1000 
      ? decodedContent.substring(0, 1000) + '...' 
      : decodedContent;
    
    return {
      title,
      description: description || summary.substring(0, 200),
      content: decodedContent,
      summary
    };
  }
  
  /**
   * Decode HTML entities
   * @param {string} text
   * @returns {string}
   */
  decodeHTMLEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™'
    };
    
    return text.replace(/&[^;]+;/g, entity => entities[entity] || entity);
  }
  
  /**
   * Fetch URL content with AI assistance
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async fetchURLContentWithAI(url) {
    try {
      const openAIService = require('./openai-service');
      
      // まずOpenAIサービスが設定されているか確認
      if (!openAIService.isConfigured()) {
        this.logger.warn('OpenAI service not configured, falling back to regular fetch');
        return this.fetchURLContent(url);
      }
      
      // AIにコンテンツ取得を依頼
      const prompt = `次のURLのコンテンツを取得して、主要な情報を抽出してください。

URL: ${url}

抽出する情報:
1. タイトル
2. 説明文または要約
3. 主要なコンテンツ

注意: 実際のWebページへのアクセスはできません。URLから推測できる情報や、一般的な知識に基づいて回答してください。`;
      
      const aiResponse = await openAIService.generateText(prompt, {
        temperature: 0.3,
        max_tokens: 1000
      });
      
      // AIのレスポンスから情報を抽出
      const lines = aiResponse.split('\n');
      let title = url;
      let description = '';
      let content = aiResponse;
      
      // タイトルを探す
      const titleLine = lines.find(line => line.includes('タイトル') || line.includes('Title'));
      if (titleLine) {
        title = titleLine.replace(/.*[::：]　?/, '').trim() || url;
      }
      
      // 説明を探す
      const descLine = lines.find(line => line.includes('説明') || line.includes('要約'));
      if (descLine) {
        description = descLine.replace(/.*[::：]　?/, '').trim();
      }
      
      return {
        title,
        description,
        content,
        summary: description || content.substring(0, 200)
      };
    } catch (error) {
      this.logger.error('Failed to fetch URL content with AI:', error);
      // フォールバック
      return this.fetchURLContent(url);
    }
  }
  
  /**
   * Generate AI summary of content
   * @param {string} content
   * @returns {Promise<string>}
   */
  async generateAISummary(content) {
    try {
      const openAIService = require('./openai-service');
      
      if (!openAIService.isConfigured()) {
        this.logger.warn('OpenAI service not configured, cannot generate summary');
        return content.substring(0, 500) + '...';
      }
      
      const prompt = `以下のテキストを簡潔に要約してください。小説創作に役立つ要素を中心にまとめてください。

テキスト:
${content.substring(0, 3000)}

要約:`;
      
      const summary = await openAIService.generateText(prompt, {
        temperature: 0.3,
        max_tokens: 500
      });
      
      return summary;
    } catch (error) {
      this.logger.error('Failed to generate AI summary:', error);
      // フォールバック
      return content.substring(0, 500) + '...';
    }
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

  /**
   * Abstract an idea to its core concepts
   * @param {string} content
   * @param {string} type
   * @param {number} projectId
   * @returns {Promise<Object>}
   */
  async abstractIdea(content, type, projectId) {
    this.logger.info('Abstracting idea...');
    
    try {
      // Generate abstractions at different levels
      const abstractions = await this.generateAbstractions(content);
      
      return {
        success: true,
        data: {
          abstractions,
          originalContent: content
        }
      };
    } catch (error) {
      this.logger.error('Failed to abstract idea:', error);
      throw error;
    }
  }

  /**
   * Concretize abstractions into new specific ideas
   * @param {Array} abstractions
   * @param {string} originalContent
   * @param {number} projectId
   * @returns {Promise<Object>}
   */
  async concretizeIdea(abstractions, originalContent, projectId) {
    this.logger.info('Concretizing abstractions...');
    
    try {
      // abstractionsが配列であることを確認
      if (!Array.isArray(abstractions) || abstractions.length === 0) {
        this.logger.debug('Abstractions array is empty or invalid, generating default abstractions');
        // フォールバックとしてデフォルトの抽象を生成
        abstractions = await this.generateAbstractions(originalContent || '内容');
      }
      
      // Generate concrete variations
      const ideas = await this.generateConcreteVariations(abstractions, originalContent);
      
      // 使用した抽象を安全に取得
      const abstractionUsed = abstractions.length > 1 ? abstractions[1] : abstractions[0] || {
        axis: 'テーマ',
        level: '中',
        content: '人間関係の変化と成長'
      };
      
      return {
        success: true,
        data: {
          ideas,
          abstractionUsed
        }
      };
    } catch (error) {
      this.logger.error('Failed to concretize idea:', error);
      throw error;
    }
  }

  /**
   * Generate abstractions at different levels
   * @param {string} content
   * @returns {Promise<Array>}
   */
  async generateAbstractions(content) {
    // 複数の軸で抽象化を行う
    const abstractionAxes = [
      // 構造的抽象化（ストーリーの構造パターン）
      {
        axis: '構造',
        level: '低',
        content: this.extractStructuralAbstraction(content, 'low')
      },
      {
        axis: '構造',
        level: '中',
        content: this.extractStructuralAbstraction(content, 'medium')
      },
      {
        axis: '構造',
        level: '高',
        content: this.extractStructuralAbstraction(content, 'high')
      },
      // 感情的抽象化（感情の流れ）
      {
        axis: '感情',
        level: '低',
        content: this.extractEmotionalAbstraction(content, 'low')
      },
      {
        axis: '感情',
        level: '中',
        content: this.extractEmotionalAbstraction(content, 'medium')
      },
      {
        axis: '感情',
        level: '高',
        content: this.extractEmotionalAbstraction(content, 'high')
      },
      // 関係性の抽象化（人物間の関係）
      {
        axis: '関係性',
        level: '低',
        content: this.extractRelationalAbstraction(content, 'low')
      },
      {
        axis: '関係性',
        level: '中',
        content: this.extractRelationalAbstraction(content, 'medium')
      },
      {
        axis: '関係性',
        level: '高',
        content: this.extractRelationalAbstraction(content, 'high')
      },
      // 時間的抽象化（時間の流れ）
      {
        axis: '時間',
        level: '低',
        content: this.extractTemporalAbstraction(content, 'low')
      },
      {
        axis: '時間',
        level: '中',
        content: this.extractTemporalAbstraction(content, 'medium')
      },
      {
        axis: '時間',
        level: '高',
        content: this.extractTemporalAbstraction(content, 'high')
      },
      // 空間的抽象化（場所・環境）
      {
        axis: '空間',
        level: '低',
        content: this.extractSpatialAbstraction(content, 'low')
      },
      {
        axis: '空間',
        level: '中',
        content: this.extractSpatialAbstraction(content, 'medium')
      },
      {
        axis: '空間',
        level: '高',
        content: this.extractSpatialAbstraction(content, 'high')
      },
      // テーマ的抽象化（メッセージ・意味）
      {
        axis: 'テーマ',
        level: '低',
        content: this.extractThematicAbstraction(content, 'low')
      },
      {
        axis: 'テーマ',
        level: '中',
        content: this.extractThematicAbstraction(content, 'medium')
      },
      {
        axis: 'テーマ',
        level: '高',
        content: this.extractThematicAbstraction(content, 'high')
      }
    ];
    
    return abstractionAxes;
  }

  /**
   * 構造的抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractStructuralAbstraction(content, level) {
    const patterns = {
      low: ['起承転結の流れ', '問題解決型の構造', '成長物語の枠組み', '対立と和解の構造'],
      medium: ['変化と成長のパターン', '対立構造の本質', '循環的な物語構造'],
      high: ['始まりと終わりの普遍的構造', '変化の基本パターン']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * 感情的抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractEmotionalAbstraction(content, level) {
    const patterns = {
      low: ['喜びから悲しみへの感情の流れ', '期待と失望の繰り返し', '愛情の深まりと試練'],
      medium: ['感情の振幅と成長', '内面的葛藤の展開', '共感と理解の深化'],
      high: ['人間の根源的感情', '感情の普遍的サイクル']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * 関係性の抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractRelationalAbstraction(content, level) {
    const patterns = {
      low: ['師弟関係の形成', '友情の発展過程', '家族の絆と対立', '恋愛関係の変化'],
      medium: ['支配と従属の関係', '協力と競争の二面性', '信頼関係の構築'],
      high: ['人間関係の本質', '個と集団の相互作用']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * 時間的抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractTemporalAbstraction(content, level) {
    const patterns = {
      low: ['日常から非日常への移行', '季節の変化と心の変化', '過去と現在の対比'],
      medium: ['時間の経過による変化', '瞬間と永遠の対比', '循環する時間'],
      high: ['時間の相対性', '永遠の一瞬']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * 空間的抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractSpatialAbstraction(content, level) {
    const patterns = {
      low: ['閉じた空間から開かれた空間へ', '安全な場所と危険な場所', '内と外の対比'],
      medium: ['空間の象徴的意味', '境界線の存在', '聖域と俗界'],
      high: ['空間の本質', '存在の場所性']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * テーマ的抽象化
   * @param {string} content
   * @param {string} level
   * @returns {string}
   */
  extractThematicAbstraction(content, level) {
    const patterns = {
      low: ['正義と悪の対立', '成長と挫折', '愛と犠牲', '夢と現実'],
      medium: ['善悪の相対性', '成長の本質', '愛の多面性'],
      high: ['存在の意味', '生と死の本質', '真理の探求']
    };
    return patterns[level][Math.floor(Math.random() * patterns[level].length)];
  }

  /**
   * Generate concrete variations from abstractions
   * @param {Array} abstractions
   * @param {string} originalContent
   * @returns {Promise<Array>}
   */
  async generateConcreteVariations(abstractions, originalContent) {
    // 各軸からランダムに選んで具象化
    const selectedAbstractions = this.selectAbstractionsForConcretization(abstractions);
    
    // ジャンルと設定のバリエーション
    const variations = [
      // ジャンル変換
      { type: 'SF', label: 'SF版', template: 'テクノロジーと人間性' },
      { type: 'fantasy', label: 'ファンタジー版', template: '魔法と現実の交差' },
      { type: 'mystery', label: 'ミステリー版', template: '謎と真実の追求' },
      { type: 'romance', label: '恋愛版', template: '愛情と人間関係' },
      { type: 'horror', label: 'ホラー版', template: '恐怖と人間の内面' },
      // 時代設定変換
      { type: 'modern', label: '現代版', template: '現代社会の問題' },
      { type: 'historical', label: '歴史版', template: '歴史的背景と人間模様' },
      { type: 'future', label: '未来版', template: '未来世界の可能性' },
      // 視点変換
      { type: 'child', label: '子供視点版', template: '純粋な目で見た世界' },
      { type: 'elderly', label: '高齢者視点版', template: '人生経験からの洞察' },
      { type: 'animal', label: '動物視点版', template: '異なる生命の視点' }
    ];
    
    // ランダムに5つ選択
    const selectedVariations = this.shuffleArray(variations).slice(0, 5);
    
    return selectedVariations.map(variation => {
      // selectedAbstractionsが空の場合のチェック
      if (!selectedAbstractions || selectedAbstractions.length === 0) {
        this.logger.error('No abstractions selected for concretization');
        // フォールバックとしてモックの抽象を使用
        const fallbackAbstraction = {
          content: '人間関係の変化と成長',
          axis: '関係性',
          level: '中'
        };
        return {
          title: `${variation.label}：${fallbackAbstraction.content}`,
          content: this.generateEnhancedVariationContent(variation, fallbackAbstraction, originalContent),
          variation: variation.label,
          abstractionAxis: fallbackAbstraction.axis,
          abstractionLevel: fallbackAbstraction.level,
          explanation: `${variation.template}の観点から再構築しました`
        };
      }
      
      const abstraction = selectedAbstractions[Math.floor(Math.random() * selectedAbstractions.length)];
      return {
        title: `${variation.label}：${abstraction.content}`,
        content: this.generateEnhancedVariationContent(variation, abstraction, originalContent),
        variation: variation.label,
        abstractionAxis: abstraction.axis,
        abstractionLevel: abstraction.level,
        explanation: `「${abstraction.axis}」軸の「${abstraction.content}」を${variation.template}の観点から再構築しました`
      };
    });
  }

  /**
   * 具象化のための抽象を選択
   * @param {Array} abstractions
   * @returns {Array}
   */
  selectAbstractionsForConcretization(abstractions) {
    // abstractionsが配列でない場合のチェック
    if (!Array.isArray(abstractions) || abstractions.length === 0) {
      this.logger.debug('No abstractions provided for concretization');
      return [];
    }
    
    // 各軸から中レベルを中心に選択
    const selected = [];
    const axes = [...new Set(abstractions.map(a => a.axis).filter(Boolean))];
    
    if (axes.length === 0) {
      // 軸がない場合はすべての抽象から選択
      return abstractions.slice(0, 5);
    }
    
    axes.forEach(axis => {
      const axisAbstractions = abstractions.filter(a => a.axis === axis);
      if (axisAbstractions.length > 0) {
        // 中レベルを優先、なければランダム
        const medium = axisAbstractions.find(a => a.level === '中');
        if (medium) {
          selected.push(medium);
        } else {
          selected.push(axisAbstractions[Math.floor(Math.random() * axisAbstractions.length)]);
        }
      }
    });
    
    return selected;
  }

  /**
   * 配列をシャッフル
   * @param {Array} array
   * @returns {Array}
   */
  shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * 強化されたバリエーションコンテンツの生成
   * @param {Object} variation
   * @param {Object} abstraction
   * @param {string} originalContent
   * @returns {string}
   */
  generateEnhancedVariationContent(variation, abstraction, originalContent) {
    const templates = {
      // ジャンル変換
      SF: `未来都市を舞台に、${abstraction.content}をテクノロジーの観点から描く。AI、ロボット、サイバー空間などの要素を取り入れ、人間性の本質を問う。`,
      fantasy: `魔法の世界で${abstraction.content}を体現する冒険。ドラゴン、魔法使い、古代の遺跡などのファンタジー要素を通じて、普遍的な真理を探求する。`,
      mystery: `${abstraction.content}の謎を中心に組み立てられたミステリー。探偵、手がかり、伏線、どんでん返しを通じて、人間心理の深層に迫る。`,
      romance: `${abstraction.content}を恋愛関係の中で描く物語。出会い、すれ違い、誤解、和解を通じて、愛情の本質と人間関係の複雑さを探る。`,
      horror: `${abstraction.content}を恐怖の要素で包んだ物語。未知の存在、心理的恐怖、超自然現象を通じて、人間の根源的な恐怖と向き合う。`,
      // 時代設定変換
      modern: `現代社会の中で${abstraction.content}を描く。SNS、グローバル化、環境問題などの現代的テーマを絡めて展開する。`,
      historical: `歴史上のある時代を舞台に${abstraction.content}を再現。時代背景、文化、社会構造を緿密に描きながら、普遍的なテーマを浮き彫りにする。`,
      future: `遠い未来を舞台に${abstraction.content}を描く。人類の進化、宇宙進出、新たな社会システムの中で、不変のテーマを考察する。`,
      // 視点変換
      child: `子供の目を通して${abstraction.content}を見つめる。純粋な視点、素直な疑問、新鮮な驚きを通じて、大人が見落としがちな真実を明らかにする。`,
      elderly: `長い人生経験を持つ者の視点から${abstraction.content}を語る。過去の記憶、蓄積された智恵、人生の最終章からの洞察を描く。`,
      animal: `動物の視点から${abstraction.content}を体験する物語。異なる感覚、本能、生存の論理を通じて、人間中心的な世界観を相対化する。`
    };
    
    return templates[variation.type] || `${variation.label}として${abstraction.content}を表現した物語`;
  }

  /**
   * Create new entry
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createEntry(data) {
    const knowledge = await this.repositories.knowledge.create({
      project_id: data.projectId,
      type: data.type,
      title: data.title,
      content: data.content,
      metadata: JSON.stringify(data.metadata || {}),
      tags: data.tags ? JSON.stringify(data.tags) : null
    });
    
    return { success: true, item: knowledge };
  }
}

module.exports = AnythingBoxService;