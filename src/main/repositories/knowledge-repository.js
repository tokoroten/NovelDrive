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
  createWithEmbeddings(data, embeddings) {
    try {
      const knowledgeData = {
        ...data,
        embeddings: JSON.stringify(embeddings)
      };
      return this.create(knowledgeData);
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
      // Get nodes
      const nodes = this.query(
        `SELECT id, title, type, created_at 
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