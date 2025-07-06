const { getLogger } = require('../utils/logger');
const localEmbeddingService = require('./local-embedding-service');
const VectorSearchService = require('./vector-search-service');

/**
 * Vector Indexing Service
 * Manages automatic indexing of content embeddings
 */
class VectorIndexingService {
    constructor(repositories) {
        this.repositories = repositories;
        this.logger = getLogger();
        this.vectorSearchService = new VectorSearchService(repositories);
        
        // Indexing configuration
        this.config = {
            batchSize: 10,
            autoIndex: true,
            indexTypes: {
                knowledge: true,
                chapters: true,
                characters: true,
                plots: true
            }
        };
        
        // Queue for batch processing
        this.indexQueue = [];
        this.isProcessing = false;
    }

    /**
     * Initialize the indexing service
     */
    async initialize() {
        await this.vectorSearchService.initialize();
        await localEmbeddingService.initialize();
        this.logger.info('Vector Indexing Service initialized');
    }

    /**
     * Index a knowledge item
     * @param {Object} knowledge - Knowledge item
     */
    async indexKnowledge(knowledge) {
        if (!this.config.autoIndex || !this.config.indexTypes.knowledge) {
            return;
        }

        try {
            // Generate embedding for content
            const text = this.getKnowledgeText(knowledge);
            const embedding = await localEmbeddingService.generateEmbedding(text);
            
            // Store in vector index
            await this.vectorSearchService.storeVector(
                'knowledge',
                knowledge.id,
                knowledge.project_id,
                embedding,
                {
                    type: knowledge.type,
                    title: knowledge.title
                }
            );
            
            // Also update the knowledge table embeddings column for compatibility
            await this.repositories.knowledge.update(knowledge.id, {
                embeddings: JSON.stringify(embedding)
            });
            
            this.logger.debug(`Indexed knowledge item: ${knowledge.id}`);
        } catch (error) {
            this.logger.error(`Failed to index knowledge ${knowledge.id}:`, error);
            throw error;
        }
    }

    /**
     * Index a chapter
     * @param {Object} chapter - Chapter object
     */
    async indexChapter(chapter) {
        if (!this.config.autoIndex || !this.config.indexTypes.chapters) {
            return;
        }

        try {
            // Generate embedding for chapter content
            const text = this.getChapterText(chapter);
            const embedding = await localEmbeddingService.generateEmbedding(text);
            
            // Store in vector index
            await this.vectorSearchService.storeVector(
                'chapter',
                chapter.id,
                chapter.project_id,
                embedding,
                {
                    title: chapter.title,
                    chapterNumber: chapter.chapter_number,
                    plotId: chapter.plot_id
                }
            );
            
            this.logger.debug(`Indexed chapter: ${chapter.id}`);
        } catch (error) {
            this.logger.error(`Failed to index chapter ${chapter.id}:`, error);
            throw error;
        }
    }

    /**
     * Index a character
     * @param {Object} character - Character object
     */
    async indexCharacter(character) {
        if (!this.config.autoIndex || !this.config.indexTypes.characters) {
            return;
        }

        try {
            // Generate embedding for character description
            const text = this.getCharacterText(character);
            const embedding = await localEmbeddingService.generateEmbedding(text);
            
            // Store in vector index
            await this.vectorSearchService.storeVector(
                'character',
                character.id,
                character.project_id,
                embedding,
                {
                    name: character.name
                }
            );
            
            this.logger.debug(`Indexed character: ${character.id}`);
        } catch (error) {
            this.logger.error(`Failed to index character ${character.id}:`, error);
            throw error;
        }
    }

