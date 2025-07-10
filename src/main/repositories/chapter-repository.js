const BaseRepository = require('./base-repository');

/**
 * Repository for managing chapters
 */
class ChapterRepository extends BaseRepository {
    constructor(db) {
        super(db, 'chapters');
    }

    /**
     * Find chapters by project
     * @param {number} projectId
     * @returns {Array}
     */
    findByProject(projectId) {
        try {
            const sql = `
                SELECT * FROM ${this.tableName} 
                WHERE project_id = ? 
                ORDER BY chapter_number ASC
            `;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                return stmt.all(projectId);
            }
            return [];
        } catch (error) {
            console.error(`Error finding chapters by project:`, error);
            throw error;
        }
    }

    /**
     * Find chapters by plot
     * @param {number} plotId
     * @returns {Array}
     */
    findByPlot(plotId) {
        try {
            const sql = `
                SELECT * FROM ${this.tableName} 
                WHERE plot_id = ? 
                ORDER BY chapter_number ASC
            `;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                return stmt.all(plotId);
            }
            return [];
        } catch (error) {
            console.error(`Error finding chapters by plot:`, error);
            throw error;
        }
    }

    /**
     * Get chapter by project and number
     * @param {number} projectId
     * @param {number} chapterNumber
     * @returns {Object|null}
     */
    getByNumber(projectId, chapterNumber) {
        try {
            const sql = `
                SELECT * FROM ${this.tableName} 
                WHERE project_id = ? AND chapter_number = ?
            `;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                return stmt.get(projectId, chapterNumber);
            }
            return null;
        } catch (error) {
            console.error(`Error getting chapter by number:`, error);
            throw error;
        }
    }

    /**
     * Update chapter content
     * @param {number} id
     * @param {string} content
     * @param {number} wordCount
     * @returns {Object}
     */
    updateContent(id, content, wordCount) {
        const updateData = {
            content,
            word_count: wordCount,
            updated_at: new Date().toISOString()
        };
        
        return this.update(id, updateData);
    }

    /**
     * Update chapter status
     * @param {number} id
     * @param {string} status
     * @returns {Object}
     */
    updateStatus(id, status) {
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        
        return this.update(id, updateData);
    }

    /**
     * Get chapter count for project
     * @param {number} projectId
     * @returns {number}
     */
    getCountByProject(projectId) {
        try {
            const sql = `
                SELECT COUNT(*) as count FROM ${this.tableName} 
                WHERE project_id = ?
            `;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                const row = stmt.get(projectId);
                return row?.count || 0;
            }
            return 0;
        } catch (error) {
            console.error(`Error getting chapter count:`, error);
            throw error;
        }
    }

    /**
     * Get total word count for project
     * @param {number} projectId
     * @returns {number}
     */
    getTotalWordCount(projectId) {
        try {
            const sql = `
                SELECT SUM(word_count) as total FROM ${this.tableName} 
                WHERE project_id = ?
            `;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                const row = stmt.get(projectId);
                return row?.total || 0;
            }
            return 0;
        } catch (error) {
            console.error(`Error getting total word count:`, error);
            throw error;
        }
    }

    /**
     * Delete all chapters for a project
     * @param {number} projectId
     * @returns {void}
     */
    deleteByProject(projectId) {
        try {
            const sql = `DELETE FROM ${this.tableName} WHERE project_id = ?`;
            
            if (this.db.prepare) {
                const stmt = this.db.prepare(sql);
                stmt.run(projectId);
            }
        } catch (error) {
            console.error(`Error deleting chapters by project:`, error);
            throw error;
        }
    }
}

module.exports = ChapterRepository;