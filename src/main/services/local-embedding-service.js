class LocalEmbeddingService {
    constructor() {
        this.model = null;
        this.modelName = 'Xenova/multilingual-e5-base';
        this.isInitialized = false;
        this.initPromise = null;
        this.pipeline = null;
    }

    /**
     * モデルを初期化
     */
    async initialize() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._initialize();
        await this.initPromise;
        this.isInitialized = true;
    }

    async _initialize() {
        try {
            console.log('Initializing local embedding model...');
            // Dynamic import for ESM module
            const transformers = await import('@xenova/transformers');
            this.pipeline = transformers.pipeline;
            this.model = await this.pipeline('feature-extraction', this.modelName);
            console.log('Local embedding model initialized successfully');
        } catch (error) {
            console.error('Failed to initialize embedding model:', error);
            throw error;
        }
    }

    /**
     * テキストから埋め込みベクトルを生成
     * @param {string} text - 埋め込みを生成するテキスト
     * @returns {Promise<number[]>} 埋め込みベクトル
     */
    async generateEmbedding(text) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input for embedding generation');
        }

        try {
            // テキストの前処理
            const cleanedText = this.preprocessText(text);
            
            // 埋め込み生成
            const output = await this.model(cleanedText, {
                pooling: 'mean',
                normalize: true
            });

            // Float32Arrayから通常の配列に変換
            const embedding = Array.from(output.data);
            
            return embedding;
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw error;
        }
    }

    /**
     * 複数のテキストから埋め込みベクトルを生成（バッチ処理）
     * @param {string[]} texts - 埋め込みを生成するテキストの配列
     * @returns {Promise<number[][]>} 埋め込みベクトルの配列
     */
    async generateEmbeddings(texts) {
        if (!Array.isArray(texts)) {
            throw new Error('Input must be an array of texts');
        }

        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const embeddings = [];
            
            // バッチ処理（メモリ効率のため一度に処理する数を制限）
            const batchSize = 10;
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                const batchEmbeddings = await Promise.all(
                    batch.map(text => this.generateEmbedding(text))
                );
                embeddings.push(...batchEmbeddings);
            }

            return embeddings;
        } catch (error) {
            console.error('Failed to generate embeddings:', error);
            throw error;
        }
    }

    /**
     * テキストの前処理
     * @param {string} text - 前処理するテキスト
     * @returns {string} 前処理されたテキスト
     */
    preprocessText(text) {
        // 改行をスペースに置換
        let processed = text.replace(/\n+/g, ' ');
        
        // 余分な空白を削除
        processed = processed.replace(/\s+/g, ' ').trim();
        
        // 最大長の制限（モデルの制限に応じて調整）
        const maxLength = 512;
        if (processed.length > maxLength) {
            processed = processed.substring(0, maxLength);
        }

        return processed;
    }

    /**
     * 2つのベクトル間のコサイン類似度を計算
     * @param {number[]} vec1 - ベクトル1
     * @param {number[]} vec2 - ベクトル2
     * @returns {number} コサイン類似度（-1から1の値）
     */
    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have the same dimension');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (norm1 * norm2);
    }

    /**
     * テキストの類似度を計算
     * @param {string} text1 - テキスト1
     * @param {string} text2 - テキスト2
     * @returns {Promise<number>} 類似度スコア（0から1の値）
     */
    async calculateTextSimilarity(text1, text2) {
        const [embedding1, embedding2] = await this.generateEmbeddings([text1, text2]);
        const similarity = this.cosineSimilarity(embedding1, embedding2);
        
        // -1から1の範囲を0から1に正規化
        return (similarity + 1) / 2;
    }

    /**
     * 埋め込みベクトルの次元数を取得
     * @returns {number} ベクトルの次元数
     */
    getEmbeddingDimension() {
        // multilingual-e5-baseモデルの埋め込み次元数
        return 768;
    }

    /**
     * サービスのクリーンアップ
     */
    async cleanup() {
        if (this.model) {
            // モデルのリソースを解放
            this.model = null;
            this.isInitialized = false;
            this.initPromise = null;
        }
    }
}

// シングルトンインスタンスとしてエクスポート
const localEmbeddingService = new LocalEmbeddingService();

module.exports = localEmbeddingService;