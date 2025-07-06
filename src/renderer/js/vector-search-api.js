/**
 * Vector Search API for frontend
 */
class VectorSearchAPI {
    /**
     * Perform vector search
     * @param {Array} queryVector - Query vector
     * @param {number} projectId - Project ID
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    static async search(queryVector, projectId, options = {}) {
        return window.api.vectorSearch.search(queryVector, projectId, options);
    }

    /**
     * Search by text (generates embedding automatically)
     * @param {string} text - Search text
     * @param {number} projectId - Project ID
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    static async searchByText(text, projectId, options = {}) {
        return window.api.vectorSearch.searchByText(text, projectId, options);
    }

    /**
     * Find similar items
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     * @param {number} projectId - Project ID
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Similar items
     */
    static async findSimilar(entityType, entityId, projectId, options = {}) {
        return window.api.vectorSearch.findSimilar(entityType, entityId, projectId, options);
    }

    /**
     * Find k-nearest neighbors
     * @param {Array} queryVector - Query vector
     * @param {number} projectId - Project ID
     * @param {number} k - Number of neighbors
     * @param {Object} options - Search options
     * @returns {Promise<Array>} K-nearest neighbors
     */
    static async findKNN(queryVector, projectId, k = 5, options = {}) {
        return window.api.vectorSearch.knn(queryVector, projectId, k, options);
    }

    /**
     * Cluster vectors
     * @param {number} projectId - Project ID
     * @param {number} k - Number of clusters
     * @param {Object} options - Clustering options
     * @returns {Promise<Object>} Clustering results
     */
    static async clusterVectors(projectId, k = 5, options = {}) {
        return window.api.vectorSearch.cluster(projectId, k, options);
    }

    /**
     * Get vector search statistics
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Statistics
     */
    static async getStatistics(projectId) {
        return window.api.vectorSearch.getStatistics(projectId);
    }

    /**
     * Clear vector cache
     * @returns {Promise<Object>} Result
     */
    static async clearCache() {
        return window.api.vectorSearch.clearCache();
    }

    /**
     * Update vector search configuration
     * @param {Object} config - New configuration
     * @returns {Promise<Object>} Result
     */
    static async updateConfig(config) {
        return window.api.vectorSearch.updateConfig(config);
    }
}

/**
 * Vector Indexing API for frontend
 */
class VectorIndexingAPI {
    /**
     * Index knowledge item
     * @param {Object} knowledge - Knowledge item
     * @returns {Promise<Object>} Result
     */
    static async indexKnowledge(knowledge) {
        return window.api.vectorIndex.indexKnowledge(knowledge);
    }

    /**
     * Index chapter
     * @param {Object} chapter - Chapter
     * @returns {Promise<Object>} Result
     */
    static async indexChapter(chapter) {
        return window.api.vectorIndex.indexChapter(chapter);
    }

    /**
     * Index character
     * @param {Object} character - Character
     * @returns {Promise<Object>} Result
     */
    static async indexCharacter(character) {
        return window.api.vectorIndex.indexCharacter(character);
    }

    /**
     * Index plot
     * @param {Object} plot - Plot
     * @returns {Promise<Object>} Result
     */
    static async indexPlot(plot) {
        return window.api.vectorIndex.indexPlot(plot);
    }

    /**
     * Batch index items
     * @param {Array} items - Items to index
     * @returns {Promise<Object>} Result
     */
    static async batchIndex(items) {
        return window.api.vectorIndex.batchIndex(items);
    }

    /**
     * Reindex entire project
     * @param {number} projectId - Project ID
     * @param {Object} options - Reindex options
     * @returns {Promise<Object>} Result
     */
    static async reindexProject(projectId, options = {}) {
        return window.api.vectorIndex.reindexProject(projectId, options);
    }

    /**
     * Delete vector index
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     * @returns {Promise<Object>} Result
     */
    static async deleteIndex(entityType, entityId) {
        return window.api.vectorIndex.deleteIndex(entityType, entityId);
    }

    /**
     * Update indexing configuration
     * @param {Object} config - New configuration
     * @returns {Promise<Object>} Result
     */
    static async updateConfig(config) {
        return window.api.vectorIndex.updateConfig(config);
    }
}

/**
 * Embedding API for frontend
 */
class EmbeddingAPI {
    /**
     * Generate embedding for text
     * @param {string} text - Text to embed
     * @returns {Promise<Array>} Embedding vector
     */
    static async generate(text) {
        return window.api.embedding.generate(text);
    }

    /**
     * Generate embeddings for multiple texts
     * @param {Array} texts - Texts to embed
     * @returns {Promise<Array>} Embedding vectors
     */
    static async generateBatch(texts) {
        return window.api.embedding.generateBatch(texts);
    }

    /**
     * Calculate similarity between two vectors
     * @param {Array} vec1 - First vector
     * @param {Array} vec2 - Second vector
     * @returns {Promise<number>} Cosine similarity
     */
    static async calculateSimilarity(vec1, vec2) {
        return window.api.embedding.calculateSimilarity(vec1, vec2);
    }

    /**
     * Calculate text similarity
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {Promise<number>} Similarity score (0-1)
     */
    static async calculateTextSimilarity(text1, text2) {
        return window.api.embedding.calculateTextSimilarity(text1, text2);
    }
}

// Export the APIs
window.VectorSearchAPI = VectorSearchAPI;
window.VectorIndexingAPI = VectorIndexingAPI;
window.EmbeddingAPI = EmbeddingAPI;