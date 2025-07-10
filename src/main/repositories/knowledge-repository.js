const BaseRepository = require('./base-repository');

class KnowledgeRepository extends BaseRepository {
  constructor(db) {
    super(db, 'knowledge');
  }

  /**
   * Create knowledge with embeddings
   * @param {Object} data
   * @param {Array<number>} embeddings
   * @returns {Object}
   */
  async createWithEmbeddings(data, embeddings) {
    try {
      const knowledgeData = {
        ...data,
        embeddings: JSON.stringify(embeddings)
      };
      const knowledge = this.create(knowledgeData);
      
      // Also store in vector index if vector search is available
      if (global.vectorIndexingService) {
        await global.vectorIndexingService.indexKnowledge(knowledge);
      }
      
      return knowledge;
    } catch (error) {
      console.error('Error creating knowledge with embeddings:', error);
      throw error;
    }
  }

  /**
   * Find knowledge by project
   * @param {number} projectId
   * @param {Object} options
   * @returns {Array}
   */
  findByProject(projectId, options = {}) {
    const { type, limit = 100, offset = 0 } = options;
    
    try {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE project_id = ?
      `;
      const params = [projectId];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      return this.query(query, params);
    } catch (error) {
      console.error('Error finding knowledge by project:', error);
      throw error;
    }
  }

  /**
   * Search knowledge by content
   * @param {number} projectId
   * @param {string} searchTerm
   * @returns {Array}
   */
  searchByContent(projectId, searchTerm) {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE project_id = ?
          AND (title LIKE ? OR content LIKE ?)
        ORDER BY 
          CASE 
            WHEN title LIKE ? THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT 50
      `;

      const searchPattern = `%${searchTerm}%`;
      return this.query(query, [
        projectId,
        searchPattern,
        searchPattern,
        searchPattern
      ]);
    } catch (error) {
      console.error('Error searching knowledge:', error);
      throw error;
    }
  }

  /**
   * Find similar knowledge by embeddings (simple version)
   * @param {Array<number>} embeddings
   * @param {number} projectId
   * @param {number} limit
   * @returns {Array}
   */
  findSimilar(embeddings, projectId, limit = 10) {
    try {
      // Get all knowledge with embeddings for the project
      const allKnowledge = this.query(
        `SELECT id, title, content, embeddings 
         FROM ${this.tableName} 
         WHERE project_id = ? AND embeddings IS NOT NULL`,
        [projectId]
      );

      // Calculate similarities
      const similarities = allKnowledge.map(item => {
        const itemEmbeddings = JSON.parse(item.embeddings);
        const similarity = this.cosineSimilarity(embeddings, itemEmbeddings);
        return { ...item, similarity };
      });

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity, ...item }) => ({
          ...item,
          embeddings: undefined // Don't return embeddings to client
        }));
    } catch (error) {
      console.error('Error finding similar knowledge:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} a
   * @param {Array<number>} b
   * @returns {number}
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * Create knowledge link
   * @param {number} sourceId
   * @param {number} targetId
   * @param {string} linkType
   * @param {number} strength
   * @returns {Object}
   */
  createLink(sourceId, targetId, linkType = 'semantic', strength = 1.0) {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare(`
          INSERT INTO knowledge_links (source_id, target_id, link_type, strength)
          VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(sourceId, targetId, linkType, strength);
        return {
          id: result.lastInsertRowid,
          source_id: sourceId,
          target_id: targetId,
          link_type: linkType,
          strength: strength
        };
      }
      return null;
    } catch (error) {
      console.error('Error creating knowledge link:', error);
      throw error;
    }
  }

  /**
   * Get knowledge graph for visualization
   * @param {number} projectId
   * @returns {Object} { nodes, links }
   */
  getKnowledgeGraph(projectId) {
    try {
      // Get nodes with full details for visualization
      const nodes = this.query(
        `SELECT id, title, type, content, tags, importance, created_at 
         FROM ${this.tableName} 
         WHERE project_id = ?`,
        [projectId]
      );

      // Get links
      const links = this.query(
        `SELECT kl.* 
         FROM knowledge_links kl
         JOIN knowledge k1 ON kl.source_id = k1.id
         JOIN knowledge k2 ON kl.target_id = k2.id
         WHERE k1.project_id = ? AND k2.project_id = ?`,
        [projectId, projectId]
      );

      return { nodes, links };
    } catch (error) {
      console.error('Error getting knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Get knowledge graph with pagination for large graphs
   * @param {number} projectId
   * @param {Object} options
   * @returns {Object} { nodes, links, hasMore }
   */
  getKnowledgeGraphPaginated(projectId, options = {}) {
    const { limit = 100, offset = 0, types = null } = options;
    
    try {
      let nodeQuery = `
        SELECT id, title, type, content, tags, importance, created_at 
        FROM ${this.tableName} 
        WHERE project_id = ?
      `;
      const nodeParams = [projectId];

      if (types && types.length > 0) {
        const placeholders = types.map(() => '?').join(',');
        nodeQuery += ` AND type IN (${placeholders})`;
        nodeParams.push(...types);
      }

      nodeQuery += ' ORDER BY importance DESC, created_at DESC LIMIT ? OFFSET ?';
      nodeParams.push(limit + 1, offset); // Get one extra to check if there are more

      const nodes = this.query(nodeQuery, nodeParams);
      const hasMore = nodes.length > limit;
      
      if (hasMore) {
        nodes.pop(); // Remove the extra node
      }

      // Get all node IDs for link query
      const nodeIds = nodes.map(n => n.id);
      
      let links = [];
      if (nodeIds.length > 0) {
        const placeholders = nodeIds.map(() => '?').join(',');
        links = this.query(
          `SELECT * FROM knowledge_links 
           WHERE source_id IN (${placeholders}) 
              OR target_id IN (${placeholders})`,
          [...nodeIds, ...nodeIds]
        );
      }

      return { nodes, links, hasMore };
    } catch (error) {
      console.error('Error getting paginated knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Get knowledge subgraph centered on a specific node
   * @param {number} nodeId
   * @param {number} depth - How many levels of connections to include
   * @returns {Object} { nodes, links }
   */
  getKnowledgeSubgraph(nodeId, depth = 2) {
    try {
      const visitedNodes = new Set();
      const nodes = [];
      const links = [];
      
      // BFS to get nodes within depth
      const queue = [{ id: nodeId, level: 0 }];
      
      while (queue.length > 0) {
        const { id, level } = queue.shift();
        
        if (visitedNodes.has(id) || level > depth) continue;
        visitedNodes.add(id);
        
        // Get node details
        const node = this.findById(id);
        if (node) {
          nodes.push(node);
          
          if (level < depth) {
            // Get connected nodes
            const connectedLinks = this.query(
              `SELECT * FROM knowledge_links 
               WHERE source_id = ? OR target_id = ?`,
              [id, id]
            );
            
            connectedLinks.forEach(link => {
              links.push(link);
              const nextId = link.source_id === id ? link.target_id : link.source_id;
              if (!visitedNodes.has(nextId)) {
                queue.push({ id: nextId, level: level + 1 });
              }
            });
          }
        }
      }
      
      return { nodes, links };
    } catch (error) {
      console.error('Error getting knowledge subgraph:', error);
      throw error;
    }
  }

  /**
   * Get recent knowledge items
   * @param {number} projectId
   * @param {number} days
   * @returns {Array}
   */
  getRecent(projectId, days = 7) {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE project_id = ?
          AND created_at >= datetime('now', '-' || ? || ' days')
        ORDER BY created_at DESC
      `;
      return this.query(query, [projectId, days]);
    } catch (error) {
      console.error('Error getting recent knowledge:', error);
      throw error;
    }
  }
}

module.exports = KnowledgeRepository;