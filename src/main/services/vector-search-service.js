const { getLogger } = require('../utils/logger');
const localEmbeddingService = require('./local-embedding-service');

/**
 * Vector Search Service
 * Provides efficient vector storage, indexing, and similarity search with perturbation support
 */
class VectorSearchService {
    constructor(repositories) {
        this.repositories = repositories;
        this.logger = getLogger();
        
        // Vector search configuration
        this.config = {
            dimensions: 768, // multilingual-e5-base dimension
            searchModes: {
                exact: { noiseLevel: 0, topK: 20 },
                similar: { noiseLevel: 0.1, topK: 30 },
                serendipity: { noiseLevel: 0.3, topK: 50 }
            },
            perturbationTypes: {
                gaussian: 'gaussian',
                uniform: 'uniform',
                directional: 'directional'
            },
            indexingBatchSize: 100,
            cacheSize: 1000,
            cacheExpiry: 3600000 // 1 hour in milliseconds
        };
        
        // In-memory cache for frequently accessed vectors
        this.vectorCache = new Map();
        this.cacheTimestamps = new Map();
    }

    /**
     * Initialize the vector search service
     */
    async initialize() {
        this.logger.info('Initializing Vector Search Service');
        
        // Ensure embedding service is initialized
        await localEmbeddingService.initialize();
        
        // Create vector index table if not exists
        await this.createVectorIndexTable();
        
        this.logger.info('Vector Search Service initialized');
    }

    /**
     * Create vector index table for optimized search
     */
    async createVectorIndexTable() {
        const db = this.repositories.knowledge.db;
        
        try {
            // Create vector index table
            db.exec(`
                CREATE TABLE IF NOT EXISTS vector_index (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_type TEXT NOT NULL,
                    entity_id INTEGER NOT NULL,
                    project_id INTEGER NOT NULL,
                    vector TEXT NOT NULL,
                    magnitude REAL NOT NULL,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(entity_type, entity_id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_vector_index_project ON vector_index(project_id);
                CREATE INDEX IF NOT EXISTS idx_vector_index_entity ON vector_index(entity_type, entity_id);
                CREATE INDEX IF NOT EXISTS idx_vector_index_magnitude ON vector_index(magnitude);
            `);
        } catch (error) {
            this.logger.error('Failed to create vector index table:', error);
            throw error;
        }
    }

    /**
     * Store vector for an entity
     * @param {string} entityType - Type of entity (knowledge, chapter, character, etc.)
     * @param {number} entityId - ID of the entity
     * @param {number} projectId - Project ID
     * @param {number[]} vector - Embedding vector
     * @param {Object} metadata - Additional metadata
     */
    async storeVector(entityType, entityId, projectId, vector, metadata = {}) {
        const db = this.repositories.knowledge.db;
        
        try {
            // Calculate magnitude for optimization
            const magnitude = this.calculateMagnitude(vector);
            
            // Prepare the statement
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO vector_index 
                (entity_type, entity_id, project_id, vector, magnitude, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                entityType,
                entityId,
                projectId,
                JSON.stringify(vector),
                magnitude,
                JSON.stringify(metadata)
            );
            
            // Update cache
            const cacheKey = `${entityType}:${entityId}`;
            this.updateCache(cacheKey, vector);
            
            this.logger.debug(`Stored vector for ${entityType}:${entityId}`);
        } catch (error) {
            this.logger.error('Failed to store vector:', error);
            throw error;
        }
    }

    /**
     * Batch store vectors for multiple entities
     * @param {Array} entities - Array of {entityType, entityId, projectId, vector, metadata}
     */
    async batchStoreVectors(entities) {
        const db = this.repositories.knowledge.db;
        
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO vector_index 
                (entity_type, entity_id, project_id, vector, magnitude, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            const transaction = db.transaction((entities) => {
                for (const entity of entities) {
                    const magnitude = this.calculateMagnitude(entity.vector);
                    stmt.run(
                        entity.entityType,
                        entity.entityId,
                        entity.projectId,
                        JSON.stringify(entity.vector),
                        magnitude,
                        JSON.stringify(entity.metadata || {})
                    );
                    
                    // Update cache
                    const cacheKey = `${entity.entityType}:${entity.entityId}`;
                    this.updateCache(cacheKey, entity.vector);
                }
            });
            
            transaction(entities);
            this.logger.info(`Batch stored ${entities.length} vectors`);
        } catch (error) {
            this.logger.error('Failed to batch store vectors:', error);
            throw error;
        }
    }

    /**
     * Search for similar vectors
     * @param {number[]} queryVector - Query vector
     * @param {number} projectId - Project ID
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results with similarity scores
     */
    async search(queryVector, projectId, options = {}) {
        const {
            mode = 'similar',
            limit = 20,
            entityTypes = null,
            threshold = 0,
            excludeIds = [],
            perturbationType = 'gaussian'
        } = options;
        
        try {
            // Apply perturbation based on search mode
            const searchConfig = this.config.searchModes[mode] || this.config.searchModes.similar;
            const perturbedVector = this.applyPerturbation(
                queryVector,
                searchConfig.noiseLevel,
                perturbationType
            );
            
            // Get candidates from database
            const candidates = await this.getCandidates(projectId, entityTypes, searchConfig.topK * 2);
            
            // Calculate similarities
            const results = [];
            for (const candidate of candidates) {
                // Skip excluded IDs
                if (excludeIds.includes(candidate.entity_id)) continue;
                
                // Get vector from cache or parse from JSON
                const candidateVector = await this.getVector(
                    candidate.entity_type,
                    candidate.entity_id,
                    candidate.vector
                );
                
                if (!candidateVector) continue;
                
                // Calculate similarity
                const similarity = this.cosineSimilarity(perturbedVector, candidateVector);
                
                // Apply threshold
                if (similarity < threshold) continue;
                
                results.push({
                    entityType: candidate.entity_type,
                    entityId: candidate.entity_id,
                    similarity,
                    metadata: JSON.parse(candidate.metadata || '{}'),
                    distance: 1 - similarity
                });
            }
            
            // Sort by similarity and limit results
            results.sort((a, b) => b.similarity - a.similarity);
            return results.slice(0, limit);
            
        } catch (error) {
            this.logger.error('Vector search failed:', error);
            throw error;
        }
    }

    /**
     * Apply perturbation to a vector
     * @param {number[]} vector - Original vector
     * @param {number} noiseLevel - Noise level (0-1)
     * @param {string} perturbationType - Type of perturbation
     * @returns {number[]} Perturbed vector
     */
    applyPerturbation(vector, noiseLevel, perturbationType = 'gaussian') {
        if (noiseLevel === 0) return vector;
        
        let perturbedVector;
        
        switch (perturbationType) {
            case 'gaussian':
                perturbedVector = this.gaussianPerturbation(vector, noiseLevel);
                break;
            case 'uniform':
                perturbedVector = this.uniformPerturbation(vector, noiseLevel);
                break;
            case 'directional':
                perturbedVector = this.directionalPerturbation(vector, noiseLevel);
                break;
            default:
                perturbedVector = this.gaussianPerturbation(vector, noiseLevel);
        }
        
        // Normalize the perturbed vector
        return this.normalizeVector(perturbedVector);
    }

    /**
     * Gaussian perturbation
     * @param {number[]} vector - Original vector
     * @param {number} noiseLevel - Noise level
     * @returns {number[]} Perturbed vector
     */
    gaussianPerturbation(vector, noiseLevel) {
        return vector.map(value => {
            const noise = this.generateGaussianNoise() * noiseLevel;
            return value + noise;
        });
    }

    /**
     * Uniform perturbation
     * @param {number[]} vector - Original vector
     * @param {number} noiseLevel - Noise level
     * @returns {number[]} Perturbed vector
     */
    uniformPerturbation(vector, noiseLevel) {
        return vector.map(value => {
            const noise = (Math.random() - 0.5) * 2 * noiseLevel;
            return value + noise;
        });
    }

    /**
     * Directional perturbation (adds noise in a consistent direction)
     * @param {number[]} vector - Original vector
     * @param {number} noiseLevel - Noise level
     * @returns {number[]} Perturbed vector
     */
    directionalPerturbation(vector, noiseLevel) {
        // Generate a random direction vector
        const direction = Array(vector.length).fill(0).map(() => this.generateGaussianNoise());
        const normalizedDirection = this.normalizeVector(direction);
        
        // Apply perturbation in the direction
        return vector.map((value, i) => value + normalizedDirection[i] * noiseLevel);
    }

    /**
     * Generate Gaussian noise using Box-Muller transform
     * @returns {number} Gaussian noise value
     */
    generateGaussianNoise() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    /**
     * Get vector candidates from database
     * @param {number} projectId - Project ID
     * @param {Array} entityTypes - Entity types to filter
     * @param {number} limit - Maximum number of candidates
     * @returns {Promise<Array>} Candidates
     */
    async getCandidates(projectId, entityTypes, limit) {
        const db = this.repositories.knowledge.db;
        
        try {
            let query = `
                SELECT entity_type, entity_id, vector, metadata
                FROM vector_index
                WHERE project_id = ?
            `;
            const params = [projectId];
            
            if (entityTypes && entityTypes.length > 0) {
                const placeholders = entityTypes.map(() => '?').join(',');
                query += ` AND entity_type IN (${placeholders})`;
                params.push(...entityTypes);
            }
            
            query += ` ORDER BY updated_at DESC LIMIT ?`;
            params.push(limit);
            
            const stmt = db.prepare(query);
            return stmt.all(...params);
        } catch (error) {
            this.logger.error('Failed to get candidates:', error);
            throw error;
        }
    }

    /**
     * Get vector from cache or parse from JSON
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     * @param {string} vectorJson - Vector JSON string
     * @returns {Promise<number[]>} Vector
     */
    async getVector(entityType, entityId, vectorJson) {
        const cacheKey = `${entityType}:${entityId}`;
        
        // Check cache
        if (this.vectorCache.has(cacheKey)) {
            const timestamp = this.cacheTimestamps.get(cacheKey);
            if (Date.now() - timestamp < this.config.cacheExpiry) {
                return this.vectorCache.get(cacheKey);
            }
        }
        
        try {
            const vector = JSON.parse(vectorJson);
            this.updateCache(cacheKey, vector);
            return vector;
        } catch (error) {
            this.logger.error(`Failed to parse vector for ${cacheKey}:`, error);
            return null;
        }
    }

    /**
     * Update cache
     * @param {string} key - Cache key
     * @param {number[]} vector - Vector to cache
     */
    updateCache(key, vector) {
        // Implement LRU cache
        if (this.vectorCache.size >= this.config.cacheSize) {
            // Remove oldest entry
            const oldestKey = Array.from(this.cacheTimestamps.entries())
                .sort((a, b) => a[1] - b[1])[0][0];
            this.vectorCache.delete(oldestKey);
            this.cacheTimestamps.delete(oldestKey);
        }
        
        this.vectorCache.set(key, vector);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {number[]} vec1 - First vector
     * @param {number[]} vec2 - Second vector
     * @returns {number} Cosine similarity (-1 to 1)
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
     * Calculate magnitude of a vector
     * @param {number[]} vector - Vector
     * @returns {number} Magnitude
     */
    calculateMagnitude(vector) {
        return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    }

    /**
     * Normalize a vector
     * @param {number[]} vector - Vector to normalize
     * @returns {number[]} Normalized vector
     */
    normalizeVector(vector) {
        const magnitude = this.calculateMagnitude(vector);
        if (magnitude === 0) return vector;
        return vector.map(val => val / magnitude);
    }

    /**
     * Find k-nearest neighbors
     * @param {number[]} queryVector - Query vector
     * @param {number} projectId - Project ID
     * @param {number} k - Number of neighbors
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} K-nearest neighbors
     */
    async findKNearestNeighbors(queryVector, projectId, k = 5, options = {}) {
        return this.search(queryVector, projectId, {
            ...options,
            mode: 'exact',
            limit: k
        });
    }

    /**
     * Cluster vectors using k-means
     * @param {number} projectId - Project ID
     * @param {number} k - Number of clusters
     * @param {Object} options - Clustering options
     * @returns {Promise<Object>} Clustering results
     */
    async clusterVectors(projectId, k = 5, options = {}) {
        const { entityTypes = null, maxIterations = 100 } = options;
        
        try {
            // Get all vectors for the project
            const candidates = await this.getCandidates(projectId, entityTypes, 10000);
            
            if (candidates.length < k) {
                throw new Error(`Not enough vectors for ${k} clusters`);
            }
            
            // Parse vectors
            const vectors = candidates.map(c => ({
                entityType: c.entity_type,
                entityId: c.entity_id,
                vector: JSON.parse(c.vector)
            }));
            
            // Initialize centroids randomly
            const centroids = this.initializeCentroids(vectors.map(v => v.vector), k);
            
            let clusters = [];
            let iterations = 0;
            
            while (iterations < maxIterations) {
                // Assign vectors to nearest centroid
                const newClusters = Array(k).fill(null).map(() => []);
                
                for (const item of vectors) {
                    let minDistance = Infinity;
                    let assignedCluster = 0;
                    
                    for (let i = 0; i < k; i++) {
                        const similarity = this.cosineSimilarity(item.vector, centroids[i]);
                        const distance = 1 - similarity;
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            assignedCluster = i;
                        }
                    }
                    
                    newClusters[assignedCluster].push(item);
                }
                
                // Update centroids
                let converged = true;
                for (let i = 0; i < k; i++) {
                    if (newClusters[i].length === 0) continue;
                    
                    const newCentroid = this.calculateCentroid(
                        newClusters[i].map(item => item.vector)
                    );
                    
                    const similarity = this.cosineSimilarity(centroids[i], newCentroid);
                    if (similarity < 0.999) {
                        converged = false;
                    }
                    
                    centroids[i] = newCentroid;
                }
                
                clusters = newClusters;
                iterations++;
                
                if (converged) break;
            }
            
            // Calculate cluster statistics
            const clusterStats = clusters.map((cluster, i) => ({
                id: i,
                size: cluster.length,
                centroid: centroids[i],
                members: cluster.map(item => ({
                    entityType: item.entityType,
                    entityId: item.entityId
                }))
            }));
            
            return {
                clusters: clusterStats,
                iterations,
                converged: iterations < maxIterations
            };
            
        } catch (error) {
            this.logger.error('Clustering failed:', error);
            throw error;
        }
    }

    /**
     * Initialize centroids for k-means clustering
     * @param {Array} vectors - All vectors
     * @param {number} k - Number of centroids
     * @returns {Array} Initial centroids
     */
    initializeCentroids(vectors, k) {
        const centroids = [];
        const indices = new Set();
        
        // K-means++ initialization
        // First centroid is random
        const firstIndex = Math.floor(Math.random() * vectors.length);
        centroids.push(vectors[firstIndex]);
        indices.add(firstIndex);
        
        // Remaining centroids are chosen with probability proportional to distance
        while (centroids.length < k) {
            const distances = vectors.map((vector, index) => {
                if (indices.has(index)) return 0;
                
                let minDistance = Infinity;
                for (const centroid of centroids) {
                    const similarity = this.cosineSimilarity(vector, centroid);
                    const distance = 1 - similarity;
                    minDistance = Math.min(minDistance, distance);
                }
                
                return minDistance * minDistance; // Square for probability
            });
            
            // Choose next centroid
            const totalDistance = distances.reduce((sum, d) => sum + d, 0);
            let random = Math.random() * totalDistance;
            
            for (let i = 0; i < vectors.length; i++) {
                random -= distances[i];
                if (random <= 0 && !indices.has(i)) {
                    centroids.push(vectors[i]);
                    indices.add(i);
                    break;
                }
            }
        }
        
        return centroids;
    }

    /**
     * Calculate centroid of vectors
     * @param {Array} vectors - Vectors to average
     * @returns {Array} Centroid vector
     */
    calculateCentroid(vectors) {
        if (vectors.length === 0) return null;
        
        const dimension = vectors[0].length;
        const centroid = new Array(dimension).fill(0);
        
        for (const vector of vectors) {
            for (let i = 0; i < dimension; i++) {
                centroid[i] += vector[i];
            }
        }
        
        // Average and normalize
        const averaged = centroid.map(val => val / vectors.length);
        return this.normalizeVector(averaged);
    }

    /**
     * Delete vectors for an entity
     * @param {string} entityType - Entity type
     * @param {number} entityId - Entity ID
     */
    async deleteVector(entityType, entityId) {
        const db = this.repositories.knowledge.db;
        
        try {
            const stmt = db.prepare(`
                DELETE FROM vector_index
                WHERE entity_type = ? AND entity_id = ?
            `);
            
            stmt.run(entityType, entityId);
            
            // Remove from cache
            const cacheKey = `${entityType}:${entityId}`;
            this.vectorCache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
            
            this.logger.debug(`Deleted vector for ${entityType}:${entityId}`);
        } catch (error) {
            this.logger.error('Failed to delete vector:', error);
            throw error;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.vectorCache.clear();
        this.cacheTimestamps.clear();
        this.logger.info('Vector cache cleared');
    }

    /**
     * Get vector search statistics
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics(projectId) {
        const db = this.repositories.knowledge.db;
        
        try {
            const stats = db.prepare(`
                SELECT 
                    entity_type,
                    COUNT(*) as count,
                    AVG(magnitude) as avg_magnitude,
                    MIN(created_at) as first_created,
                    MAX(updated_at) as last_updated
                FROM vector_index
                WHERE project_id = ?
                GROUP BY entity_type
            `).all(projectId);
            
            const total = db.prepare(`
                SELECT COUNT(*) as total
                FROM vector_index
                WHERE project_id = ?
            `).get(projectId);
            
            return {
                total: total.total,
                byType: stats,
                cacheSize: this.vectorCache.size,
                dimensions: this.config.dimensions
            };
        } catch (error) {
            this.logger.error('Failed to get statistics:', error);
            throw error;
        }
    }
}

module.exports = VectorSearchService;