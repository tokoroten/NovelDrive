const { getLogger } = require('../utils/logger');
const localEmbeddingService = require('./local-embedding-service');
const VectorSearchService = require('./vector-search-service');

/**
 * Serendipity Search Service
 * Implements the creative search algorithm with noise injection and time decay
 */
class SerendipitySearchService {
    constructor(repositories) {
        this.repositories = repositories;
        this.logger = getLogger();
        this.vectorSearchService = new VectorSearchService(repositories);
        
        // セレンディピティ検索のパラメータ
        this.config = {
            noiseLevel: 0.2,        // ノイズの強度（0-1）
            timeDecayFactor: 0.95,  // 時間減衰係数
            middleDistanceRange: {  // 中距離の範囲
                min: 0.3,
                max: 0.7
            },
            searchLimit: 50,        // 検索結果の上限
            diversityWeight: 0.3    // 多様性の重み
        };
    }

    /**
     * Initialize the serendipity search service
     */
    async initialize() {
        await this.vectorSearchService.initialize();
    }

    /**
     * セレンディピティ検索を実行
     * @param {number} projectId - プロジェクトID
     * @param {string} query - 検索クエリ
     * @param {Object} options - 検索オプション
     * @returns {Promise<Array>} 検索結果
     */
    async search(projectId, query, options = {}) {
        this.logger.info(`Performing serendipity search for: ${query}`);

        try {
            // クエリの埋め込みを生成
            const queryEmbedding = options.queryEmbedding || 
                await localEmbeddingService.generateEmbedding(query);
            
            // Use vector search service with serendipity mode
            const searchResults = await this.vectorSearchService.search(
                queryEmbedding,
                projectId,
                {
                    mode: 'serendipity',
                    limit: options.limit || this.config.searchLimit,
                    entityTypes: ['knowledge'],
                    perturbationType: options.perturbationType || 'gaussian'
                }
            );

            // Enrich results with full entity data and apply time decay
            const enrichedResults = await this.enrichResults(searchResults, options);

            // 中距離フィルタリング
            const filteredItems = this.filterMiddleDistance(
                enrichedResults,
                options.middleDistanceRange || this.config.middleDistanceRange
            );

            // 多様性を考慮したランキング
            const rankedItems = this.rankWithDiversity(
                filteredItems,
                options.diversityWeight || this.config.diversityWeight
            );

            return rankedItems;

        } catch (error) {
            this.logger.error('Serendipity search failed:', error);
            throw error;
        }
    }

    /**
     * Enrich search results with full entity data
     * @param {Array} searchResults - Results from vector search
     * @param {Object} options - Options
     * @returns {Promise<Array>} Enriched results
     */
    async enrichResults(searchResults, options = {}) {
        const enriched = [];
        
        for (const result of searchResults) {
            try {
                let entity = null;
                
                if (result.entityType === 'knowledge') {
                    entity = await this.repositories.knowledge.findById(result.entityId);
                }
                // Add more entity types as needed
                
                if (entity) {
                    // Calculate time decay
                    const timeDecay = this.calculateTimeDecay(
                        entity.created_at,
                        options.timeDecayFactor || this.config.timeDecayFactor
                    );
                    
                    enriched.push({
                        ...entity,
                        similarity: result.similarity,
                        distance: result.distance,
                        timeDecay,
                        score: result.similarity * timeDecay
                    });
                }
            } catch (error) {
                this.logger.warn(`Failed to enrich result ${result.entityId}:`, error);
            }
        }
        
        return enriched.sort((a, b) => b.score - a.score);
    }

    /**
     * 埋め込みベクトルにノイズを注入
     * @param {number[]} embedding - 元の埋め込みベクトル
     * @param {number} noiseLevel - ノイズレベル（0-1）
     * @returns {number[]} ノイズが注入されたベクトル
     */
    injectNoise(embedding, noiseLevel) {
        const noisyEmbedding = embedding.map(value => {
            // ガウシアンノイズを生成
            const noise = this.generateGaussianNoise() * noiseLevel;
            return value + noise;
        });

        // 正規化
        return this.normalizeVector(noisyEmbedding);
    }

    /**
     * ガウシアンノイズを生成（Box-Muller変換）
     * @returns {number} ガウシアンノイズ
     */
    generateGaussianNoise() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // 0を避ける
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    /**
     * ベクトルを正規化
     * @param {number[]} vector - ベクトル
     * @returns {number[]} 正規化されたベクトル
     */
    normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude === 0) return vector;
        return vector.map(val => val / magnitude);
    }

    /**
     * アイテムをスコアリング
     * @param {number[]} queryEmbedding - クエリの埋め込み
     * @param {Array} items - ナレッジアイテム
     * @param {Object} options - オプション
     * @returns {Promise<Array>} スコア付きアイテム
     */
    async scoreItems(queryEmbedding, items, options = {}) {
        const scoredItems = [];

        for (const item of items) {
            if (!item.embeddings) continue;

            try {
                const itemEmbedding = JSON.parse(item.embeddings);
                
                // コサイン類似度を計算
                const similarity = localEmbeddingService.cosineSimilarity(
                    queryEmbedding,
                    itemEmbedding
                );

                // 時間減衰を適用
                const timeDecay = this.calculateTimeDecay(
                    item.created_at,
                    options.timeDecayFactor || this.config.timeDecayFactor
                );

                // 最終スコア
                const score = similarity * timeDecay;

                scoredItems.push({
                    ...item,
                    similarity,
                    timeDecay,
                    score,
                    distance: 1 - similarity // 距離（類似度の逆）
                });
            } catch (error) {
                this.logger.warn(`Failed to process item ${item.id}:`, error);
            }
        }

        // スコアでソート
        return scoredItems.sort((a, b) => b.score - a.score);
    }

    /**
     * 時間減衰を計算
     * @param {string} createdAt - 作成日時
     * @param {number} decayFactor - 減衰係数
     * @returns {number} 時間減衰値
     */
    calculateTimeDecay(createdAt, decayFactor) {
        const now = new Date();
        const created = new Date(createdAt);
        const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
        
        // 指数関数的減衰
        return Math.pow(decayFactor, daysDiff);
    }

    /**
     * 中距離フィルタリング
     * @param {Array} items - スコア付きアイテム
     * @param {Object} range - 中距離の範囲
     * @returns {Array} フィルタリングされたアイテム
     */
    filterMiddleDistance(items, range) {
        return items.filter(item => 
            item.distance >= range.min && item.distance <= range.max
        );
    }

    /**
     * 多様性を考慮したランキング
     * @param {Array} items - アイテムリスト
     * @param {number} diversityWeight - 多様性の重み
     * @returns {Array} ランキングされたアイテム
     */
    rankWithDiversity(items, diversityWeight) {
        if (items.length === 0) return items;

        const ranked = [];
        const remaining = [...items];
        
        // 最初のアイテムは最高スコアのものを選択
        ranked.push(remaining.shift());

        // 残りのアイテムを多様性を考慮して選択
        while (remaining.length > 0) {
            let bestItem = null;
            let bestScore = -Infinity;
            let bestIndex = -1;

            for (let i = 0; i < remaining.length; i++) {
                const item = remaining[i];
                
                // 既存のアイテムとの最小距離を計算
                let minDistance = Infinity;
                for (const rankedItem of ranked) {
                    const distance = this.calculateContentDistance(item, rankedItem);
                    minDistance = Math.min(minDistance, distance);
                }

                // 多様性を考慮したスコア
                const diversityScore = item.score * (1 - diversityWeight) + 
                                     minDistance * diversityWeight;

                if (diversityScore > bestScore) {
                    bestScore = diversityScore;
                    bestItem = item;
                    bestIndex = i;
                }
            }

            if (bestItem) {
                ranked.push(bestItem);
                remaining.splice(bestIndex, 1);
            } else {
                break;
            }
        }

        return ranked;
    }

    /**
     * コンテンツ間の距離を計算
     * @param {Object} item1 - アイテム1
     * @param {Object} item2 - アイテム2
     * @returns {number} 距離
     */
    calculateContentDistance(item1, item2) {
        // 埋め込みベクトル間の距離を使用
        if (item1.embeddings && item2.embeddings) {
            try {
                const emb1 = JSON.parse(item1.embeddings);
                const emb2 = JSON.parse(item2.embeddings);
                const similarity = localEmbeddingService.cosineSimilarity(emb1, emb2);
                return 1 - similarity;
            } catch (error) {
                this.logger.warn('Failed to calculate embedding distance:', error);
            }
        }

        // フォールバック: タイプの違いを距離として使用
        return item1.type === item2.type ? 0.5 : 1.0;
    }

    /**
     * 関連アイテムを検索（通常の類似検索）
     * @param {number} itemId - 基準となるアイテムID
     * @param {Object} options - 検索オプション
     * @returns {Promise<Array>} 関連アイテム
     */
    async findRelated(itemId, options = {}) {
        try {
            const item = await this.repositories.knowledge.findById(itemId);
            if (!item) {
                return [];
            }

            // Get vector from vector index
            const vectorResults = await this.vectorSearchService.search(
                JSON.parse(item.embeddings || '[]'),
                item.project_id,
                {
                    mode: 'similar',
                    limit: options.limit || 20,
                    entityTypes: ['knowledge'],
                    excludeIds: [itemId] // Exclude the item itself
                }
            );

            // Enrich results
            return this.enrichResults(vectorResults, options);

        } catch (error) {
            this.logger.error('Failed to find related items:', error);
            throw error;
        }
    }

    /**
     * インスピレーション発見モード
     * 高いノイズレベルで予期しない関連性を探索
     * @param {number} projectId - プロジェクトID
     * @param {Object} options - オプション
     * @returns {Promise<Array>} インスピレーション候補
     */
    async discoverInspirations(projectId, options = {}) {
        try {
            // Get random seed items
            const items = await this.repositories.knowledge.findByProject(projectId, {
                limit: 100,
                offset: Math.floor(Math.random() * 100)
            });

            if (items.length === 0) return [];

            const seedItem = items[Math.floor(Math.random() * items.length)];
            if (!seedItem.embeddings) return [];

            // Use vector search with high perturbation
            const vectorResults = await this.vectorSearchService.search(
                JSON.parse(seedItem.embeddings),
                projectId,
                {
                    mode: 'serendipity',
                    limit: options.limit || 30,
                    entityTypes: ['knowledge'],
                    perturbationType: options.perturbationType || 'directional',
                    excludeIds: [seedItem.id]
                }
            );

            // Enrich and apply special filtering for inspirations
            const enrichedResults = await this.enrichResults(vectorResults, options);
            
            // Filter for middle distance range (unexpected but not too distant)
            return this.filterMiddleDistance(
                enrichedResults,
                options.middleDistanceRange || { min: 0.4, max: 0.8 }
            );

        } catch (error) {
            this.logger.error('Failed to discover inspirations:', error);
            throw error;
        }
    }

    /**
     * 設定を更新
     * @param {Object} newConfig - 新しい設定
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        this.logger.info('Serendipity search config updated:', this.config);
    }
}

module.exports = SerendipitySearchService;