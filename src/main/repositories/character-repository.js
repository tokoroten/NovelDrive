const BaseRepository = require('./base-repository');

class CharacterRepository extends BaseRepository {
  constructor(db) {
    super(db, 'characters');
  }

  /**
   * Find characters by project
   * @param {number} projectId
   * @returns {Array}
   */
  findByProject(projectId) {
    return this.findBy('project_id', projectId);
  }

  /**
   * Create character with relationships
   * @param {Object} characterData
   * @returns {Object}
   */
  createWithRelationships(characterData) {
    try {
      // Ensure relationships is properly formatted as JSON
      if (characterData.relationships && typeof characterData.relationships === 'object') {
        characterData.relationships = JSON.stringify(characterData.relationships);
      }
      
      return this.create(characterData);
    } catch (error) {
      console.error('Error creating character with relationships:', error);
      throw error;
    }
  }

  /**
   * Update character relationships
   * @param {number} characterId
   * @param {Object} relationships
   * @returns {Object|null}
   */
  updateRelationships(characterId, relationships) {
    try {
      return this.update(characterId, {
        relationships: JSON.stringify(relationships)
      });
    } catch (error) {
      console.error('Error updating character relationships:', error);
      throw error;
    }
  }

  /**
   * Find characters with parsed relationships
   * @param {number} projectId
   * @returns {Array}
   */
  findWithParsedRelationships(projectId) {
    try {
      const characters = this.findByProject(projectId);
      
      // Parse relationships JSON for each character
      return characters.map(character => ({
        ...character,
        relationships: character.relationships ? 
          JSON.parse(character.relationships) : {}
      }));
    } catch (error) {
      console.error('Error finding characters with parsed relationships:', error);
      throw error;
    }
  }

  /**
   * Get character relationship network
   * @param {number} projectId
   * @returns {Object} { nodes, edges }
   */
  getRelationshipNetwork(projectId) {
    try {
      const characters = this.findWithParsedRelationships(projectId);
      
      const nodes = characters.map(char => ({
        id: char.id,
        name: char.name,
        description: char.description
      }));

      const edges = [];
      characters.forEach(char => {
        if (char.relationships) {
          Object.entries(char.relationships).forEach(([targetId, relationship]) => {
            edges.push({
              source: char.id,
              target: parseInt(targetId),
              relationship: relationship
            });
          });
        }
      });

      return { nodes, edges };
    } catch (error) {
      console.error('Error getting relationship network:', error);
      throw error;
    }
  }

  /**
   * Search characters by name or description
   * @param {number} projectId
   * @param {string} searchTerm
   * @returns {Array}
   */
  search(projectId, searchTerm) {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE project_id = ?
          AND (name LIKE ? OR description LIKE ? OR personality LIKE ?)
        ORDER BY 
          CASE 
            WHEN name LIKE ? THEN 1
            ELSE 2
          END,
          name ASC
      `;

      const searchPattern = `%${searchTerm}%`;
      return this.query(query, [
        projectId,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      ]);
    } catch (error) {
      console.error('Error searching characters:', error);
      throw error;
    }
  }

  /**
   * Get character statistics
   * @param {number} characterId
   * @returns {Object}
   */
  getStatistics(characterId) {
    try {
      const stats = {
        chapterAppearances: 0,
        totalMentions: 0,
        relationshipCount: 0
      };

      if (this.db.prepare) {
        // Count chapter appearances (simplified - would need proper text analysis)
        const chapterQuery = this.db.prepare(`
          SELECT COUNT(DISTINCT id) as count
          FROM chapters
          WHERE content LIKE ?
        `);
        
        const character = this.findById(characterId);
        if (character) {
          const result = chapterQuery.get(`%${character.name}%`);
          stats.chapterAppearances = result.count;

          // Count relationships
          if (character.relationships) {
            const relationships = JSON.parse(character.relationships);
            stats.relationshipCount = Object.keys(relationships).length;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting character statistics:', error);
      throw error;
    }
  }
}

module.exports = CharacterRepository;