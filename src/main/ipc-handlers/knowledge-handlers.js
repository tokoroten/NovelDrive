const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');

const logger = getLogger('knowledge-handlers');

function registerKnowledgeHandlers(db) {
    const ProjectKnowledgeRepository = require('../repositories/project-knowledge-repository');
    const knowledgeRepo = new ProjectKnowledgeRepository(db);

    // Create knowledge
    ipcMain.handle('knowledge:create', async (event, knowledgeData) => {
        try {
            logger.info('Creating knowledge:', { title: knowledgeData.title });
            const knowledge = await knowledgeRepo.create(knowledgeData);
            return { success: true, data: knowledge };
        } catch (error) {
            logger.error('Failed to create knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    // Get knowledge by ID
    ipcMain.handle('knowledge:get', async (event, { id }) => {
        try {
            const knowledge = await knowledgeRepo.get(id);
            return { success: true, data: knowledge };
        } catch (error) {
            logger.error('Failed to get knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    // Update knowledge
    ipcMain.handle('knowledge:update', async (event, { id, data }) => {
        try {
            logger.info('Updating knowledge:', { id });
            const updated = await knowledgeRepo.update(id, data);
            return { success: true, data: updated };
        } catch (error) {
            logger.error('Failed to update knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete knowledge
    ipcMain.handle('knowledge:delete', async (event, { id }) => {
        try {
            logger.info('Deleting knowledge:', { id });
            await knowledgeRepo.delete(id);
            return { success: true };
        } catch (error) {
            logger.error('Failed to delete knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    // List knowledge by project
    ipcMain.handle('knowledge:listByProject', async (event, { projectId }) => {
        try {
            const items = await knowledgeRepo.getByProject(projectId);
            return { success: true, data: items };
        } catch (error) {
            logger.error('Failed to list knowledge by project:', error);
            return { success: false, error: error.message };
        }
    });

    // List knowledge by category
    ipcMain.handle('knowledge:listByCategory', async (event, { projectId, category }) => {
        try {
            const items = await knowledgeRepo.getByCategory(projectId, category);
            return { success: true, data: items };
        } catch (error) {
            logger.error('Failed to list knowledge by category:', error);
            return { success: false, error: error.message };
        }
    });

    // Search knowledge
    ipcMain.handle('knowledge:search', async (event, { projectId, query, options }) => {
        try {
            const results = await knowledgeRepo.search(projectId, query, options);
            return { success: true, data: results };
        } catch (error) {
            logger.error('Failed to search knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    // Add relation
    ipcMain.handle('knowledge:addRelation', async (event, { knowledgeId, relatedId }) => {
        try {
            logger.info('Adding relation:', { knowledgeId, relatedId });
            const knowledge = await knowledgeRepo.addRelation(knowledgeId, relatedId);
            return { success: true, data: knowledge };
        } catch (error) {
            logger.error('Failed to add relation:', error);
            return { success: false, error: error.message };
        }
    });

    // Remove relation
    ipcMain.handle('knowledge:removeRelation', async (event, { knowledgeId, relatedId }) => {
        try {
            logger.info('Removing relation:', { knowledgeId, relatedId });
            const knowledge = await knowledgeRepo.removeRelation(knowledgeId, relatedId);
            return { success: true, data: knowledge };
        } catch (error) {
            logger.error('Failed to remove relation:', error);
            return { success: false, error: error.message };
        }
    });

    // Get relations
    ipcMain.handle('knowledge:getRelations', async (event, { id }) => {
        try {
            const relations = await knowledgeRepo.getRelations(id);
            return { success: true, data: relations };
        } catch (error) {
            logger.error('Failed to get relations:', error);
            return { success: false, error: error.message };
        }
    });

    // Get all tags
    ipcMain.handle('knowledge:getAllTags', async (event, { projectId }) => {
        try {
            const tags = await knowledgeRepo.getAllTags(projectId);
            return { success: true, data: tags };
        } catch (error) {
            logger.error('Failed to get all tags:', error);
            return { success: false, error: error.message };
        }
    });

    // Get statistics
    ipcMain.handle('knowledge:getStatistics', async (event, { projectId }) => {
        try {
            const stats = await knowledgeRepo.getStatistics(projectId);
            return { success: true, data: stats };
        } catch (error) {
            logger.error('Failed to get statistics:', error);
            return { success: false, error: error.message };
        }
    });

    // Get links
    ipcMain.handle('knowledge:getLinks', async (event, { projectId }) => {
        try {
            logger.info('Getting knowledge links for project:', projectId);
            const knowledgeItems = await knowledgeRepo.list(projectId);
            const links = [];
            
            // Extract links from knowledge items
            for (const item of knowledgeItems) {
                if (item.related_ids) {
                    const relatedIds = JSON.parse(item.related_ids);
                    relatedIds.forEach(relatedId => {
                        links.push({
                            source: item.id,
                            target: relatedId
                        });
                    });
                }
            }
            
            return { success: true, data: links };
        } catch (error) {
            logger.error('Failed to get knowledge links:', error);
            return { success: false, error: error.message };
        }
    });

    // Export as markdown
    ipcMain.handle('knowledge:exportAsMarkdown', async (event, { projectId }) => {
        try {
            const markdown = await knowledgeRepo.exportAsMarkdown(projectId);
            return { success: true, data: markdown };
        } catch (error) {
            logger.error('Failed to export as markdown:', error);
            return { success: false, error: error.message };
        }
    });

    // Get knowledge graph
    ipcMain.handle('knowledge:getGraph', async (event, projectId) => {
        try {
            logger.info('Getting knowledge graph for project:', projectId);
            // Use the main knowledge repository for graph data
            const KnowledgeRepository = require('../repositories/knowledge-repository');
            const mainKnowledgeRepo = new KnowledgeRepository(db);
            const graphData = await mainKnowledgeRepo.getKnowledgeGraph(projectId);
            return graphData;
        } catch (error) {
            logger.error('Failed to get knowledge graph:', error);
            throw error;
        }
    });

    // Get knowledge subgraph
    ipcMain.handle('knowledge:getSubgraph', async (event, { nodeId, depth }) => {
        try {
            logger.info('Getting knowledge subgraph:', { nodeId, depth });
            const KnowledgeRepository = require('../repositories/knowledge-repository');
            const mainKnowledgeRepo = new KnowledgeRepository(db);
            const subgraph = await mainKnowledgeRepo.getKnowledgeSubgraph(nodeId, depth);
            return subgraph;
        } catch (error) {
            logger.error('Failed to get knowledge subgraph:', error);
            throw error;
        }
    });

    // Get knowledge list by project
    ipcMain.handle('knowledge:list', async (event, projectId) => {
        try {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            
            const items = await knowledgeRepo.getByProject(projectId);
            return { success: true, data: items };
        } catch (error) {
            logger.error('Failed to list knowledge:', error);
            return { success: false, error: error.message };
        }
    });

    logger.info('Knowledge handlers registered');
}

module.exports = { registerKnowledgeHandlers };