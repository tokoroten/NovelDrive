const { ipcMain } = require('electron');
const VectorSearchService = require('../services/vector-search-service');
const VectorIndexingService = require('../services/vector-indexing-service');
const localEmbeddingService = require('../services/local-embedding-service');
const { getLogger } = require('../utils/logger');

/**
 * Vector Search IPC Handlers
 */
class VectorSearchHandlers {
    constructor(repositories) {
        this.repositories = repositories;
        this.vectorSearchService = new VectorSearchService(repositories);
        this.vectorIndexingService = new VectorIndexingService(repositories);
        this.logger = getLogger();
    }

    /**
     * Initialize handlers
     */
    async initialize() {
        // Initialize services
        await this.vectorSearchService.initialize();
        await this.vectorIndexingService.initialize();
        
        // Register IPC handlers
        this.registerHandlers();
        
        this.logger.info('Vector Search handlers initialized');
    }

    /**
     * Register all IPC handlers
     */
    registerHandlers() {
        // Vector search operations
        ipcMain.handle('vector-search:search', async (event, queryVector, projectId, options) => {
            try {
                return await this.vectorSearchService.search(queryVector, projectId, options);
            } catch (error) {
                this.logger.error('Vector search failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-search:searchByText', async (event, text, projectId, options) => {
            try {
                const embedding = await localEmbeddingService.generateEmbedding(text);
                return await this.vectorSearchService.search(embedding, projectId, options);
            } catch (error) {
                this.logger.error('Text search failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-search:findSimilar', async (event, entityType, entityId, projectId, options) => {
            try {
                // Get the entity's vector
                const candidates = await this.vectorSearchService.getCandidates(
                    projectId,
                    [entityType],
                    1000
                );
                
                const entity = candidates.find(c => 
                    c.entity_type === entityType && c.entity_id === entityId
                );
                
                if (!entity) {
                    throw new Error('Entity not found in vector index');
                }
                
                const vector = JSON.parse(entity.vector);
                
                // Search for similar items
                return await this.vectorSearchService.search(vector, projectId, {
                    ...options,
                    excludeIds: [entityId]
                });
            } catch (error) {
                this.logger.error('Find similar failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-search:knn', async (event, queryVector, projectId, k, options) => {
            try {
                return await this.vectorSearchService.findKNearestNeighbors(
                    queryVector,
                    projectId,
                    k,
                    options
                );
            } catch (error) {
                this.logger.error('KNN search failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-search:cluster', async (event, projectId, k, options) => {
            try {
                return await this.vectorSearchService.clusterVectors(projectId, k, options);
            } catch (error) {
                this.logger.error('Clustering failed:', error);
                throw error;
            }
        });

        // Vector indexing operations
        ipcMain.handle('vector-index:indexKnowledge', async (event, knowledge) => {
            try {
                await this.vectorIndexingService.indexKnowledge(knowledge);
                return { success: true };
            } catch (error) {
                this.logger.error('Knowledge indexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:indexChapter', async (event, chapter) => {
            try {
                await this.vectorIndexingService.indexChapter(chapter);
                return { success: true };
            } catch (error) {
                this.logger.error('Chapter indexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:indexCharacter', async (event, character) => {
            try {
                await this.vectorIndexingService.indexCharacter(character);
                return { success: true };
            } catch (error) {
                this.logger.error('Character indexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:indexPlot', async (event, plot) => {
            try {
                await this.vectorIndexingService.indexPlot(plot);
                return { success: true };
            } catch (error) {
                this.logger.error('Plot indexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:batchIndex', async (event, items) => {
            try {
                await this.vectorIndexingService.batchIndex(items);
                return { success: true };
            } catch (error) {
                this.logger.error('Batch indexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:reindexProject', async (event, projectId, options) => {
            try {
                return await this.vectorIndexingService.reindexProject(projectId, options);
            } catch (error) {
                this.logger.error('Project reindexing failed:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:deleteIndex', async (event, entityType, entityId) => {
            try {
                await this.vectorIndexingService.deleteIndex(entityType, entityId);
                return { success: true };
            } catch (error) {
                this.logger.error('Index deletion failed:', error);
                throw error;
            }
        });

        // Statistics and management
        ipcMain.handle('vector-search:getStatistics', async (event, projectId) => {
            try {
                return await this.vectorSearchService.getStatistics(projectId);
            } catch (error) {
                this.logger.error('Failed to get statistics:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-search:clearCache', async (event) => {
            try {
                this.vectorSearchService.clearCache();
                return { success: true };
            } catch (error) {
                this.logger.error('Failed to clear cache:', error);
                throw error;
            }
        });

        // Configuration
        ipcMain.handle('vector-search:updateConfig', async (event, config) => {
            try {
                this.vectorSearchService.updateConfig(config);
                return { success: true };
            } catch (error) {
                this.logger.error('Failed to update config:', error);
                throw error;
            }
        });

        ipcMain.handle('vector-index:updateConfig', async (event, config) => {
            try {
                this.vectorIndexingService.updateConfig(config);
                return { success: true };
            } catch (error) {
                this.logger.error('Failed to update indexing config:', error);
                throw error;
            }
        });

        // Embedding generation
        ipcMain.handle('embedding:generate', async (event, text) => {
            try {
                return await localEmbeddingService.generateEmbedding(text);
            } catch (error) {
                this.logger.error('Embedding generation failed:', error);
                throw error;
            }
        });

        ipcMain.handle('embedding:generateBatch', async (event, texts) => {
            try {
                return await localEmbeddingService.generateEmbeddings(texts);
            } catch (error) {
                this.logger.error('Batch embedding generation failed:', error);
                throw error;
            }
        });

        ipcMain.handle('embedding:calculateSimilarity', async (event, vec1, vec2) => {
            try {
                return localEmbeddingService.cosineSimilarity(vec1, vec2);
            } catch (error) {
                this.logger.error('Similarity calculation failed:', error);
                throw error;
            }
        });

        ipcMain.handle('embedding:calculateTextSimilarity', async (event, text1, text2) => {
            try {
                return await localEmbeddingService.calculateTextSimilarity(text1, text2);
            } catch (error) {
                this.logger.error('Text similarity calculation failed:', error);
                throw error;
            }
        });
    }

    /**
     * Get indexing service instance
     * @returns {VectorIndexingService} Indexing service
     */
    getIndexingService() {
        return this.vectorIndexingService;
    }

    /**
     * Get search service instance
     * @returns {VectorSearchService} Search service
     */
    getSearchService() {
        return this.vectorSearchService;
    }
}

module.exports = VectorSearchHandlers;