const BaseRepository = require('./base-repository');
const { getLogger } = require('../utils/logger');

/**
 * Repository for managing project-specific knowledge
 */
class ProjectKnowledgeRepository extends BaseRepository {
    constructor(db) {
        super(db, 'knowledge');
        this.logger = getLogger('project-knowledge-repository');
    }

    /**
     * Create new knowledge entry
     * @param {Object} knowledgeData
     * @returns {Promise<Object>}
     */
    async create(knowledgeData) {
        const knowledge = {
            ...knowledgeData,
            relations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return super.create(knowledge);
    }

    /**
     * Get knowledge by project
     * @param {number} projectId
     * @returns {Promise<Array>}
     */
    async getByProject(projectId) {
        try {
            const items = await this.findBy('project_id', projectId);
            return items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } catch (error) {
            this.logger.error('Error getting knowledge by project:', error);
            throw error;
        }
    }

    /**
     * Get knowledge by category
     * @param {number} projectId
     * @param {string} category
     * @returns {Promise<Array>}
     */
    async getByCategory(projectId, category) {
        try {
            const items = await this.findBy('project_id', projectId);
            return items.filter(item => item.category === category);
        } catch (error) {
            this.logger.error('Error getting knowledge by category:', error);
            throw error;
        }
    }

    /**
     * Search knowledge
     * @param {number} projectId
     * @param {string} query
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async search(projectId, query, options = {}) {
        try {
            const allItems = await this.getByProject(projectId);
            const lowerQuery = query.toLowerCase();
            
            let results = allItems.filter(item => {
                const titleMatch = item.title.toLowerCase().includes(lowerQuery);
                const contentMatch = item.content.toLowerCase().includes(lowerQuery);
                const tagMatch = (item.tags || []).some(tag => 
                    tag.toLowerCase().includes(lowerQuery)
                );
                
                return titleMatch || contentMatch || tagMatch;
            });

            // Apply category filter if specified
            if (options.category) {
                results = results.filter(item => item.category === options.category);
            }

            // Apply importance filter if specified
            if (options.importance) {
                results = results.filter(item => item.importance === options.importance);
            }

            // Apply tag filter if specified
            if (options.tags && options.tags.length > 0) {
                results = results.filter(item => {
                    const itemTags = item.tags || [];
                    return options.tags.some(tag => itemTags.includes(tag));
                });
            }

            // Sort results
            if (options.sort === 'title') {
                results.sort((a, b) => a.title.localeCompare(b.title));
            } else if (options.sort === 'importance') {
                const importanceOrder = { high: 1, medium: 2, low: 3 };
                results.sort((a, b) => 
                    importanceOrder[a.importance] - importanceOrder[b.importance]
                );
            }

            // Apply limit if specified
            if (options.limit) {
                results = results.slice(0, options.limit);
            }

            return results;
        } catch (error) {
            this.logger.error('Error searching knowledge:', error);
            throw error;
        }
    }

    /**
     * Add relation between knowledge items
     * @param {number} knowledgeId
     * @param {number} relatedId
     * @returns {Promise<Object>}
     */
    async addRelation(knowledgeId, relatedId) {
        try {
            const knowledge = await this.get(knowledgeId);
            if (!knowledge) {
                throw new Error('Knowledge not found');
            }

            if (!knowledge.relations) {
                knowledge.relations = [];
            }

            // Avoid duplicate relations
            if (!knowledge.relations.includes(relatedId)) {
                knowledge.relations.push(relatedId);
                
                // Update the knowledge
                await this.update(knowledgeId, {
                    ...knowledge,
                    updatedAt: new Date().toISOString()
                });

                // Add reverse relation
                const relatedKnowledge = await this.get(relatedId);
                if (relatedKnowledge) {
                    if (!relatedKnowledge.relations) {
                        relatedKnowledge.relations = [];
                    }
                    if (!relatedKnowledge.relations.includes(knowledgeId)) {
                        relatedKnowledge.relations.push(knowledgeId);
                        await this.update(relatedId, {
                            ...relatedKnowledge,
                            updatedAt: new Date().toISOString()
                        });
                    }
                }
            }

            return knowledge;
        } catch (error) {
            this.logger.error('Error adding relation:', error);
            throw error;
        }
    }

    /**
     * Remove relation between knowledge items
     * @param {number} knowledgeId
     * @param {number} relatedId
     * @returns {Promise<Object>}
     */
    async removeRelation(knowledgeId, relatedId) {
        try {
            const knowledge = await this.get(knowledgeId);
            if (!knowledge) {
                throw new Error('Knowledge not found');
            }

            if (knowledge.relations) {
                knowledge.relations = knowledge.relations.filter(id => id !== relatedId);
                
                await this.update(knowledgeId, {
                    ...knowledge,
                    updatedAt: new Date().toISOString()
                });

                // Remove reverse relation
                const relatedKnowledge = await this.get(relatedId);
                if (relatedKnowledge && relatedKnowledge.relations) {
                    relatedKnowledge.relations = relatedKnowledge.relations.filter(
                        id => id !== knowledgeId
                    );
                    await this.update(relatedId, {
                        ...relatedKnowledge,
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            return knowledge;
        } catch (error) {
            this.logger.error('Error removing relation:', error);
            throw error;
        }
    }

    /**
     * Get related knowledge items
     * @param {number} knowledgeId
     * @returns {Promise<Array>}
     */
    async getRelations(knowledgeId) {
        try {
            const knowledge = await this.get(knowledgeId);
            if (!knowledge || !knowledge.relations || knowledge.relations.length === 0) {
                return [];
            }

            const relatedItems = await Promise.all(
                knowledge.relations.map(id => this.get(id))
            );

            return relatedItems.filter(item => item !== null);
        } catch (error) {
            this.logger.error('Error getting relations:', error);
            throw error;
        }
    }

    /**
     * Get all tags used in a project
     * @param {number} projectId
     * @returns {Promise<Array>}
     */
    async getAllTags(projectId) {
        try {
            const items = await this.getByProject(projectId);
            const tagSet = new Set();

            items.forEach(item => {
                (item.tags || []).forEach(tag => tagSet.add(tag));
            });

            return Array.from(tagSet).sort();
        } catch (error) {
            this.logger.error('Error getting all tags:', error);
            throw error;
        }
    }

    /**
     * Get knowledge statistics for a project
     * @param {number} projectId
     * @returns {Promise<Object>}
     */
    async getStatistics(projectId) {
        try {
            const items = await this.getByProject(projectId);
            
            const stats = {
                total: items.length,
                byCategory: {},
                byImportance: {
                    high: 0,
                    medium: 0,
                    low: 0
                },
                mostUsedTags: [],
                recentlyUpdated: []
            };

            // Count by category
            items.forEach(item => {
                const category = item.category || 'other';
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
                
                // Count by importance
                const importance = item.importance || 'medium';
                stats.byImportance[importance]++;
            });

            // Get most used tags
            const tagCounts = {};
            items.forEach(item => {
                (item.tags || []).forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });
            
            stats.mostUsedTags = Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([tag, count]) => ({ tag, count }));

            // Get recently updated
            stats.recentlyUpdated = items
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 5)
                .map(item => ({
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    updatedAt: item.updatedAt
                }));

            return stats;
        } catch (error) {
            this.logger.error('Error getting statistics:', error);
            throw error;
        }
    }

    /**
     * Export knowledge as markdown
     * @param {number} projectId
     * @returns {Promise<string>}
     */
    async exportAsMarkdown(projectId) {
        try {
            const items = await this.getByProject(projectId);
            const categories = {};

            // Group by category
            items.forEach(item => {
                const category = item.category || 'other';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(item);
            });

            // Generate markdown
            let markdown = '# プロジェクト知識\n\n';

            Object.entries(categories).forEach(([category, categoryItems]) => {
                markdown += `## ${this.getCategoryLabel(category)}\n\n`;

                categoryItems.forEach(item => {
                    markdown += `### ${item.title}\n\n`;
                    markdown += `${item.content}\n\n`;

                    if (item.metadata && Object.keys(item.metadata).length > 0) {
                        markdown += '**詳細情報:**\n';
                        Object.entries(item.metadata).forEach(([key, value]) => {
                            if (value) {
                                markdown += `- ${this.getMetadataLabel(key)}: ${value}\n`;
                            }
                        });
                        markdown += '\n';
                    }

                    if (item.tags && item.tags.length > 0) {
                        markdown += `**タグ:** ${item.tags.join(', ')}\n\n`;
                    }

                    markdown += `**重要度:** ${this.getImportanceLabel(item.importance)}\n\n`;
                    markdown += '---\n\n';
                });
            });

            return markdown;
        } catch (error) {
            this.logger.error('Error exporting as markdown:', error);
            throw error;
        }
    }

    // Helper methods
    getCategoryLabel(category) {
        const labels = {
            world: '世界設定',
            character: 'キャラクター',
            location: '場所',
            item: 'アイテム',
            event: '出来事',
            other: 'その他'
        };
        return labels[category] || category;
    }

    getImportanceLabel(importance) {
        const labels = {
            high: '高',
            medium: '中',
            low: '低'
        };
        return labels[importance] || importance;
    }

    getMetadataLabel(key) {
        const labels = {
            age: '年齢',
            gender: '性別',
            appearance: '外見',
            personality: '性格',
            type: '種類',
            features: '特徴'
        };
        return labels[key] || key;
    }
}

module.exports = ProjectKnowledgeRepository;