    /**
     * Index a plot
     * @param {Object} plot - Plot object
     */
    async indexPlot(plot) {
        if (!this.config.autoIndex || !this.config.indexTypes.plots) {
            return;
        }

        try {
            // Generate embedding for plot content
            const text = this.getPlotText(plot);
            const embedding = await localEmbeddingService.generateEmbedding(text);
            
            // Store in vector index
            await this.vectorSearchService.storeVector(
                'plot',
                plot.id,
                plot.project_id,
                embedding,
                {
                    title: plot.title,
                    version: plot.version
                }
            );
            
            this.logger.debug(`Indexed plot: ${plot.id}`);
        } catch (error) {
            this.logger.error(`Failed to index plot ${plot.id}:`, error);
            throw error;
        }
    }

    /**
     * Batch index multiple items
     * @param {Array} items - Array of {type, data} objects
     */
    async batchIndex(items) {
        const batches = [];
        
        // Group by type for efficient processing
        const grouped = items.reduce((acc, item) => {
            if (!acc[item.type]) acc[item.type] = [];
            acc[item.type].push(item.data);
            return acc;
        }, {});
        
        for (const [type, data] of Object.entries(grouped)) {
            // Process in batches
            for (let i = 0; i < data.length; i += this.config.batchSize) {
                const batch = data.slice(i, i + this.config.batchSize);
                
                try {
                    // Generate embeddings in batch
                    const texts = batch.map(item => this.getTextForType(type, item));
                    const embeddings = await localEmbeddingService.generateEmbeddings(texts);
                    
                    // Prepare vector data
                    const vectorData = batch.map((item, index) => ({
                        entityType: type,
                        entityId: item.id,
                        projectId: item.project_id,
                        vector: embeddings[index],
                        metadata: this.getMetadataForType(type, item)
                    }));
                    
                    // Store vectors in batch
                    await this.vectorSearchService.batchStoreVectors(vectorData);
                    
                    // Update embeddings in original tables if needed
                    if (type === 'knowledge') {
                        for (let j = 0; j < batch.length; j++) {
                            await this.repositories.knowledge.update(batch[j].id, {
                                embeddings: JSON.stringify(embeddings[j])
                            });
                        }
                    }
                    
                } catch (error) {
                    this.logger.error(`Failed to batch index ${type}:`, error);
                }
            }
        }
        
        this.logger.info(`Batch indexed ${items.length} items`);
    }

    /**
     * Queue item for indexing
     * @param {string} type - Entity type
     * @param {Object} data - Entity data
     */
    queueForIndexing(type, data) {
        this.indexQueue.push({ type, data });
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process the indexing queue
     */
    async processQueue() {
        if (this.isProcessing || this.indexQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // Process items in batches
            while (this.indexQueue.length > 0) {
                const batch = this.indexQueue.splice(0, this.config.batchSize);
                await this.batchIndex(batch);
            }
        } catch (error) {
            this.logger.error('Failed to process indexing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Reindex all content for a project
     * @param {number} projectId - Project ID
     * @param {Object} options - Reindexing options
     */
    async reindexProject(projectId, options = {}) {
        this.logger.info(`Starting reindex for project ${projectId}`);
        
        const types = options.types || Object.keys(this.config.indexTypes);
        let totalIndexed = 0;
        
        for (const type of types) {
            if (!this.config.indexTypes[type]) continue;
            
            try {
                let items = [];
                
                switch (type) {
                    case 'knowledge':
                        items = await this.repositories.knowledge.findByProject(projectId, {
                            limit: 10000
                        });
                        break;
                    case 'chapters':
                        items = await this.repositories.chapters.findByProject(projectId);
                        break;
                    case 'characters':
                        items = await this.repositories.characters.findByProject(projectId);
                        break;
                    case 'plots':
                        items = await this.repositories.plots.findByProject(projectId);
                        break;
                }
                
                if (items.length > 0) {
                    await this.batchIndex(
                        items.map(item => ({ type, data: item }))
                    );
                    totalIndexed += items.length;
                }
                
            } catch (error) {
                this.logger.error(`Failed to reindex ${type} for project ${projectId}:`, error);
            }
        }
        
        this.logger.info(`Reindexed ${totalIndexed} items for project ${projectId}`);
        return { totalIndexed };
    }

    /**
     * Delete vector index for an entity
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     */
    async deleteIndex(entityType, entityId) {
        try {
            await this.vectorSearchService.deleteVector(entityType, entityId);
            this.logger.debug(`Deleted index for ${entityType}:${entityId}`);
        } catch (error) {
            this.logger.error(`Failed to delete index for ${entityType}:${entityId}:`, error);
            throw error;
        }
    }

    /**
     * Get text content for knowledge item
     * @param {Object} knowledge - Knowledge item
     * @returns {string} Text content
     */
    getKnowledgeText(knowledge) {
        const parts = [];
        
        if (knowledge.title) parts.push(knowledge.title);
        if (knowledge.content) parts.push(knowledge.content);
        
        // Add metadata if relevant
        if (knowledge.metadata) {
            try {
                const metadata = JSON.parse(knowledge.metadata);
                if (metadata.tags) parts.push(metadata.tags.join(' '));
                if (metadata.description) parts.push(metadata.description);
            } catch (e) {
                // Ignore parse errors
            }
        }
        
        return parts.join(' ');
    }

    /**
     * Get text content for chapter
     * @param {Object} chapter - Chapter object
     * @returns {string} Text content
     */
    getChapterText(chapter) {
        const parts = [];
        
        if (chapter.title) parts.push(chapter.title);
        if (chapter.summary) parts.push(chapter.summary);
        if (chapter.content) {
            // Limit chapter content for embedding
            const truncated = chapter.content.substring(0, 2000);
            parts.push(truncated);
        }
        
        return parts.join(' ');
    }

    /**
     * Get text content for character
     * @param {Object} character - Character object
     * @returns {string} Text content
     */
    getCharacterText(character) {
        const parts = [];
        
        if (character.name) parts.push(character.name);
        if (character.description) parts.push(character.description);
        if (character.personality) parts.push(character.personality);
        if (character.appearance) parts.push(character.appearance);
        if (character.background) parts.push(character.background);
        
        return parts.join(' ');
    }

    /**
     * Get text content for plot
     * @param {Object} plot - Plot object
     * @returns {string} Text content
     */
    getPlotText(plot) {
        const parts = [];
        
        if (plot.title) parts.push(plot.title);
        if (plot.summary) parts.push(plot.summary);
        
        // Add structure information
        if (plot.structure) {
            try {
                const structure = JSON.parse(plot.structure);
                parts.push(JSON.stringify(structure));
            } catch (e) {
                parts.push(plot.structure);
            }
        }
        
        return parts.join(' ');
    }

    /**
     * Get text content for a specific type
     * @param {string} type - Entity type
     * @param {Object} item - Entity data
     * @returns {string} Text content
     */
    getTextForType(type, item) {
        switch (type) {
            case 'knowledge':
                return this.getKnowledgeText(item);
            case 'chapter':
            case 'chapters':
                return this.getChapterText(item);
            case 'character':
            case 'characters':
                return this.getCharacterText(item);
            case 'plot':
            case 'plots':
                return this.getPlotText(item);
            default:
                return item.content || item.description || '';
        }
    }

    /**
     * Get metadata for a specific type
     * @param {string} type - Entity type
     * @param {Object} item - Entity data
     * @returns {Object} Metadata
     */
    getMetadataForType(type, item) {
        switch (type) {
            case 'knowledge':
                return {
                    type: item.type,
                    title: item.title
                };
            case 'chapter':
            case 'chapters':
                return {
                    title: item.title,
                    chapterNumber: item.chapter_number,
                    plotId: item.plot_id
                };
            case 'character':
            case 'characters':
                return {
                    name: item.name
                };
            case 'plot':
            case 'plots':
                return {
                    title: item.title,
                    version: item.version
                };
            default:
                return {};
        }
    }

    /**
     * Get indexing statistics
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics(projectId) {
        return this.vectorSearchService.getStatistics(projectId);
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        this.logger.info('Vector Indexing Service config updated:', this.config);
    }
}

module.exports = VectorIndexingService;