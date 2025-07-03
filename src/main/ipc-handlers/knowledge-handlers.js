const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');

/**
 * Setup knowledge related IPC handlers
 * @param {Object} repositories
 */
function setupKnowledgeHandlers(repositories) {
  const logger = getLogger();

  // Get knowledge by project
  ipcMain.handle('knowledge:getByProject', async (event, projectId) => {
    logger.info(`Getting knowledge for project: ${projectId}`);
    try {
      const knowledge = await repositories.knowledge.findByProject(projectId);
      return { success: true, data: knowledge };
    } catch (error) {
      logger.error('Failed to get knowledge:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Get knowledge by ID
  ipcMain.handle('knowledge:getById', async (event, knowledgeId) => {
    logger.info(`Getting knowledge by ID: ${knowledgeId}`);
    try {
      const knowledge = await repositories.knowledge.findById(knowledgeId);
      return { success: true, data: knowledge };
    } catch (error) {
      logger.error('Failed to get knowledge:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Get knowledge links
  ipcMain.handle('knowledge:getLinks', async (event, projectId) => {
    logger.info(`Getting knowledge links for project: ${projectId}`);
    try {
      // Get all links for the project
      const query = `
        SELECT kl.* 
        FROM knowledge_links kl
        JOIN knowledge k ON kl.source_id = k.id
        WHERE k.project_id = ?
      `;
      const links = await repositories.knowledge.query(query, [projectId]);
      return { success: true, data: links };
    } catch (error) {
      logger.error('Failed to get knowledge links:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Create knowledge link
  ipcMain.handle('knowledge:createLink', async (event, linkData) => {
    logger.info('Creating knowledge link');
    try {
      const { source_id, target_id, link_type, strength = 1.0, metadata } = linkData;
      
      // Check if link already exists
      const existingLink = await repositories.knowledge.query(
        'SELECT * FROM knowledge_links WHERE source_id = ? AND target_id = ?',
        [source_id, target_id]
      );
      
      if (existingLink.length > 0) {
        // Update existing link
        await repositories.knowledge.query(
          'UPDATE knowledge_links SET strength = ?, metadata = ? WHERE id = ?',
          [strength, metadata ? JSON.stringify(metadata) : null, existingLink[0].id]
        );
        return { success: true, data: existingLink[0] };
      } else {
        // Create new link
        const result = await repositories.knowledge.query(
          `INSERT INTO knowledge_links (source_id, target_id, link_type, strength, metadata)
           VALUES (?, ?, ?, ?, ?)`,
          [source_id, target_id, link_type, strength, metadata ? JSON.stringify(metadata) : null]
        );
        return { success: true, data: { id: result.lastInsertRowid } };
      }
    } catch (error) {
      logger.error('Failed to create knowledge link:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Delete knowledge link
  ipcMain.handle('knowledge:deleteLink', async (event, linkId) => {
    logger.info(`Deleting knowledge link: ${linkId}`);
    try {
      await repositories.knowledge.query(
        'DELETE FROM knowledge_links WHERE id = ?',
        [linkId]
      );
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete knowledge link:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Update knowledge
  ipcMain.handle('knowledge:update', async (event, knowledgeId, updates) => {
    logger.info(`Updating knowledge: ${knowledgeId}`);
    try {
      const knowledge = await repositories.knowledge.update(knowledgeId, updates);
      return { success: true, data: knowledge };
    } catch (error) {
      logger.error('Failed to update knowledge:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Delete knowledge
  ipcMain.handle('knowledge:delete', async (event, knowledgeId) => {
    logger.info(`Deleting knowledge: ${knowledgeId}`);
    try {
      const success = await repositories.knowledge.delete(knowledgeId);
      return { success };
    } catch (error) {
      logger.error('Failed to delete knowledge:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  // Auto-link knowledge based on embeddings
  ipcMain.handle('knowledge:autoLink', async (event, knowledgeId, threshold = 0.7) => {
    logger.info(`Auto-linking knowledge: ${knowledgeId}`);
    try {
      const knowledge = await repositories.knowledge.findById(knowledgeId);
      if (!knowledge || !knowledge.embeddings) {
        return { success: false, error: { message: 'Knowledge not found or has no embeddings' } };
      }

      const projectKnowledge = await repositories.knowledge.findByProject(knowledge.project_id);
      const embeddings = JSON.parse(knowledge.embeddings);
      const links = [];

      // Calculate similarities and create links
      for (const other of projectKnowledge) {
        if (other.id === knowledgeId || !other.embeddings) continue;

        const otherEmbeddings = JSON.parse(other.embeddings);
        const similarity = calculateCosineSimilarity(embeddings, otherEmbeddings);

        if (similarity >= threshold) {
          links.push({
            source_id: knowledgeId,
            target_id: other.id,
            link_type: 'semantic',
            strength: similarity
          });
        }
      }

      // Create links
      for (const link of links) {
        await repositories.knowledge.query(
          `INSERT OR IGNORE INTO knowledge_links (source_id, target_id, link_type, strength)
           VALUES (?, ?, ?, ?)`,
          [link.source_id, link.target_id, link.link_type, link.strength]
        );
      }

      return { success: true, data: { created: links.length } };
    } catch (error) {
      logger.error('Failed to auto-link knowledge:', error);
      return { success: false, error: { message: error.message } };
    }
  });

  logger.info('Knowledge handlers setup complete');
}

// Calculate cosine similarity between two vectors
function calculateCosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) return 0;

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

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (norm1 * norm2);
}

module.exports = setupKnowledgeHandlers